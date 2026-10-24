const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function readLimitedJSON(request){
 if(!request.body)throw Error('빈 요청');
 const reader=request.body.getReader();let length=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>8192){await reader.cancel();throw Error('요청 크기 초과')}chunks.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return JSON.parse(new TextDecoder().decode(bytes));
}
export async function submitCorrection(request,env){
 if(request.method!=='POST')return reply({error:'허용되지 않은 요청입니다.'},405);
 const origin=new URL(request.url).origin;
 if(request.headers.get('Origin')!==origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return reply({error:'이 사이트의 상세 화면에서 요청해 주세요.'},403);
 if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))return reply({error:'요청 형식이 올바르지 않습니다.'},415);
 let data;try{data=await readLimitedJSON(request)}catch{return reply({error:'요청 내용을 확인해 주세요. 최대 2,000자까지 입력할 수 있습니다.'},400)}
 if(!data||!['memories','portraits'].includes(data.kind)||typeof data.record_id!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.record_id)||data.record_id.length>150||typeof data.content!=='string'||!data.content.trim()||data.content.length>2000||!uuid.test(data.request_id||'')||data.website)return reply({error:'수정할 내용과 페이지를 확인해 주세요.'},400);
 try{
  const record=await env.DB.prepare('SELECT payload FROM '+data.kind+' WHERE id = ? AND published = 1').bind(data.record_id).first();
  if(!record)return reply({error:'해당 페이지를 찾을 수 없습니다.'},404);
  const value=JSON.parse(record.payload),title=[data.kind==='memories'?value.character_ko:'',value.name_ko||value.name_ja].filter(Boolean).join(' · ').slice(0,300);
  const now=new Date().toISOString(),day=now.slice(0,10),hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(day+':'+(request.headers.get('CF-Connecting-IP')||'local'))),clientHash=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
  // 같은 요청 재전송은 중복 저장하지 않고, 일일 제한은 삽입문 안에서 원자적으로 확인합니다.
  const existing=await env.DB.prepare('SELECT id FROM correction_requests WHERE id = ? AND client_hash = ?').bind(data.request_id,clientHash).first();
  if(existing)return reply({received:true},200);
  const saved=await env.DB.prepare(`INSERT INTO correction_requests (id,created_at,kind,record_id,page_title,content,client_hash)
   SELECT ?1,?2,?3,?4,?5,?6,?7
   WHERE (SELECT COUNT(*) FROM correction_requests WHERE client_hash = ?7 AND created_at >= ?8) < 10
   AND (SELECT COUNT(*) FROM correction_requests WHERE created_at >= ?8) < 500
   ON CONFLICT(id) DO NOTHING RETURNING id`).bind(data.request_id,now,data.kind,data.record_id,title,data.content.trim(),clientHash,day).first();
  if(!saved)return reply({error:'오늘 접수 가능한 요청 수를 초과했습니다. 나중에 다시 시도해 주세요.'},429);
  return reply({received:true},201);
 }catch{console.error(JSON.stringify({event:'수정요청_접수_실패'}));return reply({error:'접수하지 못했습니다. 입력 내용은 유지됩니다. 잠시 후 다시 시도해 주세요.'},503)}
}
