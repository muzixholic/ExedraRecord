import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,access,symlink,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareSync,applySync} from '../editor/service/server-sync.mjs';
import {target} from '../editor/service/deployment.mjs';
async function fixture(fn){
 const root=await mkdtemp(join(tmpdir(),'exedra-sync-'));
 try{
  for(const dir of ['data/memories','data/portraits','public/images'])await mkdir(join(root,dir),{recursive:true});
  await writeFile(join(root,'wrangler.jsonc'),JSON.stringify({account_id:target.account,name:target.name,main:'src/worker.js',assets:{directory:'./public'},d1_databases:[{binding:'DB',database_id:target.database}]}));
  await writeFile(join(root,'data/memories/local-only.json'),'로컬 초안');await writeFile(join(root,'public/characters.json'),'[]');await writeFile(join(root,'public/images/art.png'),'이전 이미지');await writeFile(join(root,'public/images/unused.png'),'사용 안 함');
  const memory={...EditorModel.blank('server-memory'),character_ko:'테스트',name_ko:'서버 기억',stats:{HP:1,공격력:2,방어력:3,스피드:100},image:'/images/art.png'};
  const portrait={...PortraitModel.blank('server-portrait'),name_ko:'서버 포트레이트',stats_max:{HP:1,공격력:2,방어력:3},image_url:'/images/art.png'};
  const routes={'/api/memories':{items:[{id:memory.id}]},'/api/portraits':{items:[portrait]},['/api/memories/'+memory.id]:memory,['/api/portraits/'+portrait.id]:portrait,'/characters.json':[{character_ko:'테스트',voice_actor:'성우'}],'/images/art.png':'서버 이미지'};
  const calls=[],fetcher=async url=>{const path=new URL(url).pathname;calls.push(path);const value=routes[path];return value===undefined?new Response('없음',{status:404}):new Response(typeof value==='string'?value:JSON.stringify(value),{headers:{'content-type':path.startsWith('/images/')?'image/png':'application/json'}})};
  await fn({root,memory,portrait,routes,fetcher,calls});
 }finally{await rm(root,{recursive:true,force:true})}
}
const planFile=plan=>join(plan.directory,'plan.json');
test('목록 요약 대신 상세를 받고 이미지를 중복 다운로드하지 않으며 준비 중 원본을 보존한다',()=>fixture(async({root,fetcher,calls})=>{
 const plan=await prepareSync(root,{fetcher});assert.equal(plan.count,1);assert.equal(plan.portraitCount,1);assert.equal(plan.imageCount,1);assert.equal(plan.changes.removed,1);assert.equal(calls.filter(p=>p==='/images/art.png').length,1);assert.ok(calls.includes('/api/memories/server-memory'));assert.equal(await readFile(join(root,'data/memories/local-only.json'),'utf8'),'로컬 초안');
}));
test('갱신은 로컬 전용 기록을 제거하고 모든 교체·삭제 파일을 백업한다',()=>fixture(async({root,fetcher,memory})=>{
 const plan=await prepareSync(root,{fetcher}),result=await applySync(root,planFile(plan));
 assert.deepEqual(JSON.parse(await readFile(join(root,'data/memories/server-memory.json'),'utf8')),memory);await assert.rejects(access(join(root,'data/memories/local-only.json')));assert.equal(await readFile(join(root,'public/images/art.png'),'utf8'),'서버 이미지');assert.equal(await readFile(join(root,'public/images/unused.png'),'utf8'),'사용 안 함');assert.equal(await readFile(join(result.backup,'data/memories/local-only.json'),'utf8'),'로컬 초안');assert.equal(await readFile(join(result.backup,'public/images/art.png'),'utf8'),'이전 이미지');assert.equal(JSON.parse(await readFile(join(root,'public/characters.json'),'utf8'))[0].voice_actor,'성우');assert.ok(JSON.parse(await readFile(join(result.backup,'복원목록.json'),'utf8')).absent.includes('data/memories/server-memory.json'));
}));
test('다운로드 실패는 로컬 원본을 바꾸지 않는다',()=>fixture(async({root,fetcher,routes})=>{
 delete routes['/images/art.png'];await assert.rejects(prepareSync(root,{fetcher}),/서버 자료를 받지/);assert.equal(await readFile(join(root,'data/memories/local-only.json'),'utf8'),'로컬 초안');
}));
test('빈 서버 목록은 전체 삭제로 처리하지 않는다',()=>fixture(async({root,fetcher,routes})=>{
 routes['/api/memories']={items:[]};routes['/api/portraits']={items:[]};await assert.rejects(prepareSync(root,{fetcher}),/비어/);
}));
test('중복·잘못된 서버 식별자를 차단한다',()=>fixture(async({root,fetcher,routes})=>{
 routes['/api/memories']={items:[{id:'../bad'}]};await assert.rejects(prepareSync(root,{fetcher}),/식별자/);
 routes['/api/memories']={items:[{id:'same'},{id:'same'}]};await assert.rejects(prepareSync(root,{fetcher}),/식별자/);
}));
test('상세 식별자 불일치와 불완전한 자료를 차단한다',()=>fixture(async({root,fetcher,memory})=>{
 memory.id='other';await assert.rejects(prepareSync(root,{fetcher}),/식별자/);memory.id='server-memory';delete memory.stats;await assert.rejects(prepareSync(root,{fetcher}));
}));
test('경로 이탈과 인코딩된 이미지 경로를 차단한다',()=>fixture(async({root,fetcher,memory})=>{
 for(const image of ['/images/../../secret','/images/%2e%2e/secret','/images/a\\b','/images/CON.png']){memory.image=image;await assert.rejects(prepareSync(root,{fetcher}),/이미지 경로/)}
}));
test('준비 후 로컬 편집·새 파일 추가가 있으면 갱신을 차단한다',()=>fixture(async({root,fetcher})=>{
 const plan=await prepareSync(root,{fetcher});await writeFile(join(root,'data/memories/new-draft.json'),'새 입력');await assert.rejects(applySync(root,planFile(plan)),/로컬 자료가 변경/);assert.equal(await readFile(join(root,'data/memories/new-draft.json'),'utf8'),'새 입력');
}));
test('내려받은 파일 변조와 다른 프로젝트 계획을 차단한다',()=>fixture(async({root,fetcher})=>{
 const plan=await prepareSync(root,{fetcher});await writeFile(join(plan.directory,'incoming/public/characters.json'),'[]');await assert.rejects(applySync(root,planFile(plan)),/내려받은 자료가 변경/);await assert.rejects(applySync(root,join(root,'plan.json')),/경로/);
}));
test('로컬 갱신 경로의 심볼릭 링크를 차단한다',()=>fixture(async({root,fetcher})=>{
 await rm(join(root,'public/images/art.png'));await symlink(join(root,'public/characters.json'),join(root,'public/images/art.png'));await assert.rejects(prepareSync(root,{fetcher}),/심볼릭 링크/);
}));
test('적용 중 오류가 나면 이미 교체·삭제한 파일까지 복원한다',()=>fixture(async({root,fetcher})=>{
 const plan=await prepareSync(root,{fetcher});let n=0;await assert.rejects(applySync(root,planFile(plan),{beforeWrite:async()=>{if(++n===4)throw Error('테스트 쓰기 실패')}}),/기존 로컬 자료를 복원/);assert.equal(await readFile(join(root,'data/memories/local-only.json'),'utf8'),'로컬 초안');await assert.rejects(access(join(root,'data/memories/server-memory.json')));assert.equal(await readFile(join(root,'public/images/art.png'),'utf8'),'이전 이미지');assert.equal(await readFile(join(root,'public/characters.json'),'utf8'),'[]');
}));
test('취소된 갱신은 교체 전에 중단한다',()=>fixture(async({root,fetcher})=>{
 const plan=await prepareSync(root,{fetcher});await assert.rejects(applySync(root,planFile(plan),{signal:AbortSignal.abort()}),/취소/);assert.equal(await readFile(join(root,'data/memories/local-only.json'),'utf8'),'로컬 초안');
}));
test('서버에서 HTML 오류 페이지를 이미지로 내려주면 중단한다',()=>fixture(async({root,fetcher})=>{
 await assert.rejects(prepareSync(root,{fetcher:async(url,options)=>new URL(url).pathname.startsWith('/images/')?new Response('<html>오류</html>',{headers:{'content-type':'text/html'}}):fetcher(url,options)}),/이미지 응답/);
}));
test('두 편집 화면과 맥·윈도 연결부에 갱신 절차를 연결한다',async()=>{
 for(const file of ['index.html','portraits.html']){const html=await readFile(new URL('../editor/ui/'+file,import.meta.url),'utf8');assert.match(html,/id="server-sync"/);assert.match(html,/src="server-sync.js"/)}
 for(const file of ['App.swift','windows/main.cjs','service/runner.mjs']){const source=await readFile(new URL('../editor/'+file,import.meta.url),'utf8');assert.match(source,/prepareSync/);assert.match(source,/applySync/)}
});

