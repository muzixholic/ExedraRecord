import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import worker from '../src/worker.js';
import {correctionSQL,correctionJob} from '../editor/service/corrections.mjs';
const origin='https://example.com';
const content={kind:'memories',record_id:'sample-memory',content:'攻撃力の数値は123です。 공격력 수정 부탁드립니다.',request_id:randomUUID()};
function request(data=content,headers={}){return new Request(origin+'/api/correction-requests',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:typeof data==='string'?data:JSON.stringify(data)})}
async function setup(t){const root=await mkdtemp(join(tmpdir(),'exedra-corrections-test-')),db=join(root,'db.sqlite');t.after(()=>rm(root,{recursive:true,force:true}));
 const query=(sql,params=[])=>{const result=spawnSync('python3',['-c',`import sqlite3,json,sys
c=sqlite3.connect(sys.argv[1]);c.row_factory=sqlite3.Row
p=json.loads(sys.stdin.read());cursor=c.execute(p['sql'],p['params']);rows=[dict(r) for r in cursor.fetchall()];c.commit();print(json.dumps(rows))`,db],{input:JSON.stringify({sql,params}),encoding:'utf8'});if(result.status!==0)throw Error(result.stderr);return JSON.parse(result.stdout)};
 for(const sql of (await readFile(new URL('../migrations/0011_correction_requests.sql',import.meta.url),'utf8')).split(';').filter(v=>v.trim()))query(sql);
 for(const kind of ['memories','portraits']){query('CREATE TABLE '+kind+' (id TEXT,payload TEXT,published INTEGER)');query('INSERT INTO '+kind+' VALUES (?,?,1)',['sample-'+(kind==='memories'?'memory':'portrait'),JSON.stringify({name_ko:'검증 자료',character_ko:'캐릭터'})])}
 return {query,DB:{prepare(sql){let params=[];return {bind(...values){params=values;return this},async first(){return query(sql,params)[0]||null},async all(){return {results:query(sql,params)}}}}},root};
}
test('기억·포트레이트 수정 요청 접수와 관리자 완료 처리가 실제 SQL로 동작한다',async t=>{
 const env=await setup(t);
 for(const kind of ['memories','portraits']){const response=await worker.fetch(request({...content,kind,record_id:'sample-'+(kind==='memories'?'memory':'portrait'),request_id:randomUUID()}),env);assert.equal(response.status,201);assert.deepEqual(await response.json(),{received:true})}
 const rows=env.query(correctionSQL('listCorrections'));assert.equal(rows.length,2);assert.equal(rows[0].content,content.content);assert.equal(rows[0].completed_at,null);assert.equal('client_hash' in rows[0],false);
 const completed=env.query(correctionSQL('completeCorrection',{requestID:rows[0].id}))[0];assert.ok(completed.completed_at);assert.equal(env.query(correctionSQL('completeCorrection',{requestID:rows[0].id}))[0].completed_at,completed.completed_at);
 assert.equal(env.query(correctionSQL('listCorrections')).length,1);assert.equal(env.query(correctionSQL('listCorrections',{status:'completed'})).length,1);assert.equal(env.query(correctionSQL('listCorrections',{status:'all'})).length,2);
});
test('같은 접수 재전송은 중복 저장하지 않는다',async t=>{const env=await setup(t);assert.equal((await worker.fetch(request(),env)).status,201);assert.equal((await worker.fetch(request(),env)).status,200);assert.equal(env.query('SELECT * FROM correction_requests').length,1)});
test('같은 접속자의 일일 접수 제한이 삽입 단계에서 적용된다',async t=>{const env=await setup(t);for(let n=0;n<10;n++)assert.equal((await worker.fetch(request({...content,request_id:randomUUID()}),env)).status,201);assert.equal((await worker.fetch(request({...content,request_id:randomUUID()}),env)).status,429);assert.equal(env.query('SELECT * FROM correction_requests').length,10)});
test('다른 사이트·잘못된 내용·과도한 크기·없는 페이지를 거절한다',async t=>{const env=await setup(t);for(const [req,status]of [[request(content,{Origin:'https://other.example'}),403],[request(content,{'Content-Type':'text/plain'}),415],[request({...content,content:'  '}),400],[request({...content,content:'가'.repeat(2001)}),400],[request({...content,kind:'users'}),400],[request({...content,record_id:'missing'}),404],[request('{'),400],[request('x'.repeat(9000)),400]])assert.equal((await worker.fetch(req,env)).status,status);assert.equal(env.query('SELECT * FROM correction_requests').length,0)});
test('요청 내용 조회·완료 변경 API는 공개하지 않는다',async()=>{assert.equal((await worker.fetch(new Request(origin+'/api/correction-requests'),{})).status,405);assert.equal((await worker.fetch(new Request(origin+'/api/correction-requests/anything'),{})).status,404)});
test('접수 DB 오류는 내부 정보 없이 재시도 가능한 응답으로 반환한다',async()=>{const response=await worker.fetch(request(),{DB:{prepare(){throw Error('비밀')}}});assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/비밀/)});
test('관리자 SQL은 허용된 상태와 식별자만 사용한다',()=>{assert.throws(()=>correctionSQL('completeCorrection',{requestID:"'; DELETE FROM memories;--"}));assert.throws(()=>correctionSQL('listCorrections',{status:'invalid'}));assert.throws(()=>correctionSQL('listCorrections',{offset:-1}));assert.throws(()=>correctionSQL('deleteCorrections'));assert.match(correctionSQL('listCorrections',{status:'all',offset:100}),/LIMIT 101 OFFSET 100$/)});
test('관리자 조회는 기존 Cloudflare 인증을 요구하고 페이지 단위로 반환한다',async t=>{const env=await setup(t);const config=await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8');await writeFile(join(env.root,'wrangler.jsonc'),config);const rows=Array.from({length:101},(_,i)=>({id:i}));let calls=[];const run=async(executable,args)=>{calls.push(args);return args.includes('whoami')?'7b33c59c1366ca82db48b21179a06bd1':JSON.stringify([{success:true,results:rows}])};const result=await correctionJob(env.root,'listCorrections',{}, {run,node:'node',wrangler:'wrangler'});assert.equal(result.items.length,100);assert.equal(result.hasMore,true);assert.ok(calls[1].includes('--remote'));await assert.rejects(correctionJob(env.root,'listCorrections',{}, {run:async()=>'',node:'node',wrangler:'wrangler'}),/로그인/)});

test('관리자 요청 목록의 긴 내용도 잘리지 않고 전달된다',async()=>{const {run}=await import('../editor/service/runner.mjs');const expected='가'.repeat(20000);const result=await run(process.execPath,['-e',"process.stdout.write('가'.repeat(20000))"],{outputLimit:2000000});assert.equal(result,expected)});
