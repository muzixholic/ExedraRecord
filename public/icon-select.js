import {gameIcon} from './icons.js';
// 기본 select 값을 유지하면서 이미지 선택지를 제공하는 다중 선택 콤보박스입니다.
export function enhanceIconSelect(select,kind){
 const host=document.querySelector('#'+kind+'-dropdown');
 const trigger=document.createElement('button');trigger.type='button';trigger.className='icon-select-trigger';trigger.id=kind+'-combobox';
 trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',kind+'-options');trigger.setAttribute('aria-labelledby',kind+'-label '+kind+'-selection');
 const list=document.createElement('div');list.id=kind+'-options';list.className='icon-select-options';list.setAttribute('role','listbox');list.setAttribute('aria-labelledby',kind+'-label');list.hidden=true;list.setAttribute('aria-multiselectable','true');
 host.className='icon-select';host.append(trigger,list);select.hidden=true;
 list.addEventListener('pointerdown',event=>event.preventDefault());
 let options=[];let active=0;
 function contents(target,value,label){target.replaceChildren();const icon=gameIcon(kind,value);if(icon)target.append(icon);else{const all=document.createElement('span');all.className='all-icon';all.textContent='✧';all.setAttribute('aria-hidden','true');target.append(all)}const text=document.createElement('span');text.textContent=label;target.append(text);return text}
 function mark(){for(let i=0;i<list.children.length;i++)list.children[i].classList.toggle('is-active',i===active);if(!list.hidden){trigger.setAttribute('aria-activedescendant',kind+'-option-'+active);list.children[active]?.scrollIntoView({block:'nearest'})}}
 function close(){list.hidden=true;trigger.setAttribute('aria-expanded','false');trigger.removeAttribute('aria-activedescendant')}
 function open(){if(!options.length)return;document.dispatchEvent(new CustomEvent('close-icon-selects',{detail:kind}));list.hidden=false;trigger.setAttribute('aria-expanded','true');active=Math.max(0,options.findIndex(o=>o.value===select.value));mark()}
 function choose(){
  if(!options[active])return;
  const value=options[active].value;
  if(!value){for(const option of select.options)option.selected=false}
  else{const option=Array.from(select.options).find(o=>o.value===value);option.selected=!option.selected;select.options[0].selected=false}
  sync();trigger.focus();select.dispatchEvent(new Event('change',{bubbles:true}));
 }
 function sync(){
  options=Array.from(select.options).map(o=>({value:o.value,label:o.textContent,selected:o.selected}));
  const chosen=options.filter(o=>o.value&&o.selected);
  trigger.replaceChildren();
  const selection=document.createElement('span');selection.id=kind+'-selection';selection.className='multi-selection';
  if(!chosen.length)contents(selection,'','전체');
  else for(const option of chosen){const chip=document.createElement('span');chip.className='selected-filter';contents(chip,option.value,option.label);selection.append(chip)}
  trigger.append(selection);
  const arrow=document.createElement('span');arrow.textContent='⌄';arrow.className='select-arrow';arrow.setAttribute('aria-hidden','true');trigger.append(arrow);
  list.replaceChildren();options.forEach((o,i)=>{const item=document.createElement('div');item.id=kind+'-option-'+i;item.className='icon-select-option';item.setAttribute('role','option');item.setAttribute('aria-selected',String(o.value?o.selected:!chosen.length));contents(item,o.value,o.label);item.addEventListener('pointermove',()=>{active=i;mark()});item.addEventListener('click',()=>{active=i;choose()});list.append(item)});mark();
 }
 trigger.addEventListener('click',()=>list.hidden?open():close());
 trigger.addEventListener('keydown',event=>{
  if(event.key==='Escape'){close();return}
  if(event.key==='Tab'){close();return}
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
   event.preventDefault();if(list.hidden){open();if(event.key==='Home')active=0;if(event.key==='End')active=options.length-1}else{if(event.key==='ArrowDown')active=Math.min(options.length-1,active+1);if(event.key==='ArrowUp')active=Math.max(0,active-1);if(event.key==='Home')active=0;if(event.key==='End')active=options.length-1}mark();return;
  }
  if(event.key==='Enter'||event.key===' '){event.preventDefault();if(list.hidden)open();else choose()}
 });
 document.addEventListener('pointerdown',event=>{if(!host.contains(event.target))close()});
 document.addEventListener('close-icon-selects',event=>{if(event.detail!==kind)close()});
 host.addEventListener('focusout',event=>{if(!host.contains(event.relatedTarget))close()});
 sync();return {sync};
}
