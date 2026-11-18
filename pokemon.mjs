import {copy,event,turnTimes,formatTime} from './core.mjs';

export const POKEMON_STEPS=['填能','支援者','竞技场'];
export function ensurePokemonTurn(session){
  if(session.game!=='pokemon')return;
  session.pokemonTurn??={used:[false,false,false]};
  return session.pokemonTurn;
}
function rememberPokemon(session){
  session.undo.push({pokemonUndo:true,pokemonTurn:copy(ensurePokemonTurn(session)),turn:session.turn,clockActive:session.turnClock.active,eventCursor:session.events.length});
  if(session.undo.length>100)session.undo.shift();
}
export function markPokemonStep(session,index,now=Date.now()){
  if(session.game!=='pokemon'||session.turnClock?.phase!=='running'||![0,1,2].includes(index))return false;
  const state=ensurePokemonTurn(session);rememberPokemon(session);
  state.used[index]=!state.used[index];
  event(session,'pokemon-step',`${session.turnClock.active?'对方':'己方'} · ${POKEMON_STEPS[index]} · ${state.used[index]?'已使用':'取消标记'}`,{step:index,used:state.used[index],undoable:true},now);
  return true;
}
function handoff(session,player,now){
  const clock=session.turnClock;clock.totals=turnTimes(session,now);clock.active=player;clock.startedAt=now;
}
export function flipPokemonTurn(session,now=Date.now()){
  if(session.game!=='pokemon'||session.turnClock?.phase!=='running')return false;
  rememberPokemon(session);handoff(session,1-session.turnClock.active,now);
  session.turn+=1;session.pokemonTurn.used=[false,false,false];
  event(session,'pokemon-turn',`第 ${session.turn} 回合 · ${session.turnClock.active?'对方':'己方'} · 提示已复原`,{undoable:true},now);
  return true;
}
export function undoPokemon(session,now=Date.now()){
  if(session.game!=='pokemon'||session.turnClock?.phase!=='running'||!session.undo.at(-1)?.pokemonUndo)return false;
  const previous=session.undo.pop();
  if(session.turnClock.active!==previous.clockActive)handoff(session,previous.clockActive,now);
  session.pokemonTurn=copy(previous.pokemonTurn);session.turn=previous.turn;
  event(session,'undo','撤回上一次提示或回合翻转',{undoes:session.events[previous.eventCursor]?.id},now);
  return true;
}
export function resetPokemonBoard(session){
  if(session.game!=='pokemon')return false;
  session.pokemonTurn={used:[false,false,false]};session.turn=1;session.undo=[];
  return true;
}
export function resumePokemonClock(session){
  if(session.game!=='pokemon'||session.matchStatus!=='playing'||session.turnClock?.phase!=='ready')return false;
  session.turnClock.phase='paused';return true;
}
export function pokemonBoard(session,icon,now){
  const state=ensurePokemonTurn(session),active=session.turnClock.active,times=turnTimes(session,now);
  const clock=i=>`<div class="pokemon-clock ${i?'opponent':''} ${active===i?'running':''}" data-clock-player="${i}"><span>${icon(active===i?'play':'pause')}${i?'对方':'己方'}</span><time data-turn-time="${i}">${formatTime(times[i])}</time></div>`;
  return `<div class="pokemon-board">${clock(1)}<div class="pokemon-rotor" style="--pokemon-angle:${active?180:0}deg"><div class="pokemon-reminders" aria-label="本回合提示">${POKEMON_STEPS.map((label,index)=>`<button class="pokemon-reminder" data-action="pokemon-mark" data-index="${index}" aria-pressed="${state.used[index]}">${state.used[index]?icon('check'):icon(['energy','supporter','stadium'][index])}<strong>${label}</strong><span>${state.used[index]?'已使用':'未使用'}</span></button>`).join('')}<button class="pokemon-reminder pokemon-coin" data-action="duel-coin">${icon('coin')}<strong>抛硬币</strong></button></div><footer class="pokemon-turn-footer"><span>回合 ${session.turn}</span><button data-action="undo" aria-label="撤回上一次标记或翻转" ${session.undo.at(-1)?.pokemonUndo?'':'disabled'}>${icon('undo')}</button><button data-go="more" aria-label="菜单">${icon('more')}</button></footer></div>${clock(0)}</div>`;
}
const pips={2:[[23,23],[57,57]],3:[[23,23],[40,40],[57,57]],4:[[23,23],[57,23],[23,57],[57,57]],5:[[23,23],[57,23],[40,40],[23,57],[57,57]],6:[[23,23],[57,23],[23,40],[57,40],[23,57],[57,57]]};
// Geometric ball emblems are shared by the coin faces and the single die pip.
function ballSymbol(head=true){
 return `<circle cx="40" cy="40" r="31" fill="#f6f8fc"/><path d="M9 40a31 31 0 0 1 62 0Z" fill="${head?'#d73545':'#286ac0'}"/>${head?'':'<path d="m19 25 8 10m34-10-8 10" fill="none" stroke="#e74752" stroke-width="7" stroke-linecap="round"/>'}<circle cx="40" cy="40" r="31" fill="none" stroke="#19324c" stroke-width="3"/><path d="M9 40h62" stroke="#19324c" stroke-width="6"/><circle cx="40" cy="40" r="11" fill="#f6f8fc" stroke="#19324c" stroke-width="4"/><circle cx="40" cy="40" r="5" fill="#f6f8fc" stroke="#829ab4" stroke-width="1.5"/>`;
}
export function pokemonCoinFace(value){
 return `<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="37" fill="#ffde59" stroke="#d6ad32" stroke-width="3"/>${ballSymbol(value===1)}</svg>`;
}
export function pokemonDieFace(value){
 const mark=value===1?`<g class="pokemon-ball-pip" transform="translate(15 15) scale(.625)">${ballSymbol(true)}</g>`:(pips[value]||pips[6]).map(([x,y])=>`<circle cx="${x}" cy="${y}" r="5" fill="#19324c"/>`).join('');
 return `<svg viewBox="0 0 80 80" aria-hidden="true"><rect x="2" y="2" width="76" height="76" rx="7" fill="#f6f8fc" stroke="#829ab4" stroke-width="2"/>${mark}</svg>`;
}
export function pokemonDiceFaces(value){
 const right=[1,2,3,4,5,6].find(n=>n!==value&&n!==7-value);
 const top=[1,2,3,4,5,6].find(n=>![value,7-value,right,7-right].includes(n));
 return [value,7-value,right,7-right,top,7-top];
}
export function pokemonArtwork(kind,value,rolling=false){
 if(kind==='coin')return `<span class="pokemon-random-art pokemon-coin-stage ${rolling?'is-flipping':''}" aria-hidden="true"><span class="pokemon-art-shadow"></span><span class="pokemon-coin-lift"><span class="pokemon-coin-spin">${[-1.5,0,1.5].map(z=>`<span class="pokemon-coin-edge" style="transform:translateZ(${z}px)"></span>`).join('')}<span class="pokemon-coin-face coin-front" data-coin-value="${value}">${pokemonCoinFace(value)}</span><span class="pokemon-coin-face coin-back">${pokemonCoinFace(1-value)}</span></span></span></span>`;
 const sides=['front','back','right','left','top','bottom'];
 return `<span class="pokemon-random-art pokemon-dice-stage ${rolling?'is-rolling':''}" aria-hidden="true"><span class="pokemon-art-shadow"></span><span class="pokemon-dice-lift"><span class="pokemon-dice-cube">${pokemonDiceFaces(value).map((n,i)=>`<span class="pokemon-die-face face-${sides[i]}" data-face-value="${n}">${pokemonDieFace(n)}</span>`).join('')}</span></span></span>`;
}
