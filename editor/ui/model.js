(function(){
 const elements=['불속성','물속성','나무속성','빛속성','어둠속성','무속성'];
 const roles=['어태커','브레이커','힐러','버퍼','디버퍼','디펜더'];
 const clone=value=>JSON.parse(JSON.stringify(value));
 function blank(id){return {id,character_ko:'',character_ja:'',voice_actor:'',voice_actor_url:'',character_group:'',voice_actor_override:false,work:'',groups:[],name_ko:'',name_ja:'',rarity:5,element:'불속성',role:'어태커',acquisition:'통상',limited:false,stats:{HP:'',공격력:'',방어력:'',스피드:''},stats_note:'',image:'',illustration_url:'',thumbnail_url:'',pv_url:'',source_url:'',source_note:'',verification:'입력 중 · 검토 대기',translation_notes:[],pending:[],skills:[],limit_breaks:Array.from({length:5},(_,i)=>({stage:i+1,ja:'',ko:''}))}}
 function numeric(value,label,optional=false){if(optional&&String(value).trim()==='')return null;if(!/^\d+$/.test(String(value).trim())||!Number.isSafeInteger(Number(value)))throw Error(label+'은 0 이상의 정수로 입력해 주세요.');return Number(value)}
 function validate(memory){
  globalThis.ExedraCharacters?.validate(memory);
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(memory.id)||memory.id.length>100)throw Error('식별자는 영문 소문자·숫자·하이픈으로 입력해 주세요.');
  if(!memory.character_ko.trim()||!memory.name_ko.trim())throw Error('캐릭터명과 기억 이름을 입력해 주세요.');
  if(!['한정','통상','배포'].includes(memory.acquisition))throw Error('입수 구분을 확인해 주세요.');
  if(!elements.includes(memory.element)||!roles.includes(memory.role)||![3,4,5].includes(memory.rarity))throw Error('속성·역할·희귀도를 확인해 주세요.');
  for(const key of ['HP','공격력','방어력','스피드'])numeric(memory.stats[key],key);
  if(memory.pv_url){let url;try{url=new URL(memory.pv_url)}catch{throw Error('PV는 유튜브 영상 주소로 입력해 주세요.')}
   const host=url.hostname;let id;
   if(host==='youtu.be')id=url.pathname.match(/^\/([\w-]{11})\/?$/)?.[1];
   else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host))id=url.pathname==='/watch'?url.searchParams.get('v'):url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})\/?$/)?.[1];
   if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.port||!/^[\w-]{11}$/.test(id||''))throw Error('올바른 유튜브 영상 주소를 입력해 주세요.');
  }
  return memory;
 }
 function normalized(memory){const result=clone(memory);result.limited=result.acquisition==='한정';for(const key of ['HP','공격력','방어력','스피드'])result.stats[key]=numeric(result.stats[key],key);return validate(result)}
 function applyTranslation(base,draft,sourceImage){
  const result=clone(base);
  for(const key of ['character_ko','character_ja','name_ko','name_ja','rarity','element','role','acquisition','stats_note'])result[key]=draft[key]??'';
  result.stats={};for(const key of ['HP','공격력','방어력','스피드'])result.stats[key]=draft.stats[key]??'';
  result.skills=clone(draft.skills);result.limit_breaks=clone(draft.limit_breaks);
  result.translation_notes=[...new Set([...(base.translation_notes||[]),...draft.review_notes])];result.verification='AI 초벌 번역 · 원문·수치 검토 대기';
  if(sourceImage&&sourceImage!==base.image){result.source_url='';result.source_note='사용자가 가져온 공식 소개 이미지. AI 초벌 번역 원본.'}
  result.image=sourceImage||base.image||'';result.limited=result.acquisition==='한정';return result;
 }
 function findVoice(memory,entries){
  const normalize=value=>(value||'').normalize('NFKC').replace(/\s+/gu,'').toLowerCase();
  const ja=normalize(memory.character_ja),ko=normalize(memory.character_ko);
  if(!ja&&!ko)throw Error('캐릭터명을 먼저 입력해 주세요.');
  const matches=entries.map(entry=>entry.memory||entry).filter(k=>globalThis.ExedraCharacters?ExedraCharacters.sameCharacter(memory,k):(()=>{const otherJa=normalize(k.character_ja);return ja&&otherJa?ja===otherJa:Boolean(ko&&ko===normalize(k.character_ko))})()).filter(k=>!k.voice_actor_override&&k.voice_actor?.trim());
  if(!matches.length)throw Error('같은 캐릭터의 등록된 성우 정보가 없습니다. 캐릭터명을 확인하거나 직접 입력해 주세요.');
  const actors=new Set(matches.map(k=>k.voice_actor.trim())),urls=new Set(matches.map(k=>k.voice_actor_url?.trim()||'').filter(Boolean));
  if(actors.size!==1||urls.size>1)throw Error('같은 캐릭터의 성우 정보가 서로 다릅니다. 기존 자료를 확인한 뒤 직접 입력해 주세요.');
  return {voice_actor:[...actors][0],voice_actor_url:[...urls][0]||''};
 }
 globalThis.EditorModel={elements,roles,clone,blank,numeric,validate,normalized,applyTranslation,findVoice};
})();
