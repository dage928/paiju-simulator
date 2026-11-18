import { FORMATS, RESULTS, STAGES } from './match.mjs';
import { moveIndex } from './hardware.mjs';
// Confirmation moves the cursor; it does not archive or change game data.
export function confirmSettlementRow(session) {
 const m=session.settlement,step=session.settlementStep||'format';
 if(step==='format')session.settlementStep=m.format==='practice'?'result':'stage';
 else if(step==='stage')session.settlementStep='result';
 else if(step==='result'){m.result ||= 'win';session.settlementStep='recap';}
 return session.settlementStep;
}
export function adjustSettlementRow(session,direction) {
 const m=session.settlement,step=session.settlementStep||'format';
 if(step==='format'){const keys=Object.keys(FORMATS);m.format=keys[moveIndex(keys.indexOf(m.format),direction,keys.length)];}
 else if(step==='stage'){if(m.format==='swiss')m.round=Math.max(1,Math.min(99,m.round+direction));else if(m.format==='knockout')m.stage=moveIndex(m.stage,direction,STAGES.length);}
 else if(step==='result'){const keys=Object.keys(RESULTS);m.result=keys[moveIndex(keys.indexOf(m.result||'win'),direction,keys.length)];}
}
