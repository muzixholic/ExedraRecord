import {cp,mkdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const here=new URL('./',import.meta.url);
for(const name of ['ui','service']){const dest=new URL(name+'/',here);await rm(dest,{recursive:true,force:true});await cp(new URL('../'+name+'/',here),dest,{recursive:true})}
await cp(new URL('../../public/affiliations.js',here),new URL('ui/affiliations.js',here));
await cp(new URL('../service/portrait-model.js',here),new URL('ui/portrait-model.js',here));
console.log('윈도 입력 화면과 온라인 작업 도구 준비 완료');
