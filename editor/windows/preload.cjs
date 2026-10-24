const {contextBridge,ipcRenderer}=require('electron');
let responseHandler=()=>{},progressHandler=()=>{};
contextBridge.exposeInMainWorld('desktopEditor',{
 postMessage:body=>{ipcRenderer.invoke('editor:request',body).then(response=>responseHandler(response)).catch(()=>responseHandler({id:body.id,error:'앱 연결에 실패했습니다.'}))},
 onResponse:callback=>{responseHandler=callback},
 onProgress:callback=>{progressHandler=callback}
});
ipcRenderer.on('editor:progress',(_event,value)=>progressHandler(value));
