import './affiliations.js';
const affiliations=globalThis.ExedraAffiliations;
import {relatedMemories,voiceActorLabel,characterVoice,voiceActorUrl} from './character.js';
import {memoryMedia, memoryThumbnail} from './media.js';
import {enhanceIconSelect} from './icon-select.js';
import {gameIcon} from './icons.js';
import {browse, parseRoute, listUrl, detailUrl, acquisition, FILTER_ORDER, filterLabel} from './browse.js';
const $=s=>document.querySelector(s);
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
const charactersReady=fetch('/characters.json').then(r=>{if(!r.ok)throw Error();return r.json()}).then(value=>Array.isArray(value)?value:[]).catch(()=>[]);
let records=[];
let activeMemory=null;
const iconSelects=[enhanceIconSelect($('#element'),'element'),enhanceIconSelect($('#role'),'role')];
function classification(k){
 const row=node('div',undefined,'classification');
 row.append(node('span','★'.repeat(k.rarity),'badge'));
 for(const kind of ['element','role']){
  const badge=node('span',undefined,'icon-label');const icon=gameIcon(kind,k[kind]);if(icon)badge.append(icon);badge.append(node('span',filterLabel(k[kind])));row.append(badge);
 }
 row.append(node('span',acquisition(k),'acquisition-label'));return row;
}
function updateFilterIcons(){iconSelects.forEach(widget=>widget.sync())}
function translatedBlock(kind, title, ja, ko, nameJa){
 const a=node('article',undefined,'skill');
 a.append(node('span',kind,'badge'),node('h3',title),node('p',ko));
 const raw=node('details');raw.append(node('summary','일본어 원문'));
 if(nameJa)raw.append(node('p',nameJa));
 raw.append(node('p',ja));a.append(raw);return a;
}
function renderRelated(k){
 const section=$('#related-memories');if(!section)return;
 section.replaceChildren();section.hidden=false;
 if(!ready){section.append(node('h3','같은 캐릭터의 다른 기억'),node('p',listError?'다른 기억을 불러오지 못했습니다.':'다른 기억을 확인하는 중입니다.','note'));return}
 const others=relatedMemories(k,records);
 if(!others.length){section.hidden=true;return}
 const title=node('h3',k.character_ko+'의 다른 기억');title.id='related-title';section.setAttribute('aria-labelledby',title.id);section.append(title);
 const cards=node('div',undefined,'related-grid');const params=parseRoute(location.hash).params;
 for(const item of others){const link=node('a',undefined,'card');link.href=detailUrl(item.id,params);link.append(memoryThumbnail(item),classification(item),node('strong',item.name_ko||item.name_ja),node('small',item.name_ja));cards.append(link)}
 section.append(cards);
}
function refreshRelated(){const route=parseRoute(location.hash);if(route.section==='memories'&&activeMemory?.id===route.id)renderRelated(activeMemory)}
function detail(k){
 const d=$('#detail');d.replaceChildren();d.hidden=false;
 d.append(classification(k),node('h2',k.character_ko),node('h3',k.name_ko||k.name_ja),node('p',k.name_ja,'note'));
 const metadata=node('dl',undefined,'memory-metadata');const actor=node('dd');const actorUrl=voiceActorUrl(k.voice_actor_url);if(actorUrl&&voiceActorLabel(k)!=='미등록'){const link=node('a',voiceActorLabel(k));link.href=actorUrl;link.target='_blank';link.rel='noopener noreferrer';actor.append(link)}else actor.textContent=voiceActorLabel(k);metadata.append(node('dt','성우'),actor);const work=affiliations.works.find(item=>item.id===k.work);const groups=affiliations.groupsFor(k).map(id=>affiliations.groups.find(item=>item.id===id)).filter(Boolean);metadata.append(node('dt','작품'),node('dd',work?.ko||'미등록'));if(k.work==='magia-record'){const tags=node('dd',undefined,'tag-options');if(groups.length)for(const group of groups)tags.append(node('span',group.ko,'affiliation-tag'));else tags.textContent='미등록';metadata.append(node('dt','그룹'),tags)}d.append(metadata);
 const stats=node('div',undefined,'stats');
 for(const [label,value]of Object.entries(k.stats)){const s=node('div',label);s.append(node('b',value.toLocaleString('ko-KR')));stats.append(s)}
 d.append(memoryMedia(k),stats,node('p',k.stats_note,'note'),node('p',k.verification,'note'));
 const related=node('section',undefined,'related-memories');related.id='related-memories';related.setAttribute('aria-live','polite');d.append(related);renderRelated(k);
 if(k.translation_notes?.length){const notes=node('section',undefined,'pending');notes.append(node('h3','초벌 번역 검토 사항'));const ul=node('ul');k.translation_notes.forEach(text=>ul.append(node('li',text)));notes.append(ul);d.append(notes)}
 d.append(node('h3','스킬과 어빌리티'),node('p','공식 이미지의 최대 강화 수치 기준입니다.','note'));
 const skills=node('div',undefined,'skills');
 for(const s of k.skills){const a=translatedBlock(s.kind,s.name_ko||s.name_ja,s.ja,s.ko,s.name_ja);const meta=[];if(s.cost)meta.push('소모 '+s.cost);if(s.break!==null&&s.break!==undefined)meta.push('브레이크 게이지 감소량 '+s.break);if(s.adjacent_break!==null&&s.adjacent_break!==undefined)meta.push('인접 브레이크 게이지 감소량 '+s.adjacent_break);if(meta.length)a.insertBefore(node('p',meta.join(' · '),'note'),a.children[2]);skills.append(a)}
 d.append(skills);
 if(k.limit_breaks?.length){d.append(node('h3','한계돌파'));const breaks=node('div',undefined,'skills');for(const b of k.limit_breaks)breaks.append(translatedBlock('한계돌파',b.stage+'단계',b.ja,b.ko));d.append(breaks)}
 if(k.pending?.length){const pending=node('section',undefined,'pending');pending.append(node('h3','추가 전사 예정'));const ul=node('ul');k.pending.forEach(s=>ul.append(node('li',s)));pending.append(ul);d.append(pending)}
 d.append(node('h3','출처 이미지'),node('p',k.source_note,'note'));const img=node('img');img.src=k.image;img.alt=k.character_ko+' 공식 기억 소개 원본. 일본어 스킬 설명과 한계돌파 효과 포함.';img.className='source';img.loading='lazy';img.width=1920;img.height=1080;d.append(img);
}
let listError=false;
let ready=false;
let navigationVersion=0;
const detailCache=new Map();
const filterKeys=['role','element','rarity','acquisition','work','group'];
function initializeFilters(){
 for(const key of filterKeys){
  const select=$('#'+key);const all=node('option','전체');all.value='';select.replaceChildren(all);
  const values=['work','group'].includes(key)?affiliations[key==='work'?'works':'groups'].map(item=>item.id):key==='acquisition'?['한정','통상','배포']:FILTER_ORDER[key];
  for(const value of values){const opt=node('option',key==='rarity'?'★'+value:['work','group'].includes(key)?affiliations[key==='work'?'works':'groups'].find(item=>item.id===value).ko:filterLabel(value));opt.value=String(value);select.append(opt)}
 }
}
function renderAffiliationTags(params,key){
 const target=$('#'+key+'-tags');target.replaceChildren();
 const selected=params.getAll(key);
 for(const item of [{id:'',ko:'전체'},...affiliations[key==='work'?'works':'groups']]){
  const button=node('button',item.ko,'tag-option');button.type='button';button.disabled=$('#'+key).disabled;
  button.setAttribute('aria-pressed',String(item.id?selected.includes(item.id):!selected.length));
  button.onclick=()=>{const next=new Set(selected);if(!item.id)next.clear();else if(next.has(item.id))next.delete(item.id);else next.add(item.id);for(const option of $('#'+key).options)option.selected=next.has(option.value);updateFilters(true)};
  target.append(button);
 }
}
function renderList(params){
 $('#search').value=params.get('q')||'';
 for(const key of [...filterKeys,'sort']){const select=$('#'+key);if(select.multiple){for(const option of select.options)option.selected=params.getAll(key).includes(option.value)}else select.value=params.get(key)||(key==='sort'?'name':'')}
 $('#group').disabled=Boolean(params.getAll('work').length&&!params.getAll('work').includes('magia-record'));renderAffiliationTags(params,'work');renderAffiliationTags(params,'group');
 updateFilterIcons();
 $('#list').replaceChildren();$('#pagination').replaceChildren();
 if(!ready){$('#status').textContent=listError?'자료를 불러오지 못했습니다. 새로고침해 주세요.':'기억을 불러오는 중입니다.';return}
 const result=browse(records,params);
 $('#status').textContent='전체 '+records.length+'개 중 '+result.total+'개 · '+result.page+' / '+result.pages+'페이지';
 if(!result.total){$('#list').append(node('p','조건에 맞는 기억이 없습니다. 검색어나 필터를 변경해 주세요.','pending'));return}
 for(const k of result.items){
  const a=node('a',undefined,'card');a.href=detailUrl(k.id,params);
  a.append(memoryThumbnail(k),classification(k),node('strong',k.character_ko),node('span',k.name_ko||k.name_ja,'memory-name'),node('small',k.name_ja));$('#list').append(a);
 }
 const pager=$('#pagination');
 function pageLink(label,page){const next=new URLSearchParams(params);next.set('page',page);const a=node('a',label);a.href=listUrl(next);return a}
 if(result.page>1)pager.append(pageLink('이전',result.page-1));
 const visible=new Set([1,result.pages,...Array.from({length:5},(_,i)=>result.page+i-2).filter(n=>n>0&&n<=result.pages)]);
 let previous=0;
 for(const page of [...visible].sort((a,b)=>a-b)){if(previous&&page-previous>1)pager.append(node('span','…'));if(page===result.page){const current=node('span',String(page),'current');current.setAttribute('aria-current','page');pager.append(current)}else pager.append(pageLink(String(page),page));previous=page}
 if(result.page<result.pages)pager.append(pageLink('다음',result.page+1));
}
function updateFilters(replace=false){
 const params=new URLSearchParams();const q=$('#search').value.trim();if(q)params.set('q',q);
 for(const key of filterKeys)for(const option of $('#'+key).selectedOptions)if(option.value)params.append(key,option.value);
 if($('#sort').value!=='name')params.set('sort',$('#sort').value);
 if(params.get('group')){if(params.getAll('work').length&&!params.getAll('work').includes('magia-record'))params.delete('group');else if(!params.getAll('work').length)params.append('work','magia-record')}
 const url=listUrl(params);
 if(replace){history.replaceState(null,'',url);renderList(params)}else if(location.hash===url)renderList(params);else location.hash=url;
}
$('#search').addEventListener('input',()=>updateFilters(true));
for(const key of [...filterKeys,'sort'])$('#'+key).addEventListener('change',()=>updateFilters(true));
$('#reset-filters').addEventListener('click',()=>{history.replaceState(null,'','#memories');renderList(new URLSearchParams())});

