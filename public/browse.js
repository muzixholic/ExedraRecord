import './affiliations.js';
export const FILTER_ORDER = {element:['불속성','물속성','나무속성','빛속성','어둠속성','무속성'],role:['어태커','브레이커','힐러','버퍼','디버퍼','디펜더'],rarity:[5,4,3]};
export const filterLabel = value => value==='디펜더'?'디팬더':value;
export const PAGE_SIZE = 24;
export const acquisition = k => k.acquisition || (k.limited ? '한정' : '통상');
export function parseRoute(hash) {
 const [path, query = ''] = hash.replace(/^#/, '').split('?');
 const parts = path.split('/');
 const params = new URLSearchParams(query);
 let id = null;
 try { id = parts[1] ? decodeURIComponent(parts[1]) : null; } catch { id = '__invalid__'; }
 return { section: parts[0] || 'memories', id, params };
}
export function listUrl(params) {
 const q = params.toString();return '#memories' + (q ? '?' + q : '');
}
export function detailUrl(id, params) {
 const q = params.toString();return '#memories/' + encodeURIComponent(id) + (q ? '?' + q : '');
}
export function browse(items, params) {
 const q=(params.get('q')||'').trim().toLocaleLowerCase();
 const filtered=items.filter(k=>[k.character_ko,k.character_ja,k.name_ko,k.name_ja].some(v=>(v||'').toLocaleLowerCase().includes(q))&&['role','element','rarity','acquisition','work','group'].every(key=>!params.getAll(key).filter(Boolean).length||(key==='group'?(k.work!=='magia-record'&&params.getAll('work').includes('magia-record')&&params.getAll('work').includes(k.work)||globalThis.ExedraAffiliations.groupsFor(k).some(id=>params.getAll(key).includes(id))):params.getAll(key).includes(String(key==='acquisition'?acquisition(k):k[key])))));
 const collator = new Intl.Collator('ko');
 filtered.sort((a,b)=>params.get('sort')==='rarity' ? b.rarity-a.rarity || collator.compare(a.character_ko,b.character_ko) : collator.compare(a.character_ko,b.character_ko)||collator.compare(a.name_ko||a.name_ja,b.name_ko||b.name_ja));
 const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
 const raw=Number(params.get('page')||1);
 const page=Number.isSafeInteger(raw)?Math.max(1,Math.min(pages,raw)):1;
 return {total:filtered.length,pages,page,items:filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE)};
}
