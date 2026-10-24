import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import '../editor/windows/prepare.mjs';
const {MemoryStore,validate}=await import('../editor/windows/store.mjs');
const {executableCandidates}=await import('../editor/service/runner.mjs');
async function fixture(fn){const root=await mkdtemp(join(tmpdir(),'exedra-윈도 저장 검증-'));try{for(const path of ['data/memories','public/images','migrations'])await mkdir(join(root,path),{recursive:true});await fn(await MemoryStore.open(root),root)}finally{await rm(root,{recursive:true,force:true})}}
function memory(id='test-memory'){return {...globalThis.EditorModel.blank(id),character_ko:'확인용',character_ja:'確認用',name_ko:'확인 기억',stats:{HP:100,공격력:20,방어력:30,스피드:100},work:'magia-record',groups:['mikazuki','yachiyo'],voice_actor:'확인 성우',voice_actor_url:'https://namu.wiki/w/성우',future:{유지:true}}}
test('윈도 저장소는 수정·백업·자료 보존·동시 변경 충돌을 처리한다',()=>fixture(async(store,root)=>{
 const k=memory(),revision=await store.save(k,null);await assert.rejects(store.save(k,null),/식별자|변경/);k.name_ko='수정';await store.save(k,revision);const loaded=(await store.load())[0];assert.equal(loaded.memory.name_ko,'수정');assert.deepEqual(loaded.memory.future,{유지:true});assert.deepEqual(loaded.memory.groups,['mikazuki','yachiyo']);await assert.rejects(store.save(k,revision),/변경/);assert.ok((await readFile(join(root,'data/memories/test-memory.json'),'utf8')).includes('수정'));
}));
test('윈도 저장소는 캐릭터 공통 성우와 그 수정의 충돌을 감지한다',()=>fixture(async(store)=>{
 const k=memory();await store.save(k,null);const sibling=memory('sibling');delete sibling.voice_actor;delete sibling.voice_actor_url;await store.save(sibling,null);const before=await store.load(),active=before.find(k=>k.memory.id==='test-memory');active.memory.voice_actor='다른 성우';await store.save(active.memory,active.revision);const after=await store.load();assert.ok(after.every(k=>k.memory.voice_actor==='다른 성우'));await assert.rejects(store.save(before.find(k=>k.memory.id==='sibling').memory,before.find(k=>k.memory.id==='sibling').revision),/변경/);
}));
test('윈도 저장소는 잘못된 소속·성우 링크·경로를 거부한다',()=>fixture(async(store)=>{
 const k=memory();for(const groups of [[],['unknown'],'mikazuki'])assert.throws(()=>validate({...k,groups}));assert.throws(()=>validate({...k,work:'madoka'}));assert.throws(()=>validate({...k,voice_actor_url:'javascript:alert(1)'}));await assert.rejects(store.file('../escape'));await assert.rejects(store.localAsset('/images/../../secret'));await assert.rejects(store.localAsset('/images/..\\secret'));assert.ok((await store.localAsset('/images/test.png')).endsWith('test.png'));
}));
test('윈도 저장소는 SQL 인용과 내보내기 순번을 보존한다',()=>fixture(async(store)=>{
 const k=memory();k.name_ko="기억 '인용'";await store.save(k,null);const first=await store.exportMigration();assert.ok((await readFile(first,'utf8')).includes("''인용''"));assert.ok((await store.exportMigration()).endsWith('0002_editor.sql'));
}));
test('윈도 실행 파일 탐색은 exe와 npm cmd를 찾고 맥 탐색은 유지한다',()=>{assert.deepEqual(executableCandidates('codex','win32'),['codex.exe','codex.cmd','codex']);assert.deepEqual(executableCandidates('codex','darwin'),['codex'])});
test('윈도 저장소는 이미지 심볼릭 링크를 통한 외부 접근을 막는다',{skip:process.platform==='win32'},()=>fixture(async(store,root)=>{
 const outside=await mkdtemp(join(tmpdir(),'exedra-outside-'));try{await writeFile(join(outside,'secret.png'),'비공개');await symlink(outside,join(root,'public/images/linked'));await assert.rejects(store.localAsset('/images/linked/secret.png'),/허용/)}finally{await rm(outside,{recursive:true,force:true})}
}));
test('윈도 포트레이트 저장은 기억·공통 성우와 분리하고 이름·복수 효과·백업을 보존한다',()=>fixture(async(store,root)=>{
 const {PortraitStore}=await import('../editor/windows/store.mjs'),portraits=new PortraitStore(root),p=globalThis.PortraitModel.blank('test-portrait');p.name_ko='이름+5';p.name_ja='名前+5';p.stats_max={HP:100,공격력:20,방어력:30};p.ability_levels[0].effects=[{text_ko:'공격력 +5%',text_ja:'',condition_ko:'특정 캐릭터',condition_ja:'',tags:['공격력']}];await store.save(memory(),null);const commonBefore=await readFile(join(root,'public/characters.json'),'utf8');const revision=await portraits.save(p,null);p.name_ko='수정+5';await portraits.save(p,revision);await assert.rejects(portraits.save(p,revision),/변경/);const loaded=(await portraits.load())[0];assert.equal(loaded.memory.name_ko,'수정');assert.equal(loaded.memory.ability_levels[0].effects[0].condition_ko,'특정 캐릭터');assert.equal(await readFile(join(root,'public/characters.json'),'utf8'),commonBefore);assert.match(await readFile(await portraits.exportMigration(),'utf8'),/INSERT INTO portraits/);
}));

test('윈도 저장소는 바리에이션 그룹 성우 변경과 개별 성우를 분리하고 기본 표시명을 보존한다',()=>fixture(async(store,root)=>{
 const base={...memory('homura-base'),character_ko:'아케미 호무라',character_ja:'暁美ほむら',character_group:'akemi-homura'};await store.save(base,null);
 const devil={...memory('homura-devil'),character_ko:'악마 호무라',character_ja:'悪魔ほむら',character_group:'akemi-homura',voice_actor:'개별 성우',voice_actor_override:true};await store.save(devil,null);
 let entries=await store.load();assert.equal(entries.find(k=>k.memory.id===devil.id).memory.voice_actor,'개별 성우');assert.equal(entries.find(k=>k.memory.id===base.id).memory.voice_actor,'확인 성우');
 const shared=entries.find(k=>k.memory.id===base.id);shared.memory.voice_actor='그룹 수정';await store.save(shared.memory,shared.revision);
 entries=await store.load();assert.equal(entries.find(k=>k.memory.id===devil.id).memory.voice_actor,'개별 성우');
 const variant=entries.find(k=>k.memory.id===devil.id);variant.memory.voice_actor_override=false;variant.memory.voice_actor='그룹 재수정';await store.save(variant.memory,variant.revision);
 entries=await store.load();assert.ok(entries.every(k=>k.memory.voice_actor==='그룹 재수정'));assert.equal(entries.find(k=>k.memory.id===devil.id).memory.character_ko,'악마 호무라');
 const common=JSON.parse(await readFile(join(root,'public/characters.json'),'utf8'));assert.equal(common.length,1);assert.equal(common[0].character_ko,'아케미 호무라');assert.equal(common[0].character_group,'akemi-homura');
}));
