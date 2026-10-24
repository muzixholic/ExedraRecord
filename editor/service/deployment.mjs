import {readFile,writeFile,mkdir,mkdtemp,cp,readdir,stat} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import './portrait-model.js';
async function optionalJson(path,fallback){try{return JSON.parse(await readFile(path,'utf8'))}catch(error){if(error.code==='ENOENT')return fallback;throw error}}
export const target={account:'7b33c59c1366ca82db48b21179a06bd1',database:'aa62db47-a17f-4e60-b481-d4c970c93404',name:'exedra-record',url:'https://exedra-record.chm1610.workers.dev'};
export function validateTarget(config){if(config.account_id!==target.account||config.name!==target.name||config.d1_databases?.find(k=>k.binding==='DB')?.database_id!==target.database||config.main!=='src/worker.js'||config.assets?.directory!=='./public')throw Error('배포 대상이 기존 엑세드라 레코드와 다릅니다. 프로젝트 설정을 확인해 주세요.')}
export function sqlFor(memories,portraits=[]){const statements=['CREATE TABLE IF NOT EXISTS portraits (id TEXT PRIMARY KEY, payload TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 1);'];for(const [table,records]of [['memories',memories],['portraits',portraits]])for(const memory of records){if(typeof memory.id!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(memory.id))throw Error('자료 식별자 형식 오류');if(table==='portraits')globalThis.PortraitModel.validate(memory);statements.push("INSERT INTO "+table+"(id,payload,published) VALUES ('"+memory.id+"','"+JSON.stringify(memory).replaceAll("'","''")+"',1) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,published=excluded.published;")}return statements.join('\n')+'\n'}
async function walk(root,directory=root){const items=[];for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isSymbolicLink())throw Error('배포 파일에 심볼릭 링크가 있습니다: '+relative(root,path));if(entry.isDirectory())items.push(...await walk(root,path));else if(entry.isFile())items.push(path)}return items.sort()}
export async function snapshotHash(root){const files=[join(root,'wrangler.jsonc'),join(root,'memories.sql'),join(root,'records.json'),...await walk(join(root,'src')),...await walk(join(root,'public'))];try{await stat(join(root,'portraits.json'));files.push(join(root,'portraits.json'))}catch(error){if(error.code!=='ENOENT')throw error}const hash=createHash('sha256');for(const file of files)hash.update(relative(root,file)).update(await readFile(file));return hash.digest('hex')}
export async function prepare(root){
 const config=JSON.parse(await readFile(join(root,'wrangler.jsonc'),'utf8'));validateTarget(config);
 const records=[];for(const file of (await readdir(join(root,'data/memories'))).filter(p=>p.endsWith('.json')).sort()){
  const memory=JSON.parse(await readFile(join(root,'data/memories',file),'utf8'));if(file!==memory.id+'.json')throw Error('기억 파일명과 식별자가 다릅니다.');
  for(const key of ['image','illustration_url','thumbnail_url'])if(memory[key]?.startsWith('/')){const path=resolve(root,'public','.'+memory[key]);const base=resolve(root,'public/images');const assetRelative=relative(base,path);if(!assetRelative||assetRelative.startsWith('..')||isAbsolute(assetRelative))throw Error('이미지 경로가 올바르지 않습니다.');await stat(path)}
  records.push(memory);
 }
 const portraits=[];let portraitFiles=[];try{portraitFiles=await readdir(join(root,'data/portraits'))}catch(error){if(error.code!=='ENOENT')throw error}
 for(const file of portraitFiles.filter(v=>v.endsWith('.json')).sort()){
  const portrait=JSON.parse(await readFile(join(root,'data/portraits',file),'utf8'));globalThis.PortraitModel.validate(portrait);if(file!==portrait.id+'.json')throw Error('포트레이트 파일명과 식별자가 다릅니다.');
  for(const key of ['image_url','thumbnail_url','source_image'])if(portrait[key]?.startsWith('/')){const path=resolve(root,'public','.'+portrait[key]),base=resolve(root,'public/images'),rel=relative(base,path);if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('포트레이트 이미지 경로를 확인해 주세요.');await stat(path)}portraits.push(portrait);
 }
 if(!records.length&&!portraits.length)throw Error('반영할 자료가 없습니다.');
 const base=join(root,'.editor-jobs');await mkdir(base,{recursive:true});const directory=await mkdtemp(join(base,'publish-'));
 await cp(join(root,'src'),join(directory,'src'),{recursive:true});await cp(join(root,'public'),join(directory,'public'),{recursive:true});await writeFile(join(directory,'wrangler.jsonc'),JSON.stringify(config,null,2));await writeFile(join(directory,'memories.sql'),sqlFor(records,portraits));await writeFile(join(directory,'records.json'),JSON.stringify(records));await writeFile(join(directory,'portraits.json'),JSON.stringify(portraits));
 const plan={id:randomUUID(),root:resolve(root),directory,count:records.length,portraitCount:portraits.length,url:target.url,hash:await snapshotHash(directory),createdAt:new Date().toISOString(),ids:records.map(k=>k.id)};
 await writeFile(join(directory,'plan.json'),JSON.stringify(plan,null,2));return plan;
}
export async function verifyPlan(plan){validateTarget(JSON.parse(await readFile(join(plan.directory,'wrangler.jsonc'),'utf8')));if(await snapshotHash(plan.directory)!==plan.hash)throw Error('검토 후 배포 자료가 변경되었습니다. 다시 반영 준비를 눌러 주세요.')}
export async function publish(plan,{run,node,wrangler,progress=()=>{},fetcher=fetch,signal}){
 await verifyPlan(plan);
 const cli=(args,timeout=180_000)=>run(node,[wrangler,...args],{cwd:plan.directory,timeout});
 progress('Cloudflare 로그인과 반영 대상 확인 중');const identity=await cli(['whoami']);if(!identity.includes(target.account))throw Error('기존 Cloudflare 계정에 로그인되어 있지 않습니다.');
 progress('배포할 사이트와 이미지를 검사하는 중');await cli(['deploy','--dry-run']);
 let assets=false,database=false;
 try{
  progress('사이트와 이미지 업로드 중');await cli(['deploy'],600_000);assets=true;
  progress('기억과 포트레이트를 서버 DB에 반영하는 중');await cli(['d1','execute','exedra-record','--remote','--file',join(plan.directory,'memories.sql'),'--yes'],600_000);database=true;
  progress('서버에 저장된 자료를 확인하는 중');
  const memories=JSON.parse(await readFile(join(plan.directory,'records.json'),'utf8')).map(memory=>({memory,kind:'memories'}));const portraits=(await optionalJson(join(plan.directory,'portraits.json'),[])).map(memory=>({memory,kind:'portraits'}));const all=[...memories,...portraits];
  for(const [index,{memory,kind}]of all.entries()){
   progress('서버 자료 확인 중 ('+(index+1)+'/'+all.length+')');let verified=false,lastError;
   for(let attempt=0;attempt<3;attempt++){
    if(signal?.aborted)throw Error('작업이 취소되었습니다.');
    try{const timeout=AbortSignal.timeout(20_000);const response=await fetcher(target.url+'/api/'+kind+'/'+memory.id+'?verify='+plan.id+'-'+attempt,{signal:signal?AbortSignal.any([signal,timeout]):timeout,cache:'no-store'});if(!response.ok)throw Error(memory.id+' 조회 실패');const value=await response.json();if(stable(value)!==stable(memory))throw Error(memory.id+' 서버 자료 불일치');verified=true;break}catch(error){lastError=error;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,300*(attempt+1)))}
   }
   if(!verified)throw lastError;
  }
  const result={url:target.url,count:plan.count,portraitCount:plan.portraitCount||0,finishedAt:new Date().toISOString()};await writeFile(join(plan.directory,'success.json'),JSON.stringify(result));progress('서버 반영과 확인을 마쳤습니다.');return result;
 }catch(error){throw Error((database?'DB 반영은 완료됐지만 서버 확인에 실패했습니다. ':assets?'이미지는 반영됐지만 데이터 반영을 마치지 못했습니다. ':'서버 반영을 완료하지 못했습니다. ')+error.message+' 같은 자료로 다시 시도할 수 있습니다.')}
}
function stable(value){if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';return JSON.stringify(value)}