const sections=[
 ['memories','기억 도감','기억의 능력과 이야기를, 원문과 함께.'],
 ['portraits','포트레이트 도감','포트레이트의 효과와 입수 정보를 기록합니다.'],
 ['witches','마녀도감','마녀의 정보와 전투 특성을 기록합니다.'],
 ['story','스토리','스토리를 살펴볼 수 있는 공간입니다.'],
 ['events','이벤트','이벤트별 진행 정보와 자료를 모읍니다.'],
 ['link-raid','링크레이드','링크레이드의 개최 정보와 전투 자료를 모읍니다.'],
 ['tower','타워','타워의 층별 전투 자료를 모읍니다.'],
 ['score-attack','스코어어택','스코어어택의 개최 정보와 전투 자료를 모읍니다.'],
 ['exedra-crisis','엑세드라 크라이시스','엑세드라 크라이시스 관련 자료를 모읍니다.'],
 ['schedule','일정','게임의 주요 일정을 모읍니다.']
];
for(const [id,label] of sections){const a=node('a',label);a.href='#'+id;$('#navigation').append(a)}
async function navigate(){
 const version=++navigationVersion;activeMemory=null;
 const route=parseRoute(location.hash);
 const selected=sections.find(s=>s[0]===route.section)||sections[0];
 const isMemory=selected[0]==='memories';const isDetail=isMemory&&Boolean(route.id);
 $('#page-title').textContent=isDetail?'기억 상세':selected[1];
 $('#page-description').textContent=isDetail?'원문과 함께 확인하는 기억의 기록.':selected[2];
 document.title='엑세드라 레코드 · '+(isDetail?'기억 상세':selected[1]);
 $('#memory-content').hidden=!isMemory||isDetail;$('#detail-page').hidden=!isDetail;$('#coming-soon').hidden=isMemory;
 for(const a of $('#navigation').querySelectorAll('a')){if(a.hash==='#'+selected[0])a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')}
 if(!isMemory)return;
 if(!isDetail){renderList(route.params);return}
 $('#back-to-list').href=listUrl(route.params);
 $('#detail').hidden=false;$('#detail').replaceChildren(node('p','기억을 불러오는 중입니다.'));window.scrollTo(0,0);
 try{
  let k=detailCache.get(route.id);
  if(!k){const res=await fetch('/api/memories/'+encodeURIComponent(route.id));if(!res.ok)throw new Error(res.status===404?'기억을 찾을 수 없습니다.':'자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');k=await res.json();detailCache.set(route.id,k)}
  if(version!==navigationVersion)return;
  k=characterVoice(k,await charactersReady);if(version!==navigationVersion)return;activeMemory=k;detail(k);$('#page-title').textContent=k.character_ko;$('#page-description').textContent=k.name_ko||k.name_ja;document.title='엑세드라 레코드 · '+k.character_ko+' · '+(k.name_ko||k.name_ja);
 }catch(error){if(version===navigationVersion)$('#detail').replaceChildren(node('p',error.message,'pending'))}
}
window.addEventListener('hashchange',()=>{navigate();window.scrollTo(0,0)});navigate();
try{const res=await fetch('/api/memories');if(!res.ok)throw Error();records=(await res.json()).items;ready=true;initializeFilters();if(!parseRoute(location.hash).id)navigate();else refreshRelated()}catch{listError=true;if(!parseRoute(location.hash).id)navigate();else refreshRelated()}
