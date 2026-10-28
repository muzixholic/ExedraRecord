import test from 'node:test';
import assert from 'node:assert/strict';
import {commandPath,executionEnvironment,runnerLaunch,checkConnections} from '../editor/service/executables.mjs';
function options(files,extra={}){return {platform:'win32',env:{},currentNode:'',probe:async file=>{if(!files.includes(file))throw Error('없음')},canonical:async file=>file,list:async()=>[],...extra}}
test('윈도 Path의 공백 경로와 실제 설치 경로를 찾는다',async()=>{
 const file='C:\\Users\\Test User\\fnm_multishells\\1_2\\node.exe';
 assert.equal(await commandPath('node',options([file],{env:{Path:'C:\\missing;C:\\Users\\Test User\\fnm_multishells\\1_2'},canonical:async()=> 'C:\\fnm\\node.exe'})),'C:\\fnm\\node.exe');
});
test('fnm 기본 버전을 다른 설치 버전보다 우선한다',async()=>{
 const file='C:\\fnm\\aliases\\default\\node.exe';
 assert.equal(await commandPath('node',options([file],{env:{FNM_DIR:'C:\\fnm'}})),file);
});
test('fnm 설치 버전에서 최신 Node를 찾는다',async()=>{
 const file='C:\\fnm\\node-versions\\v25.2.1\\installation\\node.exe';
 assert.equal(await commandPath('node',options([file],{env:{FNM_DIR:'C:\\fnm'},list:async()=>['v22.0.0','v25.2.1']})),file);
});
test('fnm 임시 셸 폴더에서 Codex와 스크립트를 찾는다',async()=>{
 const base='C:\\Local\\fnm_multishells\\29308_1793148724640';
 assert.equal(await commandPath('codex',options([base+'\\codex.cmd',base+'\\node_modules\\@openai\\codex\\bin\\codex.js'],{env:{LOCALAPPDATA:'C:\\Local'},list:async dir=>dir.endsWith('fnm_multishells')?['29308_1793148724640']:[]})),base+'\\codex.cmd');
});
test('스크립트가 없는 Codex cmd는 건너뛴다',async()=>{
 const files=['C:\\bad\\codex.cmd','C:\\good\\codex.exe'];
 assert.equal(await commandPath('codex',options(files,{env:{PATH:'C:\\bad;C:\\good'}})),files[1]);
});
test('도구가 없으면 한국어 오류를 전달한다',async()=>{
 await assert.rejects(commandPath('node',options([])),/실행 파일을 찾지 못했습니다/);
});
test('외부 Node 환경은 Electron 모드와 중복 Path를 제거하고 프록시를 유지한다',()=>{
 const env=executionEnvironment('C:\\Node\\node.exe',{Path:'C:\\tools',PATH:'C:\\other',ELECTRON_RUN_AS_NODE:'1',HTTPS_PROXY:'proxy',NODE_EXTRA_CA_CERTS:'cert'},'win32');
 assert.equal(env.PATH,'C:\\Node;C:\\tools');assert.equal(env.Path,undefined);assert.equal(env.ELECTRON_RUN_AS_NODE,undefined);assert.equal(env.HTTPS_PROXY,'proxy');assert.equal(env.NODE_EXTRA_CA_CERTS,'cert');
});
test('온라인 서비스는 외부 Node로 공백이 있는 인자를 따로 전달한다',()=>{
 const launch=runnerLaunch('C:\\Node\\node.exe','C:\\Test App\\runner.mjs','C:\\Test User\\job.json',{},'win32');
 assert.equal(launch.executable,'C:\\Node\\node.exe');assert.deepEqual(launch.args,['C:\\Test App\\runner.mjs','C:\\Test User\\job.json']);
});
const connectionOptions={root:'project',node:'node',wrangler:'wrangler.js',find:async()=> 'codex'};
test('연결 확인은 도구별 성공과 실제 경로를 반환한다',async()=>{
 const result=await checkConnections({...connectionOptions,run:async file=>file==='node'?'7b33c59c1366ca82db48b21179a06bd1':'로그인됨'});
 assert.equal(result.codex,true);assert.equal(result.cloudflare,true);assert.equal(result.diagnostics.codex.path,'codex');
});
test('Codex 실패가 Cloudflare 확인을 막지 않는다',async()=>{
 const result=await checkConnections({...connectionOptions,find:async()=>{throw Error('도구 없음')},run:async()=> '7b33c59c1366ca82db48b21179a06bd1'});
 assert.equal(result.codex,false);assert.equal(result.cloudflare,true);assert.equal(result.diagnostics.codex.error,'도구 없음');
});
test('다른 Cloudflare 계정은 실패 원인을 표시한다',async()=>{
 const result=await checkConnections({...connectionOptions,run:async()=> '다른 계정'});
 assert.equal(result.cloudflare,false);assert.match(result.diagnostics.cloudflare.error,/기존 ExedraRecord/);
});
test('Cloudflare 실행 오류를 보존한다',async()=>{
 const result=await checkConnections({...connectionOptions,run:async file=>{if(file==='node')throw Error('연결 실패');return '로그인됨'}});
 assert.equal(result.codex,true);assert.equal(result.diagnostics.cloudflare.error,'연결 실패');
});
