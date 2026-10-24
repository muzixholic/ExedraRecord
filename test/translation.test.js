import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
const directory=new URL('../data/memories/',import.meta.url);
const files=(await readdir(directory)).filter(name=>name.endsWith('.json'));
const records=await Promise.all(files.map(async name=>JSON.parse(await readFile(new URL(name,directory),'utf8'))));
test('기억 식별자는 고유하고 원본 이미지가 존재한다',async()=>{
 assert.equal(new Set(records.map(k=>k.id)).size,records.length);
 for(const k of records)await access(new URL('../public'+k.image,import.meta.url));
});
for(const record of records)test(record.character_ko+' · '+record.name_ko+' 원문·번역 수치와 전체 돌파 단계 검증',()=>{
 assert.deepEqual(record.limit_breaks.map(b=>b.stage),[1,2,3,4,5]);
 for(const block of [...record.skills,...record.limit_breaks]){
  assert.ok(block.ja&&block.ko);
  assert.deepEqual(block.ko.match(/[+-]?\d+(?:\.\d+)?%?/g),block.ja.match(/[+-]?\d+(?:\.\d+)?%?/g),block.kind||block.stage+'단계');
 }
 assert.equal(record.pending.length,0);
 assert.match(record.verification,/검수 대기/);
});
test('입수 구분과 소라나 배포 여부를 보존한다',()=>{
 for(const k of records)assert.ok(['한정','통상','배포'].includes(k.acquisition));
 const sorana=records.find(k=>k.id==='sorana-aqua-tempest');
 assert.equal(sorana.acquisition,'배포');
 assert.equal(sorana.limited,false);
});

test('일괄 추가한 기억 19개가 기존 자료와 함께 보존된다',()=>{
 assert.equal(records.length,24);
 const homura=records.filter(k=>k.character_ja==='暁美ほむら');assert.equal(homura.length,3);
 const adjacent=records.find(k=>k.id==='homura-black-magic-suppression');assert.equal(adjacent.skills.find(s=>s.kind==='필살기').adjacent_break,20);assert.equal(adjacent.skills.find(s=>s.kind==='전투 스킬').adjacent_break,10);
});
