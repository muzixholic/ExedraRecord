import './character-groups.js';
// 표기 중 공백과 전각·반각 차이를 정규화하되 이름의 일부만으로 묶지 않습니다.
export const sameCharacter=(a,b)=>globalThis.ExedraCharacters.sameCharacter(a,b);
export function relatedMemories(current,items){
 const matches=new Map();
 for(const item of items)if(item.id!==current.id&&sameCharacter(current,item))matches.set(item.id,item);
 const collator=new Intl.Collator('ko');
 return [...matches.values()].sort((a,b)=>b.rarity-a.rarity||collator.compare(a.name_ko||a.name_ja||'',b.name_ko||b.name_ja||'')||String(a.id).localeCompare(String(b.id)));
}
export function voiceActorLabel(memory){return typeof memory.voice_actor==='string'&&memory.voice_actor.trim()?memory.voice_actor.trim():'미등록'}

export const characterVoice=(memory,characters=[])=>globalThis.ExedraCharacters.voice(memory,characters);
export function voiceActorUrl(value){
 try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port||!['namu.wiki','ko.wikipedia.org','ja.wikipedia.org'].includes(url.hostname)||!url.pathname.startsWith(url.hostname==='namu.wiki'?'/w/':'/wiki/')||url.pathname.split('/').filter(Boolean).length<2)return null;return url.href}catch{return null}
}