test('확인 화면을 취소하면 적용하지 않고, 확인할 때만 교체 후 목록을 갱신한다',async()=>{
 const {runInNewContext}=await import('node:vm');
 class Element{constructor(tag){this.tag=tag;this.children=[];this.style={};this.disabled=false}setAttribute(){}append(...items){this.children.push(...items)}showModal(){this.open=true}close(){this.open=false}focus(){this.focused=true}}
 const body=new Element('body'),button=new Element('button'),window={};const document={body,createElement:tag=>new Element(tag),querySelector:()=>button};
 runInNewContext(await readFile(new URL('../editor/ui/server-sync.js',import.meta.url),'utf8'),{window,document});
 const calls=[],pending=[];let dirty=false,reloaded=0;
 window.setupServerSync({native:async action=>{calls.push(action);return {count:1,portraitCount:1,imageCount:1,backup:'백업 폴더'}},online:async action=>{calls.push(action);return {count:1,portraitCount:1,imageCount:1,changes:{added:1,updated:1,removed:1,unchanged:0}}},run:task=>{const p=task();pending.push(p);return p},message:()=>{},isDirty:()=>dirty,reload:async()=>{reloaded++}});
 const dialog=body.children[0],[cancel,confirm]=dialog.children[3].children;
 await button.onclick();assert.equal(dialog.open,true);cancel.onclick();assert.deepEqual(calls,['prepareSync']);assert.equal(reloaded,0);
 await button.onclick();confirm.onclick();await Promise.all(pending);assert.deepEqual(calls,['prepareSync','prepareSync','applySync']);assert.equal(reloaded,1);
 dirty=true;await assert.rejects(button.onclick(),/먼저 저장/);assert.equal(calls.length,3);
});

