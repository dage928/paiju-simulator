import { copy, elapsed, pauseDuel, newSession, GAMES } from './core.mjs';
export const HISTORY_LIMIT = 30;
export const STAGES = ['晋级32强','晋级16强','晋级8强','晋级4强','半决赛','决赛'];
export const FORMATS = { swiss:'瑞士轮', knockout:'淘汰赛', practice:'练习赛' };
export const RESULTS = { win:'胜', loss:'负', draw:'平' };
export function hasDuel(s) { return !!s && !['idle','completed'].includes(s.matchStatus) && (!!s.matchStatus || s.events.length > 0); }
export function migrateLibrary(lib) {
  lib.schedule ??= {};
  lib.active.matchStatus ??= lib.active.events.length ? (lib.active.turnClock?.phase==='running'?'playing':'draft') : 'idle';
  return lib;
}
export function visibleEvents(s) {
  const hidden = new Set(), stack = [];
  for (const e of s.events) {
    if (e.type==='undo') {
      const id=e.undoes || stack.at(-1);
      if(id){hidden.add(id);const index=stack.lastIndexOf(id);if(index>=0)stack.splice(index,1);}
    } else if (['counter','damage','status','turn'].includes(e.type) || e.undoable) stack.push(e.id);
  }
  return s.events.filter(e=>e.type!=='undo'&&!hidden.has(e.id));
}
export function nextSchedule(lib, game) {
  const last=lib.schedule?.[game] || {};
  return { format:FORMATS[last.format]?last.format:'swiss', round:Math.min(99,Math.max(1,(last.format==='swiss'?(last.round||0):0)+1)), stage:Math.min(STAGES.length-1,Math.max(0,last.format==='knockout'&&Number.isInteger(last.stage)?last.stage+1:0)), practice:Math.max(1,(last.practiceCount||0)+1), result:null };
}
export function beginSettlement(lib, now=Date.now()) {
  const s=lib.active;if(!hasDuel(s))return false;
  if(s.matchStatus==='settling')return true;
  s.timer.elapsed=elapsed(s,now);s.timer.startedAt=null;pauseDuel(s,now);
  s.matchStatus='settling';s.settlement=nextSchedule(lib,s.game);s.settlementStep='format';return true;
}
export function validSettlement(m) {
  return !!m && !!FORMATS[m.format] && !!RESULTS[m.result] &&
    (m.format!=='swiss'||Number.isInteger(m.round)&&m.round>=1&&m.round<=99) &&
    (m.format!=='knockout'||Number.isInteger(m.stage)&&m.stage>=0&&m.stage<STAGES.length) &&
    (m.format!=='practice'||Number.isInteger(m.practice)&&m.practice>=1);
}
export function finishDuel(lib, now=Date.now()) {
  const s=lib.active;
  if(s.matchStatus!=='settling'||!validSettlement(s.settlement))return {ok:false,reason:'incomplete'};
  if(lib.archives.length>=HISTORY_LIMIT)return {ok:false,reason:'full'};
  const saved=copy(s);saved.matchStatus='completed';saved.completedAt=now;saved.undo=[];
  lib.archives.unshift(saved);
  const previous=lib.schedule[s.game]||{};
  lib.schedule[s.game]={...previous,...copy(s.settlement),practiceCount:s.settlement.format==='practice'?s.settlement.practice:(previous.practiceCount||0)};
  lib.active=newSession(s.game,{mode:s.mode,names:s.players.map(p=>p.name)},now);lib.active.matchStatus='idle';
  return {ok:true,record:saved};
}
export function chineseRound(n) {
  const d=['零','一','二','三','四','五','六','七','八','九'];
  return n<10?d[n]:`${n>=20?d[Math.floor(n/10)]:''}十${n%10?d[n%10]:''}`;
}
export function recordTitle(s) {
  const m=s.settlement;
  if(!validSettlement(m))return `${GAMES[s.game].name} · 未分类对局`;
  return `${m.format==='swiss'?`瑞士轮第${chineseRound(m.round)}轮`:m.format==='knockout'?`淘汰赛${STAGES[m.stage]}`:`练习赛${m.practice}`}${RESULTS[m.result]}`;
}
export function recordingTarget(lib, viewId=null) {
  return viewId ? lib.archives.find(s=>s.id===viewId)||null : hasDuel(lib.active)?lib.active:null;
}
export function audioIds(s) { return [...new Set(s.events.filter(e=>e.type==='audio').map(e=>e.audioId).filter(Boolean))]; }
