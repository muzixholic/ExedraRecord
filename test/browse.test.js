import {test} from 'node:test';
import assert from 'node:assert/strict';
import {browse,parseRoute,listUrl,detailUrl} from '../public/browse.js';
const items=Array.from({length:125},(_,i)=>({id:'memory-'+i,character_ko:'캐릭터 '+String(i).padStart(3,'0'),character_ja:'原文'+i,name_ko:'기억 '+i,name_ja:'記憶'+i,role:i%2?'버퍼':'어태커',element:i%3?'물속성':'불속성',rarity:i%2?4:5,acquisition:i%2?'배포':'한정'}));
test('125개 기억을 중복이나 누락 없이 페이지로 나눈다',()=>{
 const seen=[];const first=browse(items,new URLSearchParams());assert.equal(first.pages,6);
 for(let page=1;page<=first.pages;page++){const result=browse(items,new URLSearchParams({page:String(page)}));assert.ok(result.items.length<=24);seen.push(...result.items.map(k=>k.id))}
 assert.equal(seen.length,125);assert.equal(new Set(seen).size,125);
});
test('검색·속성·역할·희귀도·입수 구분을 함께 적용한다',()=>{
 const result=browse(items,new URLSearchParams({q:'기억',element:'불속성',role:'버퍼',rarity:'4',acquisition:'배포'}));assert.equal(result.total,21);assert.ok(result.items.every(k=>k.role==='버퍼'&&k.element==='불속성'&&k.rarity===4&&k.acquisition==='배포'));
});
test('결과가 없거나 페이지 값이 잘못되어도 정상 범위를 유지한다',()=>{
 assert.equal(browse(items,new URLSearchParams({q:'없는 이름'})).total,0);
 for(const page of ['NaN','-1','1.5'])assert.equal(browse(items,new URLSearchParams({page})).page,1);
 assert.equal(browse(items,new URLSearchParams({page:'999'})).page,6);
});
test('상세 주소와 목록 복귀 주소에 검색·필터·페이지를 보존한다',()=>{
 const params=new URLSearchParams({q:'마도카',role:'디버퍼',page:'3'});const route=parseRoute(detailUrl('madoka-winctio-magica',params));assert.equal(route.id,'madoka-winctio-magica');assert.equal(route.params.get('q'),'마도카');assert.equal(route.params.get('page'),'3');assert.equal(listUrl(route.params),listUrl(params));
});
test('일본어 이름 검색과 희귀도 정렬을 지원한다',()=>{
 const result=browse(items,new URLSearchParams({q:'原文124'}));assert.equal(result.items[0].id,'memory-124');assert.equal(result.total,1);
 assert.ok(browse(items,new URLSearchParams({sort:'rarity'})).items.every(k=>k.rarity===5));
});
test('속성과 역할 내부는 OR, 두 그룹 사이는 AND로 적용한다',()=>{
 const fixture=[['불속성','어태커'],['물속성','브레이커'],['나무속성','어태커'],['불속성','힐러']].map(([element,role],i)=>({id:String(i),element,role,character_ko:'캐릭터',name_ko:'기억',rarity:5}));
 const params=new URLSearchParams();for(const value of ['불속성','물속성'])params.append('element',value);for(const value of ['어태커','브레이커'])params.append('role',value);
 assert.deepEqual(browse(fixture,params).items.map(k=>k.id),['0','1']);
 const restored=parseRoute(detailUrl('0',params));assert.deepEqual(restored.params.getAll('element'),['불속성','물속성']);assert.deepEqual(restored.params.getAll('role'),['어태커','브레이커']);
 assert.equal(browse(fixture,new URLSearchParams()).total,4);
});
test('필터는 게임 순서대로 모든 속성·역할·희귀도를 제공한다',async()=>{
 const {FILTER_ORDER,filterLabel}=await import('../public/browse.js');
 assert.deepEqual(FILTER_ORDER.element,['불속성','물속성','나무속성','빛속성','어둠속성','무속성']);
 assert.deepEqual(FILTER_ORDER.role.map(filterLabel),['어태커','브레이커','힐러','버퍼','디버퍼','디팬더']);
 assert.deepEqual(FILTER_ORDER.rarity,[5,4,3]);
});
