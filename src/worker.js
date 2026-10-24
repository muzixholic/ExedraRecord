const summarySql = `SELECT json_object(
 'id',id,'character_ko',json_extract(payload,'$.character_ko'),
 'character_ja',json_extract(payload,'$.character_ja'),'name_ko',json_extract(payload,'$.name_ko'),
 'name_ja',json_extract(payload,'$.name_ja'),'rarity',json_extract(payload,'$.rarity'),
 'role',json_extract(payload,'$.role'),'element',json_extract(payload,'$.element'),
 'illustration_url',json_extract(payload,'$.illustration_url'),
 'thumbnail_url',json_extract(payload,'$.thumbnail_url'),
 'work',json_extract(payload,'$.work'),'group',json_extract(payload,'$.group'),'groups',json_extract(payload,'$.groups'),
 'acquisition',json_extract(payload,'$.acquisition'),'limited',json_extract(payload,'$.limited')
) AS payload FROM memories WHERE published = 1 ORDER BY id`;
const headers={'Cache-Control':'public, max-age=60','X-Content-Type-Options':'nosniff'};
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
  if(request.method!=='GET')return Response.json({error:'허용되지 않은 요청입니다.'},{status:405,headers:{Allow:'GET'}});
  const match=url.pathname.match(/^\/api\/memories\/([a-z0-9-]+)$/);
  if(url.pathname!=='/api/memories'&&!match)return Response.json({error:'자료를 찾을 수 없습니다.'},{status:404});
  try{
   if(match){const row=await env.DB.prepare('SELECT payload FROM memories WHERE id = ? AND published = 1').bind(match[1]).first();if(!row)return Response.json({error:'기억을 찾을 수 없습니다.'},{status:404});return Response.json(JSON.parse(row.payload),{headers})}
   const {results}=await env.DB.prepare(summarySql).all();return Response.json({items:results.map(row=>JSON.parse(row.payload))},{headers});
  }catch{console.error(JSON.stringify({event:'도감_조회_실패',path:url.pathname}));return Response.json({error:'자료 조회에 실패했습니다.'},{status:503,headers:{'Cache-Control':'no-store'}})}
 }
};
