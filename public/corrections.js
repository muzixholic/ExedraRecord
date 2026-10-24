const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
export function correctionButton(kind,record){
 const section=node('section');section.className='correction-footer';const button=node('button','수정 요청');button.type='button';const result=node('p');result.setAttribute('role','status');section.append(button,result);
 button.onclick=()=>{
  const dialog=node('dialog'),form=node('form'),heading=node('h2','수정 요청'),page=node('p',kind==='memories'?[record.character_ko,record.name_ko||record.name_ja].filter(Boolean).join(' · '):record.name_ko||record.name_ja),help=node('p','잘못된 내용과 올바른 내용을 적어 주세요. 개인정보는 입력하지 마세요. 요청 내용은 운영자만 확인합니다.'),label=node('label','수정할 내용'),input=node('textarea'),trap=node('input'),status=node('p'),actions=node('div'),cancel=node('button','취소'),submit=node('button','요청 보내기');
  heading.id='correction-title';dialog.setAttribute('aria-labelledby',heading.id);input.required=true;input.maxLength=2000;input.rows=6;label.append(input);trap.name='website';trap.tabIndex=-1;trap.autocomplete='off';trap.hidden=true;status.setAttribute('role','status');cancel.type='button';submit.type='submit';actions.className='correction-actions';actions.append(cancel,submit);form.append(heading,page,help,label,trap,status,actions);dialog.append(form);section.append(dialog);
  let sending=false,requestID=crypto.randomUUID();cancel.onclick=()=>dialog.close();dialog.oncancel=event=>{if(sending)event.preventDefault()};dialog.onclose=()=>{dialog.remove();if(button.isConnected)button.focus()};
  form.onsubmit=async event=>{event.preventDefault();if(sending||!input.value.trim()){status.textContent='수정할 내용을 입력해 주세요.';return}const content=input.value;sending=true;input.disabled=true;submit.disabled=true;cancel.disabled=true;status.textContent='요청을 보내는 중입니다.';
   try{const response=await fetch('/api/correction-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,record_id:record.id,content,request_id:requestID,website:trap.value}),signal:AbortSignal.timeout(20000)});const body=await response.json();if(!response.ok)throw Error(body.error||'요청을 보내지 못했습니다.');result.textContent='수정 요청이 접수되었습니다.';dialog.close()}catch(error){status.textContent=error.name==='TimeoutError'?'연결 시간이 초과되었습니다. 입력 내용은 유지됩니다. 다시 시도해 주세요.':error.message}finally{sending=false;input.disabled=false;submit.disabled=false;cancel.disabled=false}
  };dialog.showModal();input.focus();
 };
 return section;
}
