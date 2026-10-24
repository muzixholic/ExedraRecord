const $=selector=>document.querySelector(selector);
const model=globalThis.EditorModel;
const requests=new Map();let requestID=0;
const editorBridge=window.desktopEditor||window.webkit?.messageHandlers?.editor;
window.receiveNative=response=>{const pending=requests.get(response.id);if(!pending)return;requests.delete(response.id);response.error?pending.reject(Error(response.error)):pending.resolve(response.value)};
window.desktopEditor?.onResponse(response=>window.receiveNative(response));
window.desktopEditor?.onProgress(event=>window.nativeProgress?.(event));
function native(action,data={}){return new Promise((resolve,reject)=>{const id=String(++requestID);requests.set(id,{resolve,reject});if(!editorBridge){requests.delete(id);reject(Error('기억 입력 도구 앱에서 열어 주세요.'));return}editorBridge.postMessage({id,action,...data})})}
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
let entries=[],current=null,revision=null,dirty=false,busy=false,previewVersion=0;
function message(text,error=false){$('#message').textContent=text;$('#message').classList.toggle('error',error)}
function setDirty(value){dirty=value;$('#save-state').textContent=value?'저장하지 않은 변경':'로컬 저장 상태';editorBridge?.postMessage({id:'dirty',action:'dirty',value})}
function field(name){return document.querySelector('[name="'+name+'"]')}
function change(){setDirty(true)}
async function run(task){if(busy)return;busy=true;const controls=Array.from(document.querySelectorAll('button,input,textarea,select')).filter(e=>!e.closest('dialog')&&e.id!=='cancel-operation').map(e=>[e,e.disabled]);controls.forEach(([e])=>e.disabled=true);try{await task()}catch(error){message(error.message,true)}finally{controls.forEach(([e,disabled])=>e.disabled=disabled);busy=false}}
async function online(action,data={}){$('#cancel-operation').hidden=false;try{return await native(action,data)}finally{$('#cancel-operation').hidden=true}}
window.nativeProgress=event=>message(event.message);
$('#cancel-operation').onclick=()=>{message('취소를 요청했습니다. 이미 반영된 서버 작업은 취소되지 않을 수 있습니다.');native('cancelOperation').catch(error=>message(error.message,true))};
async function discard(){if(!dirty)return true;const dialog=$('#discard-dialog');return new Promise(resolve=>{dialog.showModal();$('#keep-editing').onclick=()=>{dialog.close();resolve(false)};$('#discard-changes').onclick=()=>{dialog.close();setDirty(false);resolve(true)};dialog.oncancel=()=>resolve(false)})}
function list(){
 const q=$('#search').value.trim().toLowerCase();const target=$('#records');target.replaceChildren();$('#count').textContent=entries.length+'개';
 for(const entry of entries){const k=entry.memory;if(![k.character_ko,k.name_ko,k.character_ja,k.name_ja,k.id].some(value=>(value||'').toLowerCase().includes(q)))continue;
  const button=node('button',undefined,'record'+(current?.id===k.id?' selected':''));button.type='button';button.append(node('strong',k.character_ko),node('small',k.name_ko||k.name_ja),node('small',k.element+' · '+k.role.replace('디펜더','디팬더')+' · '+(k.acquisition||(k.limited?'한정':'통상'))));button.onclick=()=>run(async()=>{if(current?.id===k.id)return;if(await discard())edit(entry)});target.append(button);
 }
 if(!target.children.length)target.append(node('p','조건에 맞는 기억이 없습니다.','help'));
}
function tab(name){for(const panel of document.querySelectorAll('.tab-panel'))panel.hidden=panel.id!=='tab-'+name;for(const button of document.querySelectorAll('[data-tab]'))button.setAttribute('aria-selected',String(button.dataset.tab===name))}
for(const button of document.querySelectorAll('[data-tab]'))button.onclick=()=>tab(button.dataset.tab);
for(const [name,values]of [['element',model.elements],['role',model.roles]])for(const value of values){const option=node('option',value.replace('디펜더','디팬더'));option.value=value;field(name).append(option)}
const basics=['id','character_ko','character_ja','voice_actor','voice_actor_url','work','name_ko','name_ja','rarity','element','role','acquisition','stats_note','illustration_url','thumbnail_url','pv_url','image','source_url','source_note','verification'];
function edit(entry){
 current=model.clone(entry.memory);revision=entry.revision||null;current.acquisition=current.acquisition||(current.limited?'한정':'통상');current.skills??=[];current.limit_breaks??=[];current.groups=ExedraAffiliations.groupsFor(current);
 $('#welcome').hidden=true;$('#editor').hidden=false;
 for(const key of basics)field(key).value=current[key]??'';
 syncGroup();
 field('id').readOnly=!!revision;
 for(const key of ['HP','공격력','방어력','스피드'])field('stat-'+key).value=current.stats?.[key]??'';
 for(const key of ['translation_notes','pending'])field(key).value=(current[key]||[]).join('\n');
 $('#editing-title').textContent=current.character_ko||'새 기억';$('#editing-id').textContent=revision?current.id:'새 기억 · 아직 저장하지 않았습니다.';
 renderSkills();renderBreaks();tab('basic');setDirty(false);list();previews();
}
function collectDraft(){
 const result=model.clone(current);
 for(const key of basics)result[key]=field(key).value.trim();result.rarity=Number(result.rarity);result.groups=result.work==='magia-record'?[...current.groups]:[];delete result.group;
 result.stats={...result.stats};for(const key of ['HP','공격력','방어력','스피드'])result.stats[key]=field('stat-'+key).value.trim();
 for(const key of ['translation_notes','pending'])result[key]=field(key).value.split('\n').map(v=>v.trim()).filter(Boolean);
 for(const skill of result.skills){for(const key of ['break','adjacent_break'])if(key in skill)skill[key]=model.numeric(skill[key]??'',key==='break'?'브레이크 감소량':'인접 브레이크 감소량',true);if(!skill.cost)skill.cost=null}
 return result;
}
function collect(){const draft=collectDraft();if(draft.work==='magia-record'&&!draft.groups.length)throw Error('마기아 레코드 그룹을 하나 이상 선택해 주세요.');return model.normalized(draft)}
function entryField(container,label,value,onInput,{area=false,options=null}={}){
 const wrap=node('label',label);let input;
 if(options){input=node('select');for(const text of [...new Set([...options,...(value&&!options.includes(value)?[value]:[])])]){const option=node('option',text);option.value=text;input.append(option)}}else input=node(area?'textarea':'input');
 if(area)input.rows=4;input.spellcheck=false;input.setAttribute('autocorrect','off');input.value=value??'';input.addEventListener('input',()=>{onInput(input.value);change()});wrap.append(input);container.append(wrap);return input;
}
function renderSkills(){
 const target=$('#skills');target.replaceChildren();
 current.skills.forEach((skill,index)=>{
  const block=node('article',undefined,'entry-block');const heading=node('div',undefined,'entry-title');heading.append(node('h4',(index+1)+'. '+(skill.kind||'새 항목')));
  const controls=node('div',undefined,'button-row');for(const [text,offset]of [['위로',-1],['아래로',1]]){const button=node('button',text);button.type='button';button.onclick=()=>{const next=index+offset;if(next<0||next>=current.skills.length)return;[current.skills[index],current.skills[next]]=[current.skills[next],current.skills[index]];change();renderSkills()};controls.append(button)}
  const remove=node('button','항목 삭제');remove.type='button';remove.onclick=()=>{current.skills.splice(index,1);change();renderSkills()};controls.append(remove);heading.append(controls);block.append(heading);
  const top=node('div',undefined,'fields');entryField(top,'종류',skill.kind,value=>skill.kind=value,{options:['필살기','전투 스킬','일반 공격','어빌리티','서포트 어빌리티','전용 EX 결정 어빌리티','전투 스킬 · 고유 효과','어빌리티 · 추격','어빌리티 · 필드']});entryField(top,'소모 자원 (예: MP 90, SP 1)',skill.cost,value=>skill.cost=value);entryField(top,'이름 · 한국어',skill.name_ko,value=>skill.name_ko=value);entryField(top,'이름 · 일본어',skill.name_ja,value=>skill.name_ja=value);entryField(top,'브레이크 감소량 (없으면 비워 둡니다)',skill.break,value=>skill.break=value);entryField(top,'인접 브레이크 감소량 (선택)',skill.adjacent_break,value=>skill.adjacent_break=value);block.append(top);
  entryField(block,'설명 · 한국어',skill.ko,value=>skill.ko=value,{area:true});entryField(block,'설명 · 일본어 원문',skill.ja,value=>skill.ja=value,{area:true});target.append(block);
 });
 if(!current.skills.length)target.append(node('p','등록된 항목이 없습니다. 항목 추가를 눌러 입력해 주세요.','help'));
}
function renderBreaks(){
 const target=$('#breaks');target.replaceChildren();
 for(let stage=1;stage<=5;stage++){
  let item=current.limit_breaks.find(value=>Number(value.stage)===stage);if(!item){item={stage,ko:'',ja:''};current.limit_breaks.push(item)}
  const block=node('article',undefined,'entry-block');block.append(node('h4',stage+'단계'));entryField(block,'효과 · 한국어',item.ko,value=>item.ko=value,{area:true});entryField(block,'효과 · 일본어 원문',item.ja,value=>item.ja=value,{area:true});target.append(block);
 }
}
async function previews(){
 const version=++previewVersion;
 for(const [key,id]of [['illustration_url','#illustration-preview'],['image','#source-preview']]){
  const target=$(id);const path=field(key).value.trim();target.replaceChildren();
  if(!path){target.textContent=key==='image'?'등록된 소개 이미지가 없습니다.':'등록된 일러스트가 없습니다.';continue}
  if(!path.startsWith('/images/')){target.textContent='외부 이미지는 오프라인에서 미리 볼 수 없습니다.';continue}
  try{const data=await native('preview',{path});if(version!==previewVersion)return;if(data){const img=node('img');img.src=data;img.alt=key==='image'?'공식 소개 이미지 미리보기':'기억 일러스트 미리보기';target.replaceChildren(img)}else target.textContent='이미지 파일을 찾을 수 없습니다.'}catch(error){if(version===previewVersion)target.textContent=error.message}
 }
}
$('#editor').addEventListener('input',change);
for(const key of ['image','illustration_url'])field(key).addEventListener('change',previews);
$('#editor').onsubmit=event=>{event.preventDefault();run(async()=>{
 const memory=collect();const saved=await native('save',{memory,revision});entries=saved.entries;const entry=entries.find(e=>e.memory.id===memory.id);
 entries.sort((a,b)=>a.memory.character_ko.localeCompare(b.memory.character_ko,'ko'));const activeTab=document.querySelector('[data-tab][aria-selected="true"]').dataset.tab;edit(entry);tab(activeTab);message('저장했습니다. 기존 자료는 자동 백업되며, 운영 사이트에는 아직 반영되지 않았습니다.');
})};
$('#add-skill').onclick=()=>{current.skills.push({kind:'전투 스킬',name_ko:'',name_ja:'',ko:'',ja:'',cost:null,break:null});change();renderSkills()};
$('#new').onclick=()=>run(async()=>{if(!await discard())return;edit({memory:model.blank('memory-'+crypto.randomUUID().slice(0,8))});setDirty(true);message('새 기억을 입력한 뒤 저장해 주세요. 능력치와 이름은 필수입니다.');field('character_ko').focus()});
$('#search').oninput=list;
function applyProject(result){if(!result)return;entries=result.entries;entries.sort((a,b)=>a.memory.character_ko.localeCompare(b.memory.character_ko,'ko'));current=null;revision=null;setDirty(false);$('#editor').hidden=true;$('#welcome').hidden=false;$('#project-path').textContent='작업 폴더 · '+result.path;list();message(entries.length+'개의 기억을 불러왔습니다. 모든 편집은 이 컴퓨터에 저장됩니다.')}
$('#choose-project').onclick=()=>run(async()=>applyProject(await native('chooseProject')));
$('#reload').onclick=()=>run(async()=>{if(await discard())applyProject(await native('load'))});
$('#export').onclick=()=>run(async()=>{if(dirty)throw Error('편집 중인 기억을 먼저 저장해 주세요.');const path=await native('export');message('배포 파일을 만들었습니다. 아직 운영 사이트에는 반영되지 않았습니다.\n'+path)});
for(const [button,source]of [['#upload-illustration',false],['#upload-source',true]])$(button).onclick=()=>run(async()=>{const result=await native('upload');if(!result)return;if(source)field('image').value=result.image;else{field('illustration_url').value=result.image;field('thumbnail_url').value=result.thumbnail}change();await previews();message('이미지를 프로젝트로 가져왔습니다. 기억 저장을 눌러 연결을 저장해 주세요.')});
$('#clear-illustration').onclick=()=>{field('illustration_url').value='';field('thumbnail_url').value='';change();previews();message('일러스트 연결을 해제했습니다. 파일 자체는 남아 있습니다. 저장하면 적용됩니다.')};
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'){event.preventDefault();if(current&&!busy)$('#editor').requestSubmit()}});
let pendingTranslation=null,translationBase=null;
function reviewTranslation(result,base){
 pendingTranslation=result;translationBase=base;const area=$('#translation-review');area.replaceChildren();const k=result.draft;
 area.append(node('h3',(k.character_ko||'캐릭터명 확인 필요')+' · '+(k.name_ko||'기억 이름 확인 필요')),node('p',[k.element,k.role,k.acquisition,k.rarity?k.rarity+'성':null].filter(Boolean).join(' · ')));
 area.append(node('p',['HP','공격력','방어력','스피드'].map(key=>key+' '+(k.stats[key]??'판독 확인 필요')).join(' / ')));
 for(const note of k.review_notes)area.append(node('p','• '+note,'help'));
 for(const block of [...k.skills,...k.limit_breaks]){const section=node('section',undefined,'translation-block');section.append(node('h3',block.kind?block.kind+' · '+(block.name_ko||block.name_ja):'한계돌파 '+block.stage+'단계'),node('p',[block.cost?'소모 '+block.cost:null,block.break!==null&&block.break!==undefined?'브레이크 감소량 '+block.break:null,block.adjacent_break!==null&&block.adjacent_break!==undefined?'인접 감소량 '+block.adjacent_break:null].filter(Boolean).join(' · '),'help'),node('p',block.ko),node('p',block.ja,'original'));area.append(section)}
 message('초벌 번역을 받았습니다. 검토 창에서 원문과 수치를 확인해 주세요.');$('#translation-dialog').showModal();
}
$('#translate-new').onclick=()=>run(async()=>{if(!await discard())return;message('이미지를 선택하면 Codex로 전송해 초벌 번역합니다.');const result=await online('translate');if(result)reviewTranslation(result,{memory:model.blank('memory-'+crypto.randomUUID().slice(0,8)),revision:null})});
$('#translate-current').onclick=()=>run(async()=>{const base={memory:collectDraft(),revision};message('등록된 소개 이미지로 초벌 번역을 시작합니다.');const result=await online('translate',{image:field('image').value.trim()});if(result)reviewTranslation(result,base)});
$('#translation-dismiss').onclick=()=>{$('#translation-dialog').close();message('초벌 번역 적용을 취소했습니다.');pendingTranslation=null;translationBase=null};
$('#translation-apply').onclick=()=>{if(!pendingTranslation)return;const memory=model.applyTranslation(translationBase.memory,pendingTranslation.draft,pendingTranslation.sourceImage);const rev=translationBase.revision;$('#translation-dialog').close();edit({memory,revision:rev});setDirty(true);tab('skills');message('초벌 번역을 편집기에 적용했습니다. 원문·수치를 검토한 뒤 기억 저장을 눌러 주세요.');pendingTranslation=null;translationBase=null};
$('#connections').onclick=()=>run(async()=>{message('연결 상태 확인 중');const result=await online('connections');message('Codex: '+(result.codex?'로그인됨':'로그인 필요')+' · Cloudflare: '+(result.cloudflare?'기존 계정 연결됨':'로그인 또는 계정 확인 필요'))});
for(const [button,action]of [['#login-codex','loginCodex'],['#login-cloudflare','loginCloudflare']])$(button).onclick=()=>run(async()=>{await online(action);message('로그인을 마쳤습니다. 연결 확인으로 상태를 확인할 수 있습니다.')});
$('#publish-prepare').onclick=()=>run(async()=>{if(dirty)throw Error('편집 중인 기억을 먼저 저장해 주세요.');message('서버 반영 자료를 준비하는 중');const plan=await online('prepareDeploy');$('#publish-summary').textContent='저장된 기억 '+plan.count+'개 · 포트레이트 '+(plan.portraitCount||0)+'개와 이미지 · '+plan.url;$('#publish-dialog').showModal()});
$('#publish-dismiss').onclick=()=>{$('#publish-dialog').close();message('서버 반영을 취소했습니다.')};
$('#publish-confirm').onclick=()=>{$('#publish-dialog').close();run(async()=>{const result=await online('publish');message('기억 '+result.count+'개 · 포트레이트 '+(result.portraitCount||0)+'개와 이미지를 서버에 반영하고 조회 확인을 마쳤습니다.\n'+result.url)})};
function syncGroup(){
 const magia=field('work').value==='magia-record';$('#group-field').hidden=!magia;if(!magia)current.groups=[];
 const works=$('#work-tags');works.replaceChildren();
 for(const item of [{id:'',ko:'미등록'},...ExedraAffiliations.works]){
  const button=node('button',item.ko,'tag-option');button.type='button';button.setAttribute('aria-pressed',String(field('work').value===item.id));
  button.onclick=()=>{field('work').value=item.id;change();syncGroup()};works.append(button);
 }
 const groups=$('#group-tags');groups.replaceChildren();
 for(const item of ExedraAffiliations.groups){
  const button=node('button',item.ko,'tag-option');button.type='button';button.setAttribute('aria-pressed',String(current.groups.includes(item.id)));
  button.onclick=()=>{current.groups=current.groups.includes(item.id)?current.groups.filter(id=>id!==item.id):[...current.groups,item.id];change();syncGroup()};groups.append(button);
 }
}
run(async()=>applyProject(await native('load')));

