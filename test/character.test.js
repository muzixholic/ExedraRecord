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

test('표시 이름이 다른 두 바리에이션은 기본 캐릭터 그룹에 연결된다',()=>{
 const homura={id:'base',character_ko:'아케미 호무라',character_ja:'暁美ほむら',rarity:5},devil={id:'devil',character_ko:'악마 호무라',character_ja:'悪魔ほむら',rarity:5};
 assert.equal(sameCharacter(homura,devil),true);assert.equal(relatedMemories(homura,[homura,devil])[0].character_ko,'악마 호무라');
 assert.equal(sameCharacter({character_ja:'鹿目まどか'},{character_ko:'얼티밋 마도카',character_ja:'アルティメットまどか'}),true);
 assert.equal(sameCharacter(homura,{character_ja:'鹿目まどか'}),false);
});
test('직접 지정한 그룹은 이름이 달라도 연결하고 서로 다른 명시 그룹은 분리한다',()=>{
 assert.equal(sameCharacter({character_ja:'原名',character_group:'custom-one'},{character_ja:'別名',character_group:'custom-one'}),true);
 assert.equal(sameCharacter({character_ja:'同名',character_group:'one'},{character_ja:'同名',character_group:'two'}),false);
 const labels=ExedraCharacters.choices([{character_ja:'別名',character_ko:'바리에이션',character_group:'ja:原名'},{character_ja:'原名',character_ko:'기본 캐릭터'}]);assert.equal(labels.find(k=>k.id==='ja:原名').label,'기본 캐릭터');
});
test('바리에이션은 그룹 공통 성우를 쓰고 개별 성우 지정은 그대로 보존한다',()=>{
 const common=[{character_ja:'暁美ほむら',voice_actor:'그룹 성우',voice_actor_url:'https://namu.wiki/w/성우'}];
 const devil={character_ja:'悪魔ほむら',voice_actor:'개별 성우',voice_actor_url:'https://ja.wikipedia.org/wiki/声優'};
 assert.equal(characterVoice(devil,common).voice_actor,'그룹 성우');assert.deepEqual(characterVoice({...devil,voice_actor_override:true},common),{...devil,voice_actor_override:true});
 assert.equal(EditorModel.findVoice(devil,common).voice_actor,'그룹 성우');
});
test('그룹 규칙 사본과 입력 검증은 웹과 입력툴에서 동일하다',async()=>{
 const {readFile}=await import('node:fs/promises');assert.equal(await readFile(new URL('../public/character-groups.js',import.meta.url),'utf8'),await readFile(new URL('../editor/ui/character-groups.js',import.meta.url),'utf8'));
 assert.throws(()=>ExedraCharacters.validate({character_group:{}}));assert.throws(()=>ExedraCharacters.validate({character_group:'bad group'}));assert.throws(()=>ExedraCharacters.validate({voice_actor_override:'false'}));
});
