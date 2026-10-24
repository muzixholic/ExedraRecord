import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../editor/ui/model.js';
const model=globalThis.EditorModel;
function fixture(){const k=model.blank('test-memory');k.character_ko='확인용 캐릭터';k.name_ko='확인용 기억';k.stats={HP:'100',공격력:'20',방어력:'30',스피드:'100'};return k}
test('입력 도구의 새 기억은 수치를 추정하지 않고 다섯 한계돌파 단계를 만든다',()=>{const k=model.blank('new-memory');assert.equal(k.stats.HP,'');assert.equal(k.limit_breaks.length,5);assert.throws(()=>model.normalized(k));assert.deepEqual(model.elements,['불속성','물속성','나무속성','빛속성','어둠속성','무속성'])});
test('입력 자료 정규화는 확장 필드를 보존하고 입수 구분을 맞춘다',()=>{const k=fixture();k.acquisition='배포';k.future_field={유지:true};const result=model.normalized(k);assert.equal(result.limited,false);assert.equal(result.stats.HP,100);assert.deepEqual(result.future_field,{유지:true});assert.equal(k.stats.HP,'100')});
test('입력 도구는 잘못된 수치와 식별자·유튜브 주소를 거부한다',()=>{for(const value of ['',-1,'1.5','NaN','Infinity','1e3']){const k=fixture();k.stats.HP=value;assert.throws(()=>model.normalized(k))}const k=fixture();k.id='../bad';assert.throws(()=>model.normalized(k));k.id='test-memory';k.pv_url='https://youtube.com.evil.test/watch?v=M7lc1UVf-VE';assert.throws(()=>model.normalized(k));k.pv_url='https://youtu.be/M7lc1UVf-VE';assert.equal(model.normalized(k).pv_url,k.pv_url);assert.equal(model.numeric('','선택값',true),null)});
