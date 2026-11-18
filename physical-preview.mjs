// Calibrate CSS pixels against a ruler, independently of device state.
export function initPhysicalPreview(onChange) {
  const key='paiju-display-calibration-v1', base=96/25.4;
  let factor=1, calibrated=false;
  const $=s=>document.querySelector(s);
  try {
    const saved=JSON.parse(localStorage.getItem(key));
    if(saved && Number.isFinite(saved.factor) && saved.factor>=.2 && saved.factor<=4 && saved.dpr===devicePixelRatio){factor=saved.factor;calibrated=true;}
  } catch {}
  function paint(){
    $('#calibration-line').style.width=`${50*base*factor}px`;
    $('#calibration-status').textContent=calibrated?'已按测量值校准。请复测线长是否为 50 毫米。':'尚未校准：先用尺子测量下方线段。';
    onChange();
  }
  $('#calibration-form').addEventListener('submit',e=>{
    e.preventDefault();
    const input=$('#measured-length'), measured=input.valueAsNumber;
    const next=factor*50/measured;
    if(!Number.isFinite(next)||measured<10||measured>300||next<.2||next>4){input.setCustomValidity('请输入尺子测到的实际长度（10～300 毫米）。');input.reportValidity();return;}
    factor=next;calibrated=true;
    try{localStorage.setItem(key,JSON.stringify({factor,dpr:devicePixelRatio}));}catch{}
    input.value='';paint();
  });
  $('#measured-length').addEventListener('input',e=>e.target.setCustomValidity(''));
  $('#reset-calibration').addEventListener('click',()=>{
    factor=1;calibrated=false;try{localStorage.removeItem(key);}catch{}
    $('#measured-length').value='';paint();
  });
  let dpr=devicePixelRatio;
  window.addEventListener('resize',()=>{
    if(dpr!==devicePixelRatio){dpr=devicePixelRatio;calibrated=false;try{localStorage.removeItem(key);}catch{}paint();}
  });
  $('#calibration-line').style.width=`${50*base*factor}px`;
  $('#calibration-status').textContent=calibrated?'已恢复校准，请复测线长是否为 50 毫米。':'尚未校准：先用尺子测量下方线段。';
  return {scale:()=>43.2*base*factor/240};
}
