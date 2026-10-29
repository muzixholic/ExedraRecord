// 기억·포트레이트 화면에서 같은 확인 절차를 사용합니다.
window.setupServerSync=function({native,online,run,message,isDirty,reload}){
 const dialog=document.createElement('dialog');dialog.setAttribute('aria-labelledby','server-sync-heading');
 const heading=document.createElement('h2');heading.id='server-sync-heading';heading.textContent='서버 자료로 로컬 전체 갱신';
 const summary=document.createElement('p'),help=document.createElement('p');help.textContent='서버의 공개 기억·포트레이트·캐릭터 공통 정보와 연결 이미지를 가져옵니다. 로컬에만 있는 기억·포트레이트도 목록에서 제거됩니다. 기존 자료는 자동 백업하며 사용하지 않는 이미지 파일은 삭제하지 않습니다. 서버의 비공개 자료와 수정 요청은 대상이 아닙니다.';
 const controls=document.createElement('div');controls.className='button-row';const cancel=document.createElement('button'),confirm=document.createElement('button');cancel.textContent='갱신하지 않기';confirm.textContent='백업 후 로컬 전체 갱신';confirm.className='primary';controls.append(cancel,confirm);dialog.append(heading,summary,help,controls);document.body.append(dialog);
 let prepared=false,working=false;
 const reset=()=>{prepared=false;dialog.close()};cancel.onclick=reset;dialog.oncancel=()=>{if(working)return false;prepared=false};
 document.querySelector('#server-sync').onclick=()=>run(async()=>{
  if(isDirty())throw Error('편집 중인 자료를 먼저 저장해 주세요.');prepared=false;
  message('서버 자료를 내려받아 검증합니다. 아직 로컬 원본은 변경하지 않습니다.');
  const plan=await online('prepareSync');const c=plan.changes;
  summary.textContent='기억 '+plan.count+'개 · 포트레이트 '+plan.portraitCount+'개 · 이미지 '+plan.imageCount+'개\n파일 기준 추가 '+c.added+'개 · 교체 '+c.updated+'개 · 삭제 '+c.removed+'개 · 동일 '+c.unchanged+'개';summary.style.whiteSpace='pre-line';
  prepared=true;dialog.showModal();cancel.focus();
 });
 confirm.onclick=()=>{if(!prepared||working)return;working=true;confirm.disabled=true;cancel.disabled=true;dialog.close();run(async()=>{
  try{if(isDirty())throw Error('편집 중인 자료를 먼저 저장해 주세요.');message('로컬 자료를 백업하고 교체합니다. 앱을 종료하지 마세요.');const result=await native('applySync');await reload();message('서버 자료로 로컬 갱신 완료 · 기억 '+result.count+'개 · 포트레이트 '+result.portraitCount+'개 · 이미지 '+result.imageCount+'개\n갱신 전 자료 백업: '+result.backup)}finally{prepared=false;working=false;confirm.disabled=false;cancel.disabled=false}
 })};
};
