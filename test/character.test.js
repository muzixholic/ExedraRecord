import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sameCharacter,relatedMemories,voiceActorLabel} from '../public/character.js';
import {detailUrl,parseRoute} from '../public/browse.js';
import '../editor/ui/model.js';
test('일본어 이름으로 동일 캐릭터를 묶고 공백과 전각 차이를 허용한다',()=>{assert.equal(sameCharacter({character_ja:'美樹 さやか'},{character_ja:'美樹　さやか'}),true);assert.equal(sameCharacter({character_ja:'タルトver.Ｆｉｎａｌ'},{character_ja:'タルトver.Final'}),true);assert.equal(sameCharacter({character_ja:'暁美ほむら',character_ko:'호무라'},{character_ja:'別人',character_ko:'호무라'}),false)});
test('일본어명이 없는 경우 한국어 이름을 쓰고 빈 이름과 부분 일치는 묶지 않는다',()=>{assert.equal(sameCharacter({character_ko:'미키 사야카'},{character_ja:'美樹さやか',character_ko:'미키사야카'}),true);assert.equal(sameCharacter({},{}),false);assert.equal(sameCharacter({character_ko:'미키 사야카'},{character_ko:'사야카'}),false)});
test('다른 기억은 현재 기억을 제외하고 목록 필터와 무관하게 전체 공개 목록에서 찾는다',()=>{const current={id:'one',character_ja:'美樹さやか',rarity:5};const items=[current,{id:'two',character_ja:'美樹さやか',name_ko:'다른 기억',element:'무속성',role:'어태커',rarity:5},{id:'three',character_ja:'別人',rarity:5}];assert.deepEqual(relatedMemories(current,items).map(k=>k.id),['two']);const params=new URLSearchParams('element=물속성&role=힐러&page=2');const link=detailUrl('two',params);assert.equal(parseRoute(link).params.get('element'),'물속성');assert.equal(parseRoute(link).params.get('page'),'2');assert.deepEqual(relatedMemories(current,[current]),[])});
test('성우는 입력한 텍스트를 사용하고 미등록·구버전 자료도 표시할 수 있다',()=>{assert.equal(voiceActorLabel({voice_actor:'  성우 이름 (원문)  '}),'성우 이름 (원문)');for(const value of [null,'',{},undefined])assert.equal(voiceActorLabel({voice_actor:value}),'미등록');const base=globalThis.EditorModel.blank('test-memory');assert.equal(base.voice_actor,'');base.voice_actor='입력한 성우';const draft={character_ko:'이름',character_ja:'名前',name_ko:'기억',name_ja:'記憶',rarity:5,element:'물속성',role:'버퍼',acquisition:'배포',stats:{HP:100,공격력:10,방어력:10,스피드:100},stats_note:'',skills:[],limit_breaks:[],review_notes:[]};assert.equal(globalThis.EditorModel.applyTranslation(base,draft,'').voice_actor,'입력한 성우')});

import {characterVoice,voiceActorUrl} from '../public/character.js';
test('공통 성우는 같은 캐릭터의 모든 기억에서 공유하고 빈 값으로도 해제한다',()=>{
 const common=[{character_ja:'美樹さやか',voice_actor:'성우',voice_actor_url:'https://namu.wiki/w/성우'}];
 for(const id of ['one','two'])assert.equal(characterVoice({id,character_ja:'美樹 さやか',voice_actor:'이전 이름'},common).voice_actor,'성우');
 assert.equal(characterVoice({character_ja:'別人',voice_actor:'다른 성우'},common).voice_actor,'다른 성우');
 assert.equal(characterVoice({character_ja:'美樹さやか',voice_actor:'이전 이름'},[{character_ja:'美樹さやか',voice_actor:''}]).voice_actor,'');
});
test('성우 문서 링크는 허용된 위키의 HTTPS 문서만 연결한다',()=>{
 for(const url of ['https://namu.wiki/w/성우','https://ko.wikipedia.org/wiki/성우','https://ja.wikipedia.org/wiki/声優'])assert.ok(voiceActorUrl(url));
 for(const url of ['javascript:alert(1)','https://namu.wiki.evil.test/w/test','https://evil.test/wiki/test','https://user@namu.wiki/w/test','http://namu.wiki/w/test','https://ko.wikipedia.org/','https://namu.wiki/w/'])assert.equal(voiceActorUrl(url),null);
});
