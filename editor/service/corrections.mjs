import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {validateTarget,target} from './deployment.mjs';
export function correctionSQL(action,{status='pending',offset=0,requestID}={}){
 if(action==='completeCorrection'){
  if(typeof requestID!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestID))throw Error('수정 요청 식별자가 올바르지 않습니다.');
  return `UPDATE correction_requests SET completed_at = COALESCE(completed_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = '${requestID}' RETURNING id,completed_at`;
 }
 if(action!=='listCorrections'||!['pending','completed','all'].includes(status)||!Number.isSafeInteger(offset)||offset<0||offset>1000000)throw Error('조회 조건을 확인해 주세요.');
 return 'SELECT id,created_at,kind,record_id,page_title,content,completed_at FROM correction_requests'+(status==='pending'?' WHERE completed_at IS NULL':status==='completed'?' WHERE completed_at IS NOT NULL':'')+' ORDER BY created_at DESC,id DESC LIMIT 101 OFFSET '+offset;
}
export async function correctionJob(root,action,payload,{run,node,wrangler,progress=()=>{}}){
 const sql=correctionSQL(action,payload);
 validateTarget(JSON.parse(await readFile(join(root,'wrangler.jsonc'),'utf8')));
 progress('Cloudflare에서 수정 요청을 확인하는 중입니다.');
 const cli=args=>run(node,[wrangler,...args],{cwd:root,outputLimit:2_000_000});
 const identity=await cli(['whoami']);if(!identity.includes(target.account))throw Error('기존 Cloudflare 계정으로 로그인해 주세요.');
 const raw=await cli(['d1','execute','exedra-record','--remote','--command',sql,'--json']);
 let result;try{result=JSON.parse(raw)}catch{throw Error('서버 응답을 읽지 못했습니다. 다시 조회해 주세요.')}
 if(!Array.isArray(result)||result.length!==1||result[0].success!==true||!Array.isArray(result[0].results))throw Error('수정 요청 작업 결과를 확인하지 못했습니다.');
 const rows=result[0].results;
 if(action==='completeCorrection'){if(!rows.length)throw Error('수정 요청을 찾을 수 없습니다.');return rows[0]}
 return {items:rows.slice(0,100),hasMore:rows.length>100};
}
