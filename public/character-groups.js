(function(){
 const normalize=value=>typeof value==='string'?value.normalize('NFKC').replace(/\s+/gu,'').toLowerCase():'';
 const families=[{id:'akemi-homura',label:'아케미 호무라',names:['아케미 호무라','暁美ほむら','악마 호무라','悪魔ほむら']},{id:'kaname-madoka',label:'카나메 마도카',names:['카나메 마도카','鹿目まどか','얼티밋 마도카','アルティメットまどか']}];
 function key(memory){if(typeof memory.character_group==='string'&&memory.character_group.trim())return memory.character_group.trim();const ja=normalize(memory.character_ja),ko=normalize(memory.character_ko);const family=families.find(f=>f.names.some(name=>{const n=normalize(name);return n===ja||n===ko}));return family?.id||(ja?'ja:'+ja:ko?'ko:'+ko:'')}
 function sameName(a,b){const ja=normalize(a.character_ja),jb=normalize(b.character_ja);return ja&&jb?ja===jb:Boolean(normalize(a.character_ko)&&normalize(a.character_ko)===normalize(b.character_ko))}
 function sameCharacter(a,b){const ka=key(a),kb=key(b);if(ka&&ka===kb)return true;if(a.character_group||b.character_group)return false;return sameName(a,b)}
 function choices(items=[]){const map=new Map(families.map(f=>[f.id,{id:f.id,label:f.label}]));for(const item of items){const memory=item.memory||item,id=key(memory);if(id&&(!map.has(id)||!families.some(f=>f.id===id)&&key({...memory,character_group:''})===id))map.set(id,{id,label:memory.character_ko||memory.character_ja||'이름 미등록'})}return [...map.values()].sort((a,b)=>a.label.localeCompare(b.label,'ko'))}
 function label(memory,items=[]){return choices([...items,memory]).find(item=>item.id===key(memory))?.label||memory.character_ko||memory.character_ja||'미등록'}
 function shared(memory,characters=[]){const matches=characters.filter(k=>!k.voice_actor_override&&sameCharacter(memory,k));return matches.find(k=>k.character_group)||matches[0]}
 function voice(memory,characters=[]){if(memory.voice_actor_override)return memory;const common=shared(memory,characters);return common?{...memory,voice_actor:common.voice_actor||'',voice_actor_url:common.voice_actor_url||''}:memory}
 function validate(memory){if(memory.character_group!=null&&(typeof memory.character_group!=='string'||memory.character_group.length>200||/[\s\u0000-\u001f]/u.test(memory.character_group)))throw Error('캐릭터 그룹을 확인해 주세요.');if(memory.voice_actor_override!=null&&typeof memory.voice_actor_override!=='boolean')throw Error('성우 개별 지정 여부를 확인해 주세요.')}
 globalThis.ExedraCharacters={normalize,key,sameName,sameCharacter,choices,label,shared,voice,validate};
})();
