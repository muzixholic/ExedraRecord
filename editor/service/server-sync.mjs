import {readFile,writeFile,mkdir,mkdtemp,readdir,lstat,realpath,rename,rm} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute,dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {target,validateTarget} from './deployment.mjs';
import '../ui/character-groups.js';
import '../ui/model.js';
import './portrait-model.js';
const encode=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const digest=data=>createHash('sha256').update(data).digest('hex');
const idPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const recordPath=/^data\/(memories|portraits)\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/;
const imagePath=/^public\/images\/[A-Za-z0-9][A-Za-z0-9._/-]*$/;
function allowed(file){return (recordPath.test(file)||file==='public/characters.json'||imagePath.test(file))&&!file.split('/').some(p=>!p||p==='.'||p==='..'||p.endsWith('.')||/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(p))}
async function safe(root,file){
 if(typeof file!=='string'||!file||file.includes('\\')||file.includes('\0'))throw Error('갱신 파일 경로가 올바르지 않습니다.');
 const dest=resolve(root,file),rel=relative(root,dest);if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('프로젝트 밖에는 쓸 수 없습니다.');
 let current=root;for(const part of rel.split(/[\\/]/)){current=join(current,part);try{if((await lstat(current)).isSymbolicLink())throw Error('갱신 경로에 심볼릭 링크가 있습니다.')}catch(error){if(error.code!=='ENOENT')throw error}}
 return dest;
}
async function bytes(root,file){try{const path=await safe(root,file);if(!(await lstat(path)).isFile())throw Error('일반 파일이 아닌 자료가 있습니다: '+file);return await readFile(path)}catch(error){if(error.code==='ENOENT')return null;throw error}}
async function localRecords(root){const files=[];for(const kind of ['memories','portraits']){const folder='data/'+kind;await safe(root,folder);let entries=[];try{entries=await readdir(join(root,folder),{withFileTypes:true})}catch(error){if(error.code!=='ENOENT')throw error}for(const entry of entries)if(entry.name.endsWith('.json')){const file=folder+'/'+entry.name;if(!recordPath.test(file)||!entry.isFile())throw Error('로컬 자료 파일 형식을 확인해 주세요: '+file);files.push(file)}}return files.sort()}
async function fingerprint(root,images){const files=[...await localRecords(root),'public/characters.json',...images].sort(),hash=createHash('sha256');for(const file of files)hash.update(file+'\0').update((await bytes(root,file))??'<파일 없음>');return hash.digest('hex')}
async function stageHash(directory,files){const hash=createHash('sha256');for(const file of [...files].sort()){if(!allowed(file))throw Error('지원하지 않는 갱신 파일입니다.');const data=await bytes(directory,'incoming/'+file);if(!data)throw Error('내려받은 파일이 없습니다.');hash.update(file+'\0').update(data)}return hash.digest('hex')}
async function requestOnce(path,{fetcher,signal},image=false){
 const timeout=AbortSignal.timeout(image?60_000:30_000),response=await fetcher(target.url+path+(image?'':(path.includes('?')?'&':'?')+'sync='+randomUUID()),{cache:'no-store',redirect:'error',signal:signal?AbortSignal.any([signal,timeout]):timeout});
 if(!response.ok){const error=Error('서버 자료를 받지 못했습니다 ('+response.status+'): '+path);error.retryable=response.status===429||response.status>=500;throw error}
 if(image&&!response.headers.get('content-type')?.startsWith('image/'))throw Error('이미지 응답이 아닙니다: '+path);
 const limit=image?50_000_000:20_000_000;let size=0;const parts=[];for await(const chunk of response.body){size+=chunk.length;if(size>limit)throw Error('서버 파일이 너무 큽니다: '+path);parts.push(Buffer.from(chunk))}const data=Buffer.concat(parts);if(!size)throw Error('빈 서버 파일입니다: '+path);return image?data:JSON.parse(data.toString('utf8'));
}
async function request(path,options,image=false){
 for(let attempt=0;attempt<3;attempt++)try{return await requestOnce(path,options,image)}catch(error){
  if(options.signal?.aborted)throw Error('다운로드를 취소했습니다.');
  const transient=error.retryable||['TimeoutError','AbortError'].includes(error.name)||error instanceof TypeError;
  if(!transient||attempt===2)throw Error('다운로드 실패: '+path+' · '+error.message);
  options.progress?.('다운로드 재시도 ('+(attempt+2)+'/3): '+path);
  await new Promise(resolve=>setTimeout(resolve,300*(attempt+1)));
 }
}
function checkItems(value){if(!Array.isArray(value?.items)||value.items.length>5000)throw Error('서버 목록 형식이 올바르지 않습니다.');const ids=value.items.map(p=>p?.id);if(ids.some(id=>typeof id!=='string'||id.length>100||!idPattern.test(id))||new Set(ids).size!==ids.length)throw Error('서버 식별자가 중복되었거나 올바르지 않습니다.');return ids}
export async function prepareSync(project,{fetcher=fetch,progress=()=>{},signal}={}){
 const root=await realpath(project);validateTarget(JSON.parse(await readFile(join(root,'wrangler.jsonc'),'utf8')));
 progress('서버의 공개 기억·포트레이트 목록을 확인하는 중');
 const options={fetcher,signal,progress},memories=checkItems(await request('/api/memories',options)),portraits=checkItems(await request('/api/portraits',options));
 if(!memories.length&&!portraits.length)throw Error('서버 공개 자료가 비어 있어 전체 갱신을 중단했습니다.');
 const files=new Map(),images=new Set();
 for(const [kind,ids]of [['memories',memories],['portraits',portraits]])for(const [index,id]of ids.entries()){
  progress((kind==='memories'?'기억':'포트레이트')+' 상세 자료 다운로드 ('+(index+1)+'/'+ids.length+')');
  const record=await request('/api/'+kind+'/'+id,options);if(record?.id!==id)throw Error('서버 상세 자료의 식별자가 다릅니다.');
  if(kind==='memories'){globalThis.EditorModel.validate(record);if(!Array.isArray(record.skills)||!Array.isArray(record.limit_breaks))throw Error('서버 기억 상세 자료가 불완전합니다.')}else globalThis.PortraitModel.validate(record);
  for(const key of kind==='memories'?['image','illustration_url','thumbnail_url']:['image_url','thumbnail_url','source_image'])if(record[key]){
   const value=record[key];if(typeof value!=='string')throw Error('서버 이미지 경로 형식이 올바르지 않습니다.');
   if(value.startsWith('/')&&!value.startsWith('//')||value.startsWith(target.url+'/')){const local=value.startsWith('/')?value:value.slice(target.url.length);if(!allowed('public'+local)||!local.startsWith('/images/'))throw Error('지원하지 않는 이미지 경로입니다: '+value);images.add('public'+local)}else{const url=new URL(value);if(url.protocol!=='https:')throw Error('외부 이미지 주소가 올바르지 않습니다.')}
  }
  files.set('data/'+kind+'/'+id+'.json',encode(record));
 }
 progress('캐릭터 공통 자료를 내려받는 중');
 const characters=await request('/characters.json',options);if(!Array.isArray(characters)||characters.some(v=>!v||typeof v!=='object'||Array.isArray(v)||typeof v.character_ko!=='string'||['character_ja','character_group','voice_actor','voice_actor_url'].some(key=>v[key]!=null&&typeof v[key]!=='string')))throw Error('서버 캐릭터 공통 자료 형식이 올바르지 않습니다.');
 files.set('public/characters.json',encode(characters));
 const before=await fingerprint(root,[...images]);
 progress('연결 이미지 다운로드 (0/'+images.size+')');
 // 모든 다운로드와 검증을 마칠 때까지 로컬 원본은 변경하지 않습니다.
 let size=0,cursor=0,completed=0,downloadError;const queue=[...images],stop=new AbortController(),imageOptions={...options,signal:signal?AbortSignal.any([signal,stop.signal]):stop.signal};
 async function downloadImages(){try{while(cursor<queue.length){const file=queue[cursor++];if(imageOptions.signal.aborted)throw Error('다운로드를 취소했습니다.');const data=await request(file.slice('public'.length),imageOptions,true);size+=data.length;if(size>512_000_000)throw Error('이미지 합계가 512MB를 넘어 갱신을 중단했습니다.');files.set(file,data);progress('연결 이미지 다운로드 ('+(++completed)+'/'+images.size+')')}}catch(error){downloadError??=error;stop.abort()}}
 await Promise.all(Array.from({length:Math.min(4,queue.length)},downloadImages));if(downloadError)throw downloadError;
 const changes={added:0,updated:0,removed:0,unchanged:0};for(const [file,data]of files){const previous=await bytes(root,file);changes[previous===null?'added':previous.equals(data)?'unchanged':'updated']++}for(const file of await localRecords(root))if(!files.has(file))changes.removed++;
 const base=await safe(root,'.editor-jobs');await mkdir(base,{recursive:true});const directory=await mkdtemp(join(base,'sync-'));
 for(const [file,data]of files){const dest=await safe(directory,'incoming/'+file);await mkdir(dirname(dest),{recursive:true});await writeFile(dest,data)}
 const plan={id:randomUUID(),root,directory,url:target.url,count:memories.length,portraitCount:portraits.length,imageCount:images.size,changes,files:[...files.keys()],localHash:before,hash:await stageHash(directory,[...files.keys()]),createdAt:new Date().toISOString()};await writeFile(join(directory,'plan.json'),encode(plan));return plan;
}
export async function applySync(project,planPath,{progress=()=>{},signal,beforeWrite=async()=>{}}={}){
 const root=await realpath(project),absolute=resolve(planPath),base=await safe(root,'.editor-jobs'),rel=relative(base,absolute);
 if(!/^sync-[^/\\]+[/\\]plan\.json$/.test(rel))throw Error('갱신 준비 자료 경로가 올바르지 않습니다.');await safe(root,relative(root,absolute));
 const plan=JSON.parse(await readFile(absolute,'utf8')),directory=dirname(absolute);if(plan.root!==root||resolve(plan.directory)!==directory||plan.url!==target.url||!Array.isArray(plan.files)||!plan.files.length||new Set(plan.files).size!==plan.files.length||plan.files.some(f=>typeof f!=='string'||!allowed(f)))throw Error('갱신 준비 자료가 올바르지 않습니다.');
 validateTarget(JSON.parse(await readFile(join(root,'wrangler.jsonc'),'utf8')));
 if(await stageHash(directory,plan.files)!==plan.hash)throw Error('내려받은 자료가 변경되었습니다. 다시 갱신 준비를 진행해 주세요.');
 const images=plan.files.filter(f=>imagePath.test(f));if(await fingerprint(root,images)!==plan.localHash)throw Error('준비 후 로컬 자료가 변경되었습니다. 다시 갱신 준비를 진행해 주세요.');
 const affected=[...new Set([...plan.files,...await localRecords(root)])].sort();
 progress('갱신 전 로컬 자료를 백업하는 중');const backupBase=await safe(root,'data/editor-backups/server-sync');await mkdir(backupBase,{recursive:true});const backup=await mkdtemp(join(backupBase,'sync-')),originals=new Map();
 for(const file of affected){const data=await bytes(root,file);originals.set(file,data);if(data!==null){const dest=await safe(backup,file);await mkdir(dirname(dest),{recursive:true});await writeFile(dest,data)}}
 await writeFile(join(backup,'복원목록.json'),encode({createdAt:new Date().toISOString(),root,files:affected,absent:affected.filter(f=>originals.get(f)===null)}));
 if(await fingerprint(root,images)!==plan.localHash)throw Error('백업 중 로컬 자료가 변경되었습니다. 갱신하지 않았습니다.');
 if(signal?.aborted)throw Error('갱신을 취소했습니다. 로컬 자료는 변경하지 않았습니다.');
 const changed=[];let committed=false;
 try{
  progress('백업 완료 · 로컬 자료 교체 중');
  for(const file of affected){if(signal?.aborted)throw Error('갱신이 취소되었습니다.');await beforeWrite(file);const dest=await safe(root,file);changed.push(file);if(plan.files.includes(file)){await mkdir(dirname(dest),{recursive:true});const temp=dest+'.'+randomUUID()+'.tmp';try{await writeFile(temp,await bytes(directory,'incoming/'+file),{flag:'wx'});await rename(temp,dest)}finally{await rm(temp,{force:true})}}else await rm(dest,{force:true})}
  committed=true;
 }catch(error){
  const failures=[];for(const file of changed.reverse())try{const dest=await safe(root,file),data=originals.get(file);if(data===null)await rm(dest,{force:true});else await writeFile(dest,data)}catch{failures.push(file)}
  throw Error((failures.length?'자동 복원에 실패한 파일: '+failures.join(', '):'갱신을 중단하고 기존 로컬 자료를 복원했습니다.')+' 백업: '+backup+' · '+error.message);
 }
 const result={count:plan.count,portraitCount:plan.portraitCount,imageCount:images.length,backup,finishedAt:new Date().toISOString()};
 if(committed){try{await writeFile(join(backup,'갱신완료.json'),encode(result))}catch{}}
 return result;
}
