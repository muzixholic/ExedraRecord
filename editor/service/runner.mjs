import {spawn} from 'node:child_process';
import {readFile,access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,resolve,dirname,basename,relative,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepare,publish} from './deployment.mjs';
import {translate} from './translation.mjs';
import {correctionJob} from './corrections.mjs';
import {commandPath,executionEnvironment,checkConnections} from './executables.mjs';
export {commandPath,executableCandidates} from './executables.mjs';
import {translatePortrait} from './portrait-translation.mjs';
const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
const progress=message=>send({event:'progress',message});
let child=null,cancelled=false;const cancellation=new AbortController();
function stop(){cancelled=true;cancellation.abort();if(child?.pid){killTree(child.pid)}}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
export const redact=text=>String(text).replace(/Bearer\s+\S+/gi,'Bearer [비공개]').replace(/(?:sk-|sk-proj-)[A-Za-z0-9_-]+/g,'[비공개]').replace(/(token|api_key|authorization)\s*[=:]\s*[^\s,}]+/gi,'$1=[비공개]');
function killTree(pid){if(process.platform==='win32'){spawn(join(process.env.SystemRoot||'C:\\Windows','System32','taskkill.exe'),['/pid',String(pid),'/T','/F'],{windowsHide:true,stdio:'ignore'})}else{try{process.kill(-pid,'SIGTERM')}catch{}}}

export async function run(executable,args,{cwd,input,timeout=120_000,outputLimit=12000}={}){
 if(process.platform==='win32'&&/\.cmd$/i.test(executable)){
  if(basename(executable).toLowerCase()!=='codex.cmd')throw Error('지원하지 않는 실행 파일 형식입니다.');
  const script=join(dirname(executable),'node_modules','@openai','codex','bin','codex.js');
  try{await access(script)}catch{throw Error('Codex CLI 설치를 확인해 주세요. npm으로 설치한 Codex 또는 codex.exe가 필요합니다.')}
  args=[script,...args];executable=process.execPath;
 }

 if(cancelled)return Promise.reject(Error('작업이 취소되었습니다.'));
 return new Promise((resolve,reject)=>{
  let output='',timedOut=false;const processChild=spawn(executable,args,{cwd,detached:process.platform!=='win32',windowsHide:true,env:{...executionEnvironment(process.execPath),CI:'true',NO_COLOR:'1',WRANGLER_SEND_METRICS:'false'},stdio:['pipe','pipe','pipe']});child=processChild;
  const timer=setTimeout(()=>{timedOut=true;killTree(processChild.pid)},timeout);
  const append=data=>{output=(output+data.toString()).slice(-outputLimit)};processChild.stdout.on('data',append);processChild.stderr.on('data',append);processChild.stdin.on('error',()=>{});processChild.stdin.end(input||'');
  processChild.once('error',error=>{clearTimeout(timer);reject(Error('실행하지 못했습니다: '+error.message))});
  processChild.once('close',code=>{clearTimeout(timer);if(child===processChild)child=null;if(cancelled)reject(Error('작업이 취소되었습니다.'));else if(timedOut)reject(Error('작업 시간이 초과되었습니다. 다시 시도해 주세요.'));else if(code!==0)reject(Error(redact(output).slice(-1800)||'실행 실패'));else resolve(output)});
 });
}
export async function execute(job){
 const root=resolve(job.root);const node=process.execPath;const wrangler=join(root,'node_modules/wrangler/bin/wrangler.js');
 if(['listCorrections','completeCorrection'].includes(job.action))return correctionJob(root,job.action,job,{run,node,wrangler,progress});
 if(job.action==='translatePortrait')return {...await translatePortrait({image:job.image,codex:await commandPath('codex'),run,progress}),sourceImage:job.sourceImage};
 if(job.action==='translate')return {...await translate({image:job.image,codex:await commandPath('codex'),run,progress}),sourceImage:job.sourceImage};
 if(job.action==='prepareDeploy'){progress('로컬 기억과 이미지를 고정해 반영 자료를 준비하는 중');return await prepare(root)}
 if(job.action==='publish'){const plan=JSON.parse(await readFile(job.plan,'utf8'));const planRelative=relative(join(root,'.editor-jobs'),resolve(plan.directory));if(resolve(plan.root)!==root||!planRelative||planRelative.startsWith('..')||isAbsolute(planRelative))throw Error('반영 자료 경로가 올바르지 않습니다.');return publish(plan,{node,wrangler,run,progress,signal:cancellation.signal})}
 if(job.action==='connections')return checkConnections({root,node,wrangler,run});
 if(job.action==='loginCodex'){progress('브라우저에서 Codex 로그인을 완료해 주세요.');await run(await commandPath('codex'),['login'],{cwd:root,timeout:600_000});return true}
 if(job.action==='loginCloudflare'){progress('브라우저에서 Cloudflare 로그인을 완료해 주세요.');await run(node,[wrangler,'login'],{cwd:root,timeout:600_000});return true}
 throw Error('지원하지 않는 온라인 작업입니다.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const result=await execute(JSON.parse(await readFile(process.argv[2],'utf8')));send({event:'result',value:result})}catch(error){send({event:'error',message:redact(error.message)});process.exitCode=1}}
