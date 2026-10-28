import {access,realpath,readdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
const variable=(env,key)=>env[Object.keys(env).find(k=>k.toLowerCase()===key.toLowerCase())]||'';
export function executableCandidates(name,platform=process.platform){return platform==='win32'?(name==='node'?['node.exe']:[name+'.exe',name+'.cmd',name]):[name]}
export async function commandPath(name,{platform=process.platform,env=process.env,currentNode=process.versions.electron?'':process.execPath,probe=async p=>{await access(p,constants.X_OK)},canonical=realpath,list=readdir}={}){
 const p=platform==='win32'?path.win32:path.posix;
 const directories=[],add=value=>{if(value&&!directories.includes(value))directories.push(value.replace(/^"|"$/g,''))};
 if(currentNode)add(p.dirname(currentNode));
 for(const directory of variable(env,'PATH').split(p.delimiter))add(directory);
 if(platform==='win32'){
  add(variable(env,'FNM_MULTISHELL_PATH'));
  const appdata=variable(env,'APPDATA'),local=variable(env,'LOCALAPPDATA'),home=variable(env,'USERPROFILE');
  if(appdata)add(p.join(appdata,'npm'));
  for(const base of [variable(env,'ProgramFiles'),variable(env,'ProgramFiles(x86)')])if(base)add(p.join(base,'nodejs'));
  const roots=[variable(env,'FNM_DIR'),variable(env,'XDG_DATA_HOME')&&p.join(variable(env,'XDG_DATA_HOME'),'fnm'),appdata&&p.join(appdata,'fnm'),local&&p.join(local,'fnm'),home&&p.join(home,'.fnm')].filter(Boolean);
  for(const root of [...new Set(roots)]){
   add(p.join(root,'aliases','default'));add(p.join(root,'aliases','default','installation'));
   let versions=[];try{versions=await list(p.join(root,'node-versions'))}catch{}
   for(const version of versions.filter(v=>/^v?\d+\.\d+\.\d+$/.test(v)).sort((a,b)=>b.localeCompare(a,'en',{numeric:true}))){add(p.join(root,'node-versions',version,'installation'));add(p.join(root,'node-versions',version))}
  }
  // 오래 열린 PowerShell의 fnm 링크도 실제 설치 위치로 정규화합니다.
  if(local){let shells=[];const root=p.join(local,'fnm_multishells');try{shells=await list(root)}catch{}for(const shell of shells.filter(v=>/^\d+_\d+$/.test(v)).sort().reverse().slice(0,64))add(p.join(root,shell))}
 }else for(const directory of ['/opt/homebrew/bin','/usr/local/bin','/usr/bin'])add(directory);
 for(const directory of directories)for(const candidate of executableCandidates(name,platform)){
  const file=p.join(directory,candidate);try{await probe(file);if(platform==='win32'&&name==='codex'&&/\.cmd$/i.test(file))await probe(p.join(directory,'node_modules','@openai','codex','bin','codex.js'));return await canonical(file)}catch{}
 }
 throw Error(name+' 실행 파일을 찾지 못했습니다. 설치 위치와 현재 윈도 계정을 확인해 주세요.');
}
export function executionEnvironment(node,env=process.env,platform=process.platform){
 const p=platform==='win32'?path.win32:path.posix,result={...env},original=variable(env,'PATH');
 for(const key of Object.keys(result))if(key.toLowerCase()==='path'||key.toLowerCase()==='electron_run_as_node')delete result[key];
 result.PATH=[p.dirname(node),...(platform==='win32'?[]:['/opt/homebrew/bin','/usr/local/bin']),original].filter(Boolean).join(p.delimiter);return result;
}
export function runnerLaunch(node,script,request,env=process.env,platform=process.platform){return {executable:node,args:[script,request],env:executionEnvironment(node,env,platform)}}
export async function checkConnections({root,node,wrangler,run,find=commandPath}){
 const diagnostics={node,codex:{},cloudflare:{path:wrangler}};let codex=false,cloudflare=false;
 try{const file=await find('codex');diagnostics.codex.path=file;await run(file,['login','status'],{cwd:root});codex=true}catch(error){diagnostics.codex.error=error.message}
 try{const text=await run(node,[wrangler,'whoami'],{cwd:root});cloudflare=/7b33c59c1366ca82db48b21179a06bd1/.test(text);if(!cloudflare)diagnostics.cloudflare.error='현재 로그인에 기존 ExedraRecord Cloudflare 계정이 포함되어 있지 않습니다.'}catch(error){diagnostics.cloudflare.error=error.message}
 return {codex,cloudflare,diagnostics};
}