for(const button of document.querySelectorAll('[data-wiki]'))button.onclick=()=>run(async()=>{
 const name=field('voice_actor').value.trim();if(!name)throw Error('검색할 성우 이름을 먼저 입력해 주세요.');
 const bases={namu:'https://namu.wiki/Search?q=',ko:'https://ko.wikipedia.org/w/index.php?search=',ja:'https://ja.wikipedia.org/w/index.php?search='};
 await native('openWiki',{url:bases[button.dataset.wiki]+encodeURIComponent(name)});
});

for(const key of ['character_ko','character_ja'])field(key).addEventListener('change',()=>{
 const normalize=value=>(value||'').normalize('NFKC').replace(/\s+/gu,'').toLowerCase();
 const ja=normalize(field('character_ja').value),ko=normalize(field('character_ko').value);
 const shared=entries.find(({memory:k})=>ja&&normalize(k.character_ja)?ja===normalize(k.character_ja):ko&&ko===normalize(k.character_ko));
 if(shared){field('voice_actor').value=shared.memory.voice_actor||'';field('voice_actor_url').value=shared.memory.voice_actor_url||'';message('등록된 캐릭터의 공통 성우 정보를 불러왔습니다.')}
});

if(window.desktopEditor){for(const element of document.querySelectorAll('button,p'))if(element.childElementCount===0)element.textContent=element.textContent.replaceAll('⌘S','Ctrl+S').replaceAll('이 맥','이 컴퓨터');}

$('#switch-portraits').onclick=()=>run(async()=>{if(await discard())await native('switchEditor',{kind:'portraits'})});

installCorrections({native,run});
