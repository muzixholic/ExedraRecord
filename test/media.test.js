import {test} from 'node:test';
import assert from 'node:assert/strict';
import {youtubeVideo,illustrationUrl,memoryMedia,memoryThumbnail} from '../public/media.js';
const id='M7lc1UVf-VE';
test('유튜브 주소 형식을 같은 플레이어로 변환한다',()=>{
 for(const url of [`https://www.youtube.com/watch?v=${id}&feature=shared`,`https://youtu.be/${id}?si=공유값`,`https://m.youtube.com/watch?v=${id}`,`https://youtube.com/shorts/${id}`,`https://youtube.com/live/${id}`,`https://www.youtube-nocookie.com/embed/${id}`]){
  assert.deepEqual(youtubeVideo(url),{embed:`https://www.youtube-nocookie.com/embed/${id}`,watch:`https://www.youtube.com/watch?v=${id}`});
 }
});
test('유튜브가 아닌 주소와 잘못된 영상 ID를 삽입하지 않는다',()=>{
 for(const url of [null,'','javascript:alert(1)',`https://youtube.com.evil.test/watch?v=${id}`,`https://youtube.com@evil.test/watch?v=${id}`,`https://evil.test/${id}`,'https://youtube.com/watch?v=short',`https://youtube.com:9000/watch?v=${id}`,`https://youtube.com/playlist?list=${id}`])assert.equal(youtubeVideo(url),null);
});
test('일러스트는 공개 경로와 HTTPS 주소만 허용한다',()=>{
 assert.equal(illustrationUrl('/images/upload.webp'),'/images/upload.webp');assert.equal(illustrationUrl('https://cdn.example.com/art.webp'),'https://cdn.example.com/art.webp');
 for(const value of [null,'','//evil.test/art','/\\evil.test/art','javascript:alert(1)','data:image/svg+xml,test','http://example.com/art'])assert.equal(illustrationUrl(value),null);
});
// DOM 생성 결과를 확인하며 외부 영상이나 테스트 자료를 실제 도감에 등록하지 않습니다.
test('미등록 안내와 등록된 이미지·영상의 렌더링을 확인한다',()=>{
 const previous=globalThis.document;
 globalThis.document={createElement(tag){return {tag,children:[],attrs:{},append(...nodes){this.children.push(...nodes)},setAttribute(key,value){this.attrs[key]=value},addEventListener(){}}}};
 try{
  const memory={character_ko:'확인용',name_ko:'기억'};
  const empty=memoryMedia(memory);assert.equal(empty.children.length,2);assert.match(empty.children[0].children[2].textContent,/등록된 일러스트/);assert.match(empty.children[1].children[2].textContent,/등록된 PV/);
  const filled=memoryMedia({...memory,illustration_url:'/images/art.webp',pv_url:`https://youtu.be/${id}`});
  assert.equal(filled.children[0].children[2].children[0].src,'/images/art.webp');
  const frame=filled.children[1].children[2];assert.equal(frame.tag,'iframe');assert.equal(frame.src,`https://www.youtube-nocookie.com/embed/${id}`);assert.equal(frame.loading,'lazy');assert.equal(frame.allowFullscreen,true);assert.ok(!frame.src.includes('autoplay=1'));
 }finally{globalThis.document=previous}
});

test('목록 썸네일은 전용 파일·일러스트 순으로 표시하고 실패하면 대체한다',()=>{
 const previous=globalThis.document;
 globalThis.document={createElement(tag){return {tag,children:[],events:{},append(...nodes){this.children.push(...nodes)},replaceChildren(...nodes){this.children=nodes},setAttribute(){},addEventListener(event,handler){this.events[event]=handler}}}};
 try{
  assert.equal(memoryThumbnail({}).children[0].textContent,'일러스트 준비 중');
  const original=memoryThumbnail({illustration_url:'/images/art.webp'}).children[0];assert.equal(original.src,'/images/art.webp');assert.equal(original.loading,'lazy');assert.equal(original.alt,'');
  const box=memoryThumbnail({illustration_url:'/images/art.webp',thumbnail_url:'/images/thumb.webp'});const img=box.children[0];assert.equal(img.src,'/images/thumb.webp');
  img.events.error();assert.equal(img.src,'/images/art.webp');img.events.error();assert.equal(box.children[0].textContent,'일러스트 준비 중');
  assert.equal(memoryThumbnail({illustration_url:'javascript:alert(1)'}).children[0].textContent,'일러스트 준비 중');
 }finally{globalThis.document=previous}
});
