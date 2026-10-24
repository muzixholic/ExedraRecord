// 입력 도구는 원본 주소만 저장하고, 상세 페이지에서 안전한 표시 주소를 만듭니다.
export function youtubeVideo(url){
 if(typeof url!=='string'||!url.trim())return null;
 try{
  const parsed=new URL(url.trim());
  if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.port)return null;
  const host=parsed.hostname.toLowerCase();let id;
  if(host==='youtu.be')id=parsed.pathname.match(/^\/([\w-]{11})\/?$/)?.[1];
  else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','www.youtube-nocookie.com','youtube-nocookie.com'].includes(host)){
   id=parsed.pathname==='/watch'?parsed.searchParams.get('v'):parsed.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})\/?$/)?.[1];
  }
  if(!/^[\w-]{11}$/.test(id||''))return null;
  return {embed:'https://www.youtube-nocookie.com/embed/'+id,watch:'https://www.youtube.com/watch?v='+id};
 }catch{return null}
}
export function illustrationUrl(value){
 if(typeof value!=='string'||!value.trim())return null;
 const url=value.trim();
 if(url.startsWith('/')&&!url.startsWith('//')&&!/[\\\u0000-\u0020]/.test(url))return url;
 try{const parsed=new URL(url);return parsed.protocol==='https:'&&!parsed.username&&!parsed.password?parsed.href:null}catch{return null}
}
export function memoryMedia(memory){
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e};
 const root=node('div',null,'memory-media');
 const illustration=node('section',null,'media-section');illustration.append(node('p','기억의 한 장면','media-eyebrow'),node('h2','기억 일러스트'));
 const imageUrl=illustrationUrl(memory.illustration_url);
 if(imageUrl){
  const link=node('a');link.href=imageUrl;link.target='_blank';link.rel='noopener noreferrer';link.className='illustration-link';link.setAttribute('aria-label','기억 일러스트 원본 보기');
  const img=node('img');img.src=imageUrl;img.alt=memory.character_ko+' · '+(memory.name_ko||memory.name_ja)+' 기억 일러스트';img.className='memory-illustration';img.loading='lazy';img.decoding='async';
  const unavailable=()=>{link.replaceWith(node('p','일러스트를 불러오지 못했습니다.','media-empty'))};img.addEventListener('error',unavailable,{once:true});
  link.append(img);illustration.append(link,node('p','일러스트를 누르면 원본을 볼 수 있습니다.','note'));
 }else illustration.append(node('p','아직 등록된 일러스트가 없습니다.','media-empty'));
 const pv=node('section',null,'media-section');pv.append(node('p','영상으로 만나는 기억','media-eyebrow'),node('h2','PV 영상'));
 const video=youtubeVideo(memory.pv_url);
 if(video){
  const frame=node('iframe');frame.src=video.embed;frame.title=memory.character_ko+' · '+(memory.name_ko||memory.name_ja)+' PV 영상';frame.className='pv-player';frame.loading='lazy';frame.allow='accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
  const link=node('a','YouTube에서 보기');link.href=video.watch;link.target='_blank';link.rel='noopener noreferrer';link.className='media-source-link';
  pv.append(frame,link,node('p','재생되지 않으면 YouTube에서 확인해 주세요.','note'));
 }else pv.append(node('p',memory.pv_url?'영상 주소를 확인 중입니다.':'아직 등록된 PV 영상이 없습니다.','media-empty'));
 root.append(illustration,pv);return root;
}

// 썸네일 전용 파일이 있으면 우선 사용하고, 없으면 기억 일러스트를 표시합니다.
export function memoryThumbnail(memory){
 const box=document.createElement('div');box.className='memory-thumbnail';box.setAttribute('aria-hidden','true');
 const placeholder=()=>{const label=document.createElement('span');label.className='thumbnail-placeholder';label.textContent='일러스트 준비 중';box.replaceChildren(label)};
 const original=illustrationUrl(memory.illustration_url);
 const thumbnail=illustrationUrl(memory.thumbnail_url);
 const src=thumbnail||original;
 if(!src){placeholder();return box}
 const img=document.createElement('img');img.src=src;img.alt='';img.loading='lazy';img.decoding='async';img.width=640;img.height=360;
 img.addEventListener('error',()=>{if(original&&src!==original){img.addEventListener('error',placeholder,{once:true});img.src=original}else placeholder()},{once:true});
 box.append(img);return box;
}