test('일시적인 네트워크 오류는 재시도하고 준비를 완료한다',()=>fixture(async({root,fetcher})=>{
 let attempts=0;const plan=await prepareSync(root,{fetcher:async(url,options)=>{if(new URL(url).pathname==='/images/art.png'&&attempts++===0)throw TypeError('일시적 네트워크 오류');return fetcher(url,options)}});assert.equal(plan.imageCount,1);assert.equal(attempts,2);
}));

test('이미지는 원본 주소로 최대 네 개씩 내려받는다',()=>fixture(async({root,fetcher,memory,portrait,routes})=>{
 memory.illustration_url='/images/a.png';memory.thumbnail_url='/images/b.png';portrait.image_url='/images/c.png';portrait.thumbnail_url='/images/d.png';portrait.source_image='/images/e.png';for(const name of ['a','b','c','d','e'])routes['/images/'+name+'.png']='이미지';let active=0,peak=0;
 const plan=await prepareSync(root,{fetcher:async(url,options)=>{const u=new URL(url);if(!u.pathname.startsWith('/images/'))return fetcher(url,options);assert.equal(u.search,'');peak=Math.max(peak,++active);try{await new Promise(resolve=>setTimeout(resolve,10));return await fetcher(url,options)}finally{active--}}});assert.equal(plan.imageCount,6);assert.equal(peak,4);
}));
