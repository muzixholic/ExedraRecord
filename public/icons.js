// 공식 소개 이미지에서 아이콘 영역만 표시합니다. 좌표는 원본 1920×1080 기준입니다.
export const gameIcons = {
 element: {
  '나무속성': {src:'/images/sumire-floral-iron-spike-official.jpeg',x:657,y:17,size:49},
  '어둠속성': {src:'/images/fuuka-final-fate-bloom-official.jpeg',x:657,y:17,size:49},
  '무속성': {src:'/images/sayaka-official.jpeg',x:657,y:17,size:49},
  '빛속성': {src:'/images/madoka-winctio-magica-official.jpeg',x:657,y:17,size:49},
  '불속성': {src:'/images/homura-metal-conversion-official.jpeg',x:657,y:17,size:49},
  '물속성': {src:'/images/sorana-aqua-tempest-official.jpeg',x:642,y:9,size:50}
 },
 role: {
  '브레이커': {src:'/images/fuuka-final-fate-bloom-official.jpeg',x:449,y:23,size:36},
  '디펜더': {src:'/images/mayoi-spiral-home-official.jpeg',x:449,y:90,size:36},
  '힐러': {src:'/images/rika-snow-dome-official.jpeg',x:449,y:22,size:36},
  '어태커': {src:'/images/sayaka-official.jpeg',x:450,y:23,size:34},
  '디버퍼': {src:'/images/madoka-winctio-magica-official.jpeg',x:450,y:23,size:34},
  '버퍼': {src:'/images/sorana-aqua-tempest-official.jpeg',x:450,y:12,size:44}
 }
};
export function gameIcon(kind,value){
 const crop=gameIcons[kind]?.[value];if(!crop)return null;
 const box=document.createElement('span');box.className='game-icon game-icon-'+kind;box.setAttribute('aria-hidden','true');
 const img=document.createElement('img');img.src=crop.src;img.alt='';img.width=1920;img.height=1080;img.decoding='async';
 img.style.width=(1920/crop.size*100)+'%';img.style.left=(-crop.x/crop.size*100)+'%';img.style.top=(-crop.y/crop.size*100)+'%';
 box.append(img);return box;
}
