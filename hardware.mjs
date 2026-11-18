// Input timing is independent of rendering and microphone permission latency.
export const RECORD_HOLD_MS = 500;
export function createHoldKey({onShort,onLong,onRelease,onCancel,schedule=setTimeout,cancel=clearTimeout}) {
 let down=false,long=false,timer=null;
 function reset(){if(timer!==null)cancel(timer);timer=null;down=false;}
 return {
  press(){if(down)return;down=true;long=false;timer=schedule(()=>{timer=null;if(down){long=true;onLong();}},RECORD_HOLD_MS);},
  release(){if(!down)return;const held=long;reset();if(held)onRelease();else onShort();},
  cancel(){if(!down)return;const held=long;reset();if(held)onCancel();},
  get pressed(){return down;}
 };
}
export function moveIndex(index,direction,length){return length?(Math.max(0,index)+direction+length)%length:0;}
