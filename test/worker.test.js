import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
test('공개된 자료 반환',async()=>{let sql;const response=await worker.fetch(new Request('https://example.com/api/memories'),{DB:{prepare(s){sql=s;return{async all(){return{results:[{payload:JSON.stringify({id:'확인용'})}]}}}}}});assert.equal(response.status,200);assert.match(sql,/published = 1/);assert.match(sql,/json_extract\(payload,'\$\.illustration_url'\)/);assert.match(sql,/json_extract\(payload,'\$\.thumbnail_url'\)/);assert.deepEqual(await response.json(),{items:[{id:'확인용'}]})});
test('쓰기 요청 차단',async()=>{const response=await worker.fetch(new Request('https://example.com/api/memories',{method:'POST'}),{});assert.equal(response.status,405)});
test('알 수 없는 API는 404',async()=>{assert.equal((await worker.fetch(new Request('https://example.com/api/unknown'),{})).status,404)});
test('DB 장애 시 내부 정보 보호',async()=>{const response=await worker.fetch(new Request('https://example.com/api/memories'),{DB:{prepare(){throw Error('비밀 연결 정보')}}});assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/비밀/) });
test('상세 자료는 식별자를 바인딩하고 공개 조건으로 조회한다',async()=>{
 let sql,bound;
 const response=await worker.fetch(new Request('https://example.com/api/memories/sorana-aqua-tempest'),{DB:{prepare(s){sql=s;return {bind(id){bound=id;return {async first(){return {payload:JSON.stringify({id,skills:[{ko:'전체 설명'}]})}}}}}}}});
 assert.equal(response.status,200);assert.equal(bound,'sorana-aqua-tempest');assert.match(sql,/id = \? AND published = 1/);assert.equal((await response.json()).skills[0].ko,'전체 설명');
});
test('없는 기억이나 비공개 기억은 상세에서 404',async()=>{
 const response=await worker.fetch(new Request('https://example.com/api/memories/missing'),{DB:{prepare(){return {bind(){return {async first(){return null}}}}}}});assert.equal(response.status,404);
});
