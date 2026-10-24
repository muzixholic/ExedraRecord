const {app,BrowserWindow,ipcMain,dialog,shell,nativeImage,Menu}=require('electron');
const {join,dirname}=require('node:path');
const {pathToFileURL}=require('node:url');
const fs=require('node:fs/promises');
const {spawn}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const os=require('node:os');
let window,store,MemoryStore,PortraitStore,dirty=false,operation=null,prepared=null,busy=false;
const index=join(__dirname,'ui/index.html');
const settings=()=>join(app.getPath('userData'),'project.json');
async function discard(){if(operation){await dialog.showMessageBox(window,{message:'작업을 마치거나 취소한 뒤 진행해 주세요.',buttons:['확인']});return false}if(!dirty)return true;return (await dialog.showMessageBox(window,{type:'question',message:'저장하지 않은 변경이 있습니다.',detail:'변경을 버리고 계속할까요?',buttons:['계속 편집','변경 버리기'],defaultId:0,cancelId:0})).response===1}
function stop(){if(!operation)return;if(process.platform==='win32')spawn(join(process.env.SystemRoot||'C:\\Windows','System32','taskkill.exe'),['/pid',String(operation.pid),'/T','/F'],{windowsHide:true});else operation.kill('SIGTERM')}
async function online(action,payload={}){
 const dir=await fs.mkdtemp(join(os.tmpdir(),'exedra-job-')),request=join(dir,'request.json');
 await fs.writeFile(request,JSON.stringify({action,root:store.root,...payload}));
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[join(__dirname,'service/runner.mjs'),request],{cwd:store.root,env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},windowsHide:true});operation=child;let pending='',result,error,stderr='';
  child.stdout.on('data',chunk=>{pending+=chunk;let end;while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end);pending=pending.slice(end+1);try{const event=JSON.parse(line);if(event.event==='progress')window.webContents.send('editor:progress',event);if(event.event==='result')result=event.value;if(event.event==='error')error=event.message}catch{}}});
  child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-2000)});
  const cleanup=()=>{operation=null;fs.rm(dir,{recursive:true,force:true}).catch(()=>{})};
  child.once('error',()=>{cleanup();reject(Error('온라인 작업을 시작하지 못했습니다.'))});
  child.once('close',code=>{cleanup();if(code===0&&result!==undefined)resolve(result);else reject(Error(error||'작업이 취소되었거나 종료되었습니다. 연결 상태를 확인해 주세요.'))});
 });
}
async function pickImage(){const result=await dialog.showOpenDialog(window,{title:'가져올 이미지 선택',properties:['openFile'],filters:[{name:'이미지',extensions:['png','jpg','jpeg','webp','bmp']}]});return result.canceled?null:result.filePaths[0]}
function resized(image,max){const size=image.getSize(),scale=Math.min(1,max/Math.max(size.width,size.height));return image.resize({width:Math.max(1,Math.round(size.width*scale)),height:Math.max(1,Math.round(size.height*scale)),quality:'best'})}
async function importImage(source){if((await fs.stat(source)).size>50_000_000)throw Error('50MB 이하의 이미지 파일을 선택해 주세요.');const image=nativeImage.createFromPath(source);if(image.isEmpty())throw Error('이미지를 읽지 못했습니다. PNG·JPEG·WebP·BMP 파일을 사용해 주세요.');const key='upload-'+randomUUID(),path='/images/'+key+'.png',thumb='/images/'+key+'-thumb.jpg';await fs.writeFile(await store.localAsset(path),resized(image,3000).toPNG());await fs.writeFile(await store.localAsset(thumb),resized(image,640).toJPEG(85));return {image:path,thumbnail:thumb}}
async function handle(body){
 const {action}=body;
 if(action==='dirty'){dirty=Boolean(body.value);return true}
 if(action==='cancelOperation'){stop();return true}
 if(busy||operation)throw Error('작업이 실행 중입니다. 잠시 기다려 주세요.');busy=true;
 try{
  if(action==='chooseProject'){
   if(!await discard())return null;const result=await dialog.showOpenDialog(window,{title:'ExedraRecord 프로젝트 선택',properties:['openDirectory']});if(result.canceled)return null;store=await MemoryStore.open(result.filePaths[0]);await fs.mkdir(dirname(settings()),{recursive:true});await fs.writeFile(settings(),JSON.stringify({path:store.root}));dirty=false;prepared=null;
  }
  if(!store&&['load','loadPortraits'].includes(action)){const result=await dialog.showOpenDialog(window,{title:'ExedraRecord 프로젝트 폴더를 선택해 주세요',properties:['openDirectory']});if(result.canceled)return null;store=await MemoryStore.open(result.filePaths[0]);await fs.mkdir(dirname(settings()),{recursive:true});await fs.writeFile(settings(),JSON.stringify({path:store.root}))}
  if(!store)throw Error('프로젝트 폴더를 먼저 선택해 주세요.');
  if(['load','chooseProject'].includes(action))return {path:store.root,entries:await store.load()};
  if(action==='switchEditor'){if(!await discard())return false;dirty=false;setImmediate(()=>window.loadFile(join(__dirname,'ui',body.kind==='portraits'?'portraits.html':'index.html')).catch(error=>dialog.showErrorBox('편집 화면 전환 실패',error.message)));return true}
  if(action==='loadPortraits')return {path:store.root,entries:await new PortraitStore(store.root).load()};
  if(action==='savePortrait'){const portraits=new PortraitStore(store.root);const revision=await portraits.save(body.memory,body.revision);dirty=false;return {revision,entries:await portraits.load()}}
  if(action==='exportPortraits'){if(dirty)throw Error('편집 중인 포트레이트를 먼저 저장해 주세요.');return await new PortraitStore(store.root).exportMigration()}
  if(action==='save'){const revision=await store.save(body.memory,body.revision);dirty=false;return {revision,entries:await store.load()}}
  if(action==='openWiki'){const u=new URL(body.url);if(u.protocol!=='https:'||u.username||u.password||u.port||!['namu.wiki','ko.wikipedia.org','ja.wikipedia.org'].includes(u.hostname))throw Error('위키 주소를 확인해 주세요.');await shell.openExternal(u.href);return true}
  if(action==='upload'){const source=await pickImage();return source?await importImage(source):null}
  if(action==='preview'){if(!body.path)return null;const image=nativeImage.createFromPath(await store.localAsset(body.path));return image.isEmpty()?null:'data:image/jpeg;base64,'+resized(image,1000).toJPEG(85).toString('base64')}
  if(['connections','loginCodex','loginCloudflare'].includes(action))return await online(action);
  if(['translate','translatePortrait'].includes(action)){let image=body.image;if(!image){const source=await pickImage();if(!source)return null;image=(await importImage(source)).image}return await online(action,{image:await store.localAsset(image),sourceImage:image})}
  if(action==='export'){if(dirty)throw Error('편집 중인 기억을 먼저 저장해 주세요.');return await store.exportMigration()}
  if(action==='prepareDeploy'){if(dirty)throw Error('편집 중인 기억을 먼저 저장해 주세요.');const {validate}=await import('./store.mjs');for(const {memory}of await store.load())validate(memory);const portraits=new PortraitStore(store.root);for(const {memory}of await portraits.load())portraits.validate(memory);prepared=await online(action);return prepared}
  if(action==='publish'){if(dirty||!prepared)throw Error('저장 후 서버 반영 준비를 먼저 진행해 주세요.');return await online(action,{plan:join(prepared.directory,'plan.json')})}
  throw Error('지원하지 않는 요청입니다.');
 }finally{busy=false}
}
if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',()=>{window?.restore();window?.focus()});
 app.whenReady().then(async()=>{
  ({MemoryStore,PortraitStore}=await import('./store.mjs'));
  try{const saved=JSON.parse(await fs.readFile(settings(),'utf8'));store=await MemoryStore.open(saved.path)}catch{}
  if(!store)for(const path of [process.env.PORTABLE_EXECUTABLE_DIR&&join(process.env.PORTABLE_EXECUTABLE_DIR,'ExedraRecord'),join(os.homedir(),'Projects','ExedraRecord')].filter(Boolean))try{store=await MemoryStore.open(path);break}catch{}
  window=new BrowserWindow({width:1250,height:900,minWidth:850,minHeight:620,title:'엑세드라 레코드 · 기억 입력 도구',webPreferences:{preload:join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());window.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  ipcMain.handle('editor:request',async(event,body)=>{if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||![index,join(__dirname,'ui/portraits.html')].map(path=>pathToFileURL(path).href).includes(event.senderFrame.url))throw Error('허용되지 않은 화면입니다.');try{return {id:body.id,value:await handle(body)}}catch(error){return {id:body.id,error:error.message}}});
  let closing=false;window.on('close',event=>{if(closing)return;event.preventDefault();if(busy||operation){dialog.showMessageBox(window,{message:'작업을 마치거나 작업 취소를 누른 뒤 종료해 주세요.',buttons:['확인']});return}discard().then(ok=>{if(ok){closing=true;window.close()}})});
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'편집',submenu:[{role:'undo',label:'실행 취소'},{role:'redo',label:'다시 실행'},{type:'separator'},{role:'cut',label:'잘라내기'},{role:'copy',label:'복사'},{role:'paste',label:'붙여넣기'},{role:'selectAll',label:'전체 선택'}]}]));
  await window.loadFile(index);
 }).catch(error=>{dialog.showErrorBox('입력 도구 시작 실패',error.message);app.quit()});
 app.on('window-all-closed',()=>app.quit());
}
