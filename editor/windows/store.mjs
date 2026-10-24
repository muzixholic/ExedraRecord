import {readFile,writeFile,readdir,mkdir,stat,realpath,rename,rm} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute,dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import './ui/character-groups.js';
import './ui/model.js';
import './ui/affiliations.js';
import './service/portrait-model.js';
const model=globalThis.EditorModel,affiliations=globalThis.ExedraAffiliations;
const hash=data=>createHash('sha256').update(data).digest('hex');
const encode=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const normalized=value=>typeof value==='string'?value.normalize('NFKC').replace(/\s+/gu,'').toLowerCase():'';
export const sameCharacter=(a,b)=>globalThis.ExedraCharacters.sameCharacter(a,b);
export function validate(memory){
 model.validate(memory);
 if(!Array.isArray(memory.skills)||!Array.isArray(memory.limit_breaks)||[...memory.skills,...memory.limit_breaks].some(k=>!k||typeof k!=='object'||Array.isArray(k)))throw Error('스킬과 한계돌파 자료 형식을 확인해 주세요.');
 for(const key of ['HP','공격력','방어력','스피드'])if(typeof memory.stats[key]!=='number')throw Error('능력치는 숫자로 저장해야 합니다.');
 const work=memory.work||'',groups=affiliations.groupsFor(memory);
 if(memory.groups!==undefined&&(!Array.isArray(memory.groups)||memory.groups.some(v=>typeof v!=='string')))throw Error('그룹 목록 형식을 확인해 주세요.');
 if(work&&!affiliations.works.some(k=>k.id===work)||work==='magia-record'&&(!groups.length||groups.some(id=>!affiliations.groups.some(k=>k.id===id)))||work!=='magia-record'&&groups.length)throw Error('작품과 그룹을 확인해 주세요. 마기아 레코드는 그룹을 하나 이상 선택해야 합니다.');
 if(memory.voice_actor!=null&&typeof memory.voice_actor!=='string')throw Error('성우 이름을 입력해 주세요.');
 if(memory.voice_actor_url!=null&&typeof memory.voice_actor_url!=='string')throw Error('성우 문서 주소를 확인해 주세요.');
 if(memory.voice_actor_url){let u;try{u=new URL(memory.voice_actor_url)}catch{throw Error('성우 문서 주소를 확인해 주세요.')}
  if(u.protocol!=='https:'||u.username||u.password||u.port||!['namu.wiki','ko.wikipedia.org','ja.wikipedia.org'].includes(u.hostname)||!u.pathname.startsWith(u.hostname==='namu.wiki'?'/w/':'/wiki/')||u.pathname.split('/').filter(Boolean).length<2||!memory.voice_actor?.trim())throw Error('성우 이름과 나무위키 또는 한국어·일본어 위키백과 문서 주소를 입력해 주세요.');
 }
}
async function optional(path){try{return await readFile(path)}catch(error){if(error.code==='ENOENT')return null;throw error}}
async function atomic(path,data){const temp=path+'.'+randomUUID()+'.tmp';try{await writeFile(temp,data,{flag:'wx'});await rename(temp,path)}finally{await rm(temp,{force:true})}}
export class MemoryStore{
 static async open(path){const root=await realpath(path);for(const dir of ['data/memories','public/images','migrations'])if(!(await stat(join(root,dir))).isDirectory())throw Error('ExedraRecord 프로젝트 폴더를 선택해 주세요.');return new MemoryStore(root)}
 constructor(root){this.table='memories';this.recordFolder='memories';this.root=root;this.charactersFile=join(root,'public','characters.json')}
 async safe(path,base=this.root){const absolute=resolve(path),rel=relative(base,absolute);if(rel.startsWith('..')||isAbsolute(rel))throw Error('허용된 자료 경로가 아닙니다.');let actual;try{actual=await realpath(absolute)}catch(error){if(error.code!=='ENOENT')throw error;actual=join(await realpath(dirname(absolute)),absolute.slice(dirname(absolute).length+1))}const realRel=relative(await realpath(base),actual);if(realRel.startsWith('..')||isAbsolute(realRel))throw Error('허용된 자료 경로가 아닙니다.');return absolute}
 async file(id){if(typeof id!=='string'||id.length>100||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))throw Error('식별자 형식을 확인해 주세요.');return this.safe(join(this.root,'data',this.recordFolder,id+'.json'),join(this.root,'data',this.recordFolder))}
 async common(){await this.safe(this.charactersFile);const data=await optional(this.charactersFile);const list=data?JSON.parse(data):[];if(!Array.isArray(list)||list.some(k=>!k||typeof k!=='object'||Array.isArray(k)))throw Error('캐릭터 공통 자료 형식을 확인해 주세요.');return {data,list}}
 async load(){const common=await this.common(),entries=[];for(const name of (await readdir(join(this.root,'data',this.recordFolder))).filter(v=>v.endsWith('.json')).sort()){
  const path=await this.file(name.slice(0,-5)),data=await readFile(path),memory=JSON.parse(data);if(memory.id+'.json'!==name)throw Error('기억 파일명과 식별자가 다릅니다.');const shared=!memory.voice_actor_override&&ExedraCharacters.shared(memory,common.list);if(shared){memory.voice_actor=shared.voice_actor||'';memory.voice_actor_url=shared.voice_actor_url||''}entries.push({memory,revision:hash(Buffer.concat([data,common.data||Buffer.alloc(0)]))});
 }return entries}
 async backup(name,data){if(!data)return;const dir=join(this.root,'data/editor-backups',...(this.table==='portraits'?['portraits',name]:[name]));await mkdir(dir,{recursive:true});await this.safe(dir);await writeFile(join(dir,randomUUID()+'.json'),data,{flag:'wx'})}
 validate(memory){return validate(memory)}
 async save(memory,expected){this.validate(memory);const path=await this.file(memory.id),previous=await optional(path),common=await this.common();if(previous){if(!expected||expected!==hash(Buffer.concat([previous,common.data||Buffer.alloc(0)])))throw Error('다른 곳에서 변경된 자료이거나 같은 식별자가 있습니다. 다시 불러온 뒤 수정해 주세요.')}else if(expected)throw Error('원본 파일이 사라졌습니다. 다시 불러와 주세요.');await this.backup(memory.id,previous);
  let shared=common.data;if(this.table==='memories'&&!memory.voice_actor_override&&('voice_actor'in memory||'voice_actor_url'in memory)){const found=ExedraCharacters.shared(memory,common.list),i=found?common.list.indexOf(found):-1;const value={character_ko:found?.character_ko||memory.character_ko,character_ja:found?.character_ja||memory.character_ja||'',character_group:ExedraCharacters.key(memory),voice_actor:memory.voice_actor||'',voice_actor_url:memory.voice_actor_url||''};if(i<0)common.list.push(value);else common.list[i]=value;shared=encode(common.list);await this.backup('characters',common.data)}
  const data=encode(memory);try{await atomic(path,data);if(shared)await atomic(this.charactersFile,shared)}catch(error){if(previous)await atomic(path,previous);else await rm(path,{force:true});if(this.table==='memories'){if(common.data)await atomic(this.charactersFile,common.data);else await rm(this.charactersFile,{force:true})}throw error}
  return hash(Buffer.concat([data,shared||Buffer.alloc(0)]));
 }
 async localAsset(path){if(typeof path!=='string'||!path.startsWith('/images/')||path.includes('..')||path.includes('\\'))throw Error('프로젝트 이미지 경로를 확인해 주세요.');return this.safe(join(this.root,'public',path.slice(1)),join(this.root,'public/images'))}
 async exportMigration(){const entries=await this.load();if(!entries.length)throw Error('내보낼 기억이 없습니다.');const lines=['-- 기억 입력 도구에서 만든 자료입니다. 원격 DB에는 아직 반영되지 않았습니다.'];if(this.table==='portraits')lines.push('CREATE TABLE IF NOT EXISTS portraits (id TEXT PRIMARY KEY, payload TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 1);');for(const {memory}of entries){this.validate(memory);lines.push("INSERT INTO "+this.table+"(id,payload,published) VALUES ('"+memory.id+"','"+JSON.stringify(memory).replaceAll("'","''")+"',1) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,published=excluded.published;")};const dir=join(this.root,'migrations'),max=Math.max(0,...(await readdir(dir)).map(name=>Number(name.match(/^\d+/)?.[0]||0)));const path=await this.safe(join(dir,String(max+1).padStart(4,'0')+'_editor.sql'));await writeFile(path,lines.join('\n')+'\n',{flag:'wx'});return path}
}

export class PortraitStore extends MemoryStore {
 constructor(root){super(root);this.table='portraits';this.recordFolder='portraits'}
 async ensure(){await mkdir(join(this.root,'data','portraits'),{recursive:true});await this.safe(join(this.root,'data','portraits'))}
 async common(){return {data:null,list:[]}}
 validate(p){return globalThis.PortraitModel.validate(p)}
 async load(){await this.ensure();return super.load()}
 async save(p,expected){await this.ensure();return super.save(globalThis.PortraitModel.normalized(p),expected)}
}
