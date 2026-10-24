import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../public/affiliations.js';
import {browse,parseRoute,detailUrl} from '../public/browse.js';
test('작품 7개와 마기아 레코드 하위 그룹 10개를 게임 순서로 제공한다',()=>{const a=globalThis.ExedraAffiliations;assert.equal(a.works.length,7);assert.equal(a.groups.length,10);assert.equal(new Set(a.groups.map(k=>k.id)).size,10);assert.equal(a.groups[0].ja,'みかづき荘');assert.equal(a.groups.at(-1).ja,'無所属')});
test('작품·그룹 필터는 서로 AND로 적용하고 미등록 자료를 보존한다',()=>{const items=[{id:'one',character_ko:'가',work:'magia-record',group:'mikazuki'},{id:'two',character_ko:'나',work:'magia-record',group:'yachiyo'},{id:'three',character_ko:'다',work:'madoka'},{id:'four',character_ko:'라'}];assert.equal(browse(items,new URLSearchParams()).total,4);assert.equal(browse(items,new URLSearchParams('work=magia-record')).total,2);const params=new URLSearchParams('work=magia-record&group=mikazuki');assert.deepEqual(browse(items,params).items.map(k=>k.id),['one']);assert.equal(parseRoute(detailUrl('one',params)).params.get('group'),'mikazuki');assert.equal(browse(items,new URLSearchParams('work=madoka&group=mikazuki')).total,0)});
test('중복 소속은 배열로 읽고 선택한 그룹 중 하나라도 일치하면 표시한다',()=>{
 const a=globalThis.ExedraAffiliations;
 assert.deepEqual(a.groupsFor({group:'mikazuki'}),['mikazuki']);
 assert.deepEqual(a.groupsFor({group:'mikazuki',groups:[]}),[]);
 assert.deepEqual(a.groupsFor({groups:['mikazuki','yachiyo','mikazuki']}),['mikazuki','yachiyo']);
 const items=[{id:'yachiyo',character_ko:'야치요',work:'magia-record',groups:['mikazuki','yachiyo']},{id:'other',character_ko:'다른 캐릭터',work:'magia-record',groups:['nanaka']},{id:'legacy',character_ko:'이전 자료',work:'magia-record',group:'mikazuki'}];
 for(const group of ['mikazuki','yachiyo'])assert.ok(browse(items,new URLSearchParams('group='+group)).items.some(k=>k.id==='yachiyo'));
 assert.equal(browse(items,new URLSearchParams('group=mikazuki&group=yachiyo')).total,2);
 assert.equal(browse(items,new URLSearchParams('group=yachiyo&group=nanaka')).total,2);
 assert.equal(browse(items,new URLSearchParams('work=madoka&group=yachiyo')).total,0);
});
test('작품 복수 선택은 OR로 적용하고 그룹은 마기아 레코드에만 적용한다',()=>{
 const items=[{id:'madoka',character_ko:'가',work:'madoka'},{id:'magia-a',character_ko:'나',work:'magia-record',groups:['mikazuki']},{id:'magia-b',character_ko:'다',work:'magia-record',groups:['nanaka']},{id:'sorana',character_ko:'라',work:'sorana'}];
 assert.equal(browse(items,new URLSearchParams('work=madoka&work=magia-record')).total,3);
 const params=new URLSearchParams('work=madoka&work=magia-record&group=mikazuki');
 assert.deepEqual(browse(items,params).items.map(k=>k.id),['madoka','magia-a']);
 assert.deepEqual(parseRoute(detailUrl('magia-a',params)).params.getAll('work'),['madoka','magia-record']);
 assert.equal(browse(items,new URLSearchParams('group=mikazuki')).total,1);
});
