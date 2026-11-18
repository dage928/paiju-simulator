import { setCounter, setExperience, turnTimes, formatTime, switchDuelTurn } from './core.mjs';

export const RIFT_STATS={score:'得分',experience:'经验值'};
export function changeRiftStat(session,player,stat,delta,now=Date.now()){
  if(session.game!=='rift'||!RIFT_STATS[stat]||![0,1].includes(player)||![-1,1].includes(delta))return false;
  const p=session.players[player];
  return stat==='experience'?setExperience(session,player,(p.experience??0)+delta,now):setCounter(session,player,p.value+delta,now);
}
// Legacy counters remain intact. Unknown historical clock allocation stays unassigned.
export function resumeRiftClock(session){
  if(session.game!=='rift'||session.matchStatus!=='playing'||!session.events.length||session.turnClock?.phase!=='ready')return false;
  session.turnClock.phase='paused';
  return true;
}
// One short press moves scoring and the turn clock to the other side.
export function switchRiftSide(session,now=Date.now()){
  if(session.game!=='rift'||session.turnClock?.phase!=='running')return false;
  if(session.mode===1){switchDuelTurn(session,now);session.selected=0;return true;}
  const next=1-session.selected;
  if(session.turnClock.active!==next)switchDuelTurn(session,now);
  session.selected=next;
  return true;
}
export function riftBoard(session,icon,now){
  const totals=turnTimes(session,now);
  const adjust=(i,kind,delta,value)=>`<button data-action="rift-change" data-player="${i}" data-stat="${kind}" data-delta="${delta}" aria-label="${i?'对方':'己方'}${delta>0?'增加':'减少'}${RIFT_STATS[kind]}" ${delta<0&&value===0||delta>0&&value===999?'disabled':''}>${delta>0?'＋':'−'}</button>`;
  const panel=i=>{
    const p=session.players[i],xp=p.experience??0,who=i?'对方':'己方';
    const value=(kind,n)=>kind==='experience'?`<div class="rift-value rift-xp-value" aria-label="${who}经验值，当前${n}"><strong>${n}</strong><span>经验值</span></div>`:`<button class="rift-value rift-score ${session.selected===i?'rift-selected':''}" data-action="rift-select" data-player="${i}" aria-label="选择${who}得分，当前${n}" aria-pressed="${session.selected===i}"><strong>${n}</strong><span>得分</span></button>`;
    return `<section class="rift-player ${i===1&&session.mode===2?'opponent':''}"><div class="rift-clock ${session.turnClock.active===i?'running':''}"><span>${session.turnClock.active===i?icon('play'):icon('pause')}${who}</span><time data-turn-time="${i}">${formatTime(totals[i])}</time></div><div class="rift-score-row">${adjust(i,'score',-1,p.value)}${value('score',p.value)}${adjust(i,'score',1,p.value)}</div><div class="rift-xp-row">${value('experience',xp)}${adjust(i,'experience',-1,xp)}${adjust(i,'experience',1,xp)}</div></section>`;
  };
  return `<div class="rift-board ${session.mode===1?'rift-solo':''}">${session.mode===2?panel(1):`<div class="rift-opponent-clock">对方用时 <time data-turn-time="1">${formatTime(totals[1])}</time></div>`}<nav class="rift-axis" aria-label="对局工具"><button data-action="undo" aria-label="撤销" ${session.undo.length?'':'disabled'}>${icon('undo')}</button><button data-action="rift-dice" aria-label="掷骰子">${icon('dice')}</button><button data-go="more" aria-label="更多">${icon('more')}</button></nav>${panel(0)}</div>`;
}
export const RIFT_DICE_ROLL_MS=1120;
export const RIFT_COIN_FLIP_MS=1200;
const DIE_PIPS={1:[[40,40]],2:[[22,22],[58,58]],3:[[22,22],[40,40],[58,58]],4:[[22,22],[58,22],[22,58],[58,58]],5:[[22,22],[58,22],[40,40],[22,58],[58,58]],6:[[22,22],[58,22],[22,40],[58,40],[22,58],[58,58]]};
export function riftDieFace(value){
  const pips=value===1?`<g class="rift-rune"><path d="M40 17 55 34 40 63 25 46Z"/><path d="m40 27 7 8-13 12 6 6"/></g>`:DIE_PIPS[value].map(([x,y])=>`<circle class="rift-pip" cx="${x}" cy="${y}" r="5"/>`).join('');
  return `<svg viewBox="0 0 80 80" aria-hidden="true"><rect x="2" y="2" width="76" height="76" rx="6"/>${pips}</svg>`;
}
export function riftDiceFaces(value){
  const right=[1,2,3,4,5,6].find(n=>n!==value&&n!==7-value);
  const top=[1,2,3,4,5,6].find(n=>![value,7-value,right,7-right].includes(n));
  return [value,7-value,right,7-right,top,7-top];
}
export function riftCoinFace(n){return `<svg viewBox="0 0 80 80"><circle class="coin-disc-fill" cx="40" cy="40" r="36"/><circle class="coin-inner-ring" cx="40" cy="40" r="29"/><path class="coin-marks" d="M40 8v5m0 54v5M8 40h5m54 0h5M17 17l4 4m38 38 4 4M17 63l4-4m38-38 4-4"/>${n?'<g class="coin-sigil"><path d="M40 19 55 35 40 61 25 45Z"/><path class="coin-sigil-cut" d="m40 28 7 8-13 12 6 5"/></g>':'<g class="coin-sigil"><path d="m37 20-15 20 15 20-6-20Zm6 0 15 20-15 20 6-20Z"/><path d="m40 32 5 8-5 8-5-8Z"/></g>'}</svg>`;}
export function riftArtwork(kind,value,rolling=false){
  if(kind==='coin'){
    return `<span class="rift-coin-stage ${rolling?'is-flipping':''}" style="--rift-flip-ms:${RIFT_COIN_FLIP_MS}ms" aria-hidden="true"><span class="rift-coin-shadow"></span><span class="rift-coin-lift"><span class="rift-coin-spin">${[-2,-1,0,1,2].map(z=>`<span class="rift-coin-edge" style="transform:translateZ(${z}px)"></span>`).join('')}<span class="rift-coin-face coin-front ${value?'coin-head':'coin-tail'}" data-coin-value="${value}">${riftCoinFace(value)}</span><span class="rift-coin-face coin-back ${value?'coin-tail':'coin-head'}">${riftCoinFace(1-value)}</span></span></span></span>`;
  }
  const sides=['front','back','right','left','top','bottom'];
  return `<span class="rift-dice-stage ${rolling?'is-rolling':''}" style="--rift-roll-ms:${RIFT_DICE_ROLL_MS}ms" aria-hidden="true"><span class="rift-dice-shadow"></span><span class="rift-dice-lift"><span class="rift-dice-cube">${riftDiceFaces(value).map((n,i)=>`<span class="rift-dice-face face-${sides[i]}" data-face-value="${n}">${riftDieFace(n)}</span>`).join('')}</span></span></span>`;
}
