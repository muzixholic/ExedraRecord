// 포트레이트 공통 자료 계약. 웹 공개 사본과 입력 앱이 같은 정의를 사용합니다.
(function(){
 const tags=['공격력','방어력','HP','스피드','MP 회복 효율','치명타 확률','치명타 피해','주는 피해','받는 피해','필살기 피해','전투 스킬 피해','일반 공격 피해','추격 피해','반격 피해','브레이크','HP 회복','MP 회복','행동 순서','상태 이상','기타'];
 const acquisitionOptions=[{id:'distribution',label:'배포'},{id:'story',label:'스토리'},{id:'puella-pictura',label:'푸엘라 픽투러'}];
 const clone=v=>JSON.parse(JSON.stringify(v));
 const cleanName=v=>String(v||'').replace(/\s*[+＋]\s*[0-5]\s*$/u,'').trim();
 function blank(id){return {id,name_ko:'',name_ja:'',rarity:5,acquisition_type:'',story_id:'',image_url:'',thumbnail_url:'',source_image:'',source_url:'',source_note:'',verification:'입력 중 · 검토 대기',stats_max:{HP:'',공격력:'',방어력:''},ability_levels:Array.from({length:6},(_,level)=>({level,effects:[]}))}}
 const levels=p=>Array.from({length:6},(_,level)=>p.ability_levels?.find(k=>k.level===level)||{level,effects:[]});
 const aliases={'공격력':['攻撃力'],'방어력':['防御力'],'스피드':['スピード'],'MP 회복 효율':['MP回復効率'],'치명타 확률':['クリティカル率'],'치명타 피해':['クリティカルダメージ'],'추격 피해':['추격','追撃'],'반격 피해':['반격','反撃'],'필살기 피해':['필살기','必殺技'],'전투 스킬 피해':['전투 스킬','戦闘スキル']};
 function effectTags(effect){const text=[effect.text_ko,effect.text_ja].filter(Boolean).join(' ').replace(/\s/g,'');return tags.filter(tag=>(effect.tags||[]).includes(tag)||[tag,...(aliases[tag]||[])].some(v=>(tag==='MP 회복'?text.replace(/MP회복효율|MP回復効率/g,''):text).includes(v.replace(/\s/g,''))))}
 function abilityTags(p,level=''){return [...new Set(levels(p).filter(k=>level===''||k.level===Number(level)).flatMap(k=>k.effects.flatMap(effectTags)))]}
 function validate(p){
  if(!p||typeof p!=='object'||typeof p.id!=='string'||p.id.length>100||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.id))throw Error('포트레이트 식별자 형식을 확인해 주세요.');
  if(typeof p.name_ko!=='string'||!cleanName(p.name_ko)||typeof p.name_ja!=='string'||![4,5].includes(p.rarity))throw Error('포트레이트 이름과 등급을 확인해 주세요.');
  const source=p.acquisition_type??'',story=p.story_id??'';
  if(typeof source!=='string'||source&&!acquisitionOptions.some(k=>k.id===source))throw Error('입수처는 배포·스토리·푸엘라 픽투러 중 하나를 선택해 주세요.');
  if(typeof story!=='string'||story&&(source!=='story'||story.length>100||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(story)))throw Error('스토리 참조값을 확인해 주세요.');
  for(const key of ['HP','공격력','방어력'])if(!Number.isSafeInteger(p.stats_max?.[key])||p.stats_max[key]<0)throw Error('최대 한계돌파 '+key+'를 0 이상의 정수로 입력해 주세요.');
  if(!Array.isArray(p.ability_levels)||p.ability_levels.length!==6||new Set(p.ability_levels.map(k=>k?.level)).size!==6)throw Error('어빌리티는 +0~+5 여섯 단계를 각각 기록해 주세요.');
  for(const stage of p.ability_levels){if(!Number.isInteger(stage.level)||stage.level<0||stage.level>5||!Array.isArray(stage.effects)||stage.effects.length>50)throw Error('강화 단계의 효과 목록을 확인해 주세요.');for(const e of stage.effects){if(!e||typeof e!=='object'||!['text_ko','text_ja','condition_ko','condition_ja'].every(key=>typeof e[key]==='string')||!e.text_ko.trim()||!Array.isArray(e.tags)||e.tags.some(tag=>!tags.includes(tag)))throw Error('어빌리티 효과의 한국어 설명·조건·분류를 확인해 주세요.')}}
  for(const key of ['image_url','thumbnail_url','source_image','source_url','source_note','verification'])if(p[key]!=null&&typeof p[key]!=='string')throw Error('이미지·출처 자료 형식을 확인해 주세요.');
  return p;
 }
 function normalized(p){const value=clone(p);value.acquisition_type??='';value.story_id=value.acquisition_type==='story'?(value.story_id||''):'';value.name_ko=cleanName(value.name_ko);value.name_ja=cleanName(value.name_ja);for(const key of ['HP','공격력','방어력']){const raw=value.stats_max[key];if(!/^\d+$/.test(String(raw).trim()))throw Error('최대 한계돌파 '+key+'를 입력해 주세요.');value.stats_max[key]=Number(raw)}return validate(value)}
 globalThis.PortraitModel={tags,acquisitionOptions,clone,cleanName,blank,levels,effectTags,abilityTags,validate,normalized};
})();
