import { homeScreen, nextHomeGame, homeSwipeDirection, createHomeEntrance } from './home.mjs';
import { volume } from './volume.mjs';
import { createVolumePanel } from './volume-panel.mjs';
import { RIFT_COIN_FLIP_MS, RIFT_DICE_ROLL_MS, switchRiftSide, changeRiftStat, riftBoard, riftDieFace, riftCoinFace, riftArtwork, resumeRiftClock } from './rift.mjs';
import {pokemonBoard,ensurePokemonTurn,markPokemonStep,flipPokemonTurn,undoPokemon,resetPokemonBoard,resumePokemonClock,pokemonArtwork} from './pokemon.mjs';
import { initPhysicalPreview } from './physical-preview.mjs';
import { confirmSettlementRow, adjustSettlementRow } from './settlement.mjs';
import { createHoldKey, moveIndex } from './hardware.mjs';
import { HISTORY_LIMIT, STAGES, FORMATS, RESULTS, hasDuel, migrateLibrary, visibleEvents, nextSchedule, beginSettlement, finishDuel, recordTitle, recordingTarget, audioIds } from './match.mjs';
import { createLifeRoll } from './life-roll.mjs';
import { playEffect, stopEffect, stopEffects } from './effects.mjs';
import { setDisplayMode, usesTurnClock, GAMES, newSession, copy, event, elapsed, remaining, formatTime, setCounter, changeDamage, toggleStatus, nextTurn, undo, toggleTimer, resetTimer, roll, isSession, ensureTurnClock, turnTimes, startDuel, switchDuelTurn, pauseDuel, prepareDuel } from './core.mjs';

const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const icons = {
  check:'<path d="m5 12 4 4L20 5"/>',energy:'<path d="m14 2-9 12h6l-1 8 9-13h-7z"/>',supporter:'<circle cx="12" cy="7" r="4"/><path d="M5 22v-3a7 7 0 0 1 14 0v3"/>',stadium:'<ellipse cx="12" cy="8" rx="9" ry="4"/><path d="M3 8v9c0 5 18 5 18 0V8M7 12v6m5-5v6m5-7v6"/>',
  back:'<path d="m14 5-7 7 7 7"/>', down:'<path d="m7 10 5 5 5-5"/>', arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  count:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"/>',
  coin:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><path d="M12 8v8"/>',
  timer:'<circle cx="12" cy="13" r="8"/><path d="M9 2h6M12 5V2M12 9v5l3 1"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  undo:'<path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 7 7v3"/>',
  play:'<path d="m8 4 12 8-12 8z"/>', pause:'<path d="M8 5v14M16 5v14"/>',
  mic:'<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
  note:'<path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4"/>',
  settings:'<path d="M4 7h5m4 0h7M4 17h9m4 0h3"/><circle cx="11" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
  history:'<path d="M3 11a9 9 0 1 1 2 7M3 5v6h6M12 7v6l4 2"/>',
  turn:'<path d="M4 7h15l-4-4M20 17H5l4 4M19 7l-4 4M5 17l4-4"/>',
  export:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', damage:'<path d="m13 2-8 12h6l-1 8 9-13h-7z"/>',
  dice:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 7h.01M17 7h.01M12 12h.01M7 17h.01M17 17h.01"/>'
};
const icon = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[n] || icons.note}</svg>`;
const STORAGE_KEY = 'paiju-library-v1';
let library = { recordRevision:2, active:newSession(), archives:[] }, storageOK = true;
try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const p = JSON.parse(raw); if(p.recordRevision!==2){library={recordRevision:2,cleanupPending:true,active:newSession(),archives:[]};}else if (isSession(p.active) && Array.isArray(p.archives) && p.archives.every(isSession)) library = p; else warnStorage('旧记录未能读取，已保留原始数据。请先导出原始备份。'); } }
catch { warnStorage('浏览器不允许本机保存，请及时导出备份。'); }
migrateLibrary(library);
let session = library.active;
ensureTurnClock(session);
let ui = { page:'home', hubIndex:0, selectedGame:session.game, viewId:null, recordTab:'events', recordBack:'history', historyReturn:'home', back:'more', player:session.selected, slot:0, amount:'0', calcMode:'subtract', filter:'all', randomKind:'coin', coinCount:1, randomBusy:false, detail:null, notice:'', confirm:null };
let audioDBPromise, recording = null, recorderBusy = false, recordPending = false, holdRequested = false, recordError = '', journalFilter = 'all';
let noticeTimeout, randomTimeout, playingAudio = null, playingAudioId = null, audioURL = null;
const clockStart = () => usesTurnClock(session) ? session.turnClock?.startedAt ?? null : session.timer.startedAt;
let anchor = { id:session.id, startedAt:clockStart(), time:performance.now(), carried:clockStart() === null ? 0 : Math.max(0,Date.now()-clockStart()) };
let zoomChoice = 1.35;
let hwScope='',hwIndex=0;

const lifeRolls=new Map();let lifeFrame=0,lifeSessionId=session.id;
function warnStorage(text) { storageOK = false; $('#save-indicator').textContent = '请导出备份'; $('#host-message').textContent = text; $('.data-note').classList.add('error'); }
function save() { if (!storageOK) return false; try { localStorage.setItem(STORAGE_KEY,JSON.stringify(library)); $('#save-indicator').textContent = '记录已保存在本机'; return true; } catch { warnStorage('本机保存失败，请导出备份后清理空间。'); return false; } }
function clockNow() {
  const startedAt = clockStart();
  if (anchor.id !== session.id || anchor.startedAt !== startedAt) anchor = { id:session.id, startedAt, time:performance.now(), carried:0 };
  return startedAt === null ? Date.now() : startedAt + anchor.carried + Math.max(0,performance.now()-anchor.time);
}
function sound(name){if(session.game==='ygo'&&!recording&&!recordPending&&!recorderBusy&&!(playingAudio&&!playingAudio.paused))return playEffect(name);}
function act(fn) {
 const before=session.events.length, at=performance.now();
 const displayed=session.players.map((p,i)=>lifeRolls.get(i)?.sample(at).value??p.value);
 fn(clockNow());save();
 const change=session.events.length>before?session.events.at(-1):null;
 if(session.game==='ygo'&&change?.type==='counter'){
   const cue=sound('life');
   lifeRolls.set(change.player,createLifeRoll(displayed[change.player],change.after,cue,performance.now(),matchMedia('(prefers-reduced-motion: reduce)').matches));
 }else if(change?.type==='undo')clearLifeRolls();
 render();
 if(change?.type==='duel')sound('start');else if(change?.type==='duel-turn')sound('turn');
 if(lifeRolls.size&&!lifeFrame)lifeFrame=requestAnimationFrame(tickLifeRolls);
}
function clearLifeRolls(){stopEffect('life');lifeRolls.clear();cancelAnimationFrame(lifeFrame);lifeFrame=0;}
function paintLifeRolls(){
 const at=performance.now();
 for(const [player,roll] of lifeRolls){
  const sample=roll.sample(at),node=document.querySelector(`.duel-life[data-player="${player}"]`);
  if(node){node.textContent=String(sample.value);node.classList.toggle('life-rolling',!sample.done);}
  if(sample.done)lifeRolls.delete(player);
 }
}
function tickLifeRolls(){lifeFrame=0;paintLifeRolls();if(lifeRolls.size)lifeFrame=requestAnimationFrame(tickLifeRolls);}

function toast(text) { clearTimeout(noticeTimeout); ui.notice = text; render(); noticeTimeout = setTimeout(()=>{ ui.notice=''; render(); },2500); }
function renderJournal() { render(); }
function closeModal() { ui.confirm = null; ui.page='more'; render(); }
function confirmation(title,text,callback,label='确认') { ui.confirm={title,text,callback,label}; render(); }
function hasRecording() { if (recording || recordPending || recorderBusy) { toast('请先完成录音保存'); return true; } return false; }
function title(name,back='count',right='') { const compact=usesTurnClock(session);return `<div class="screen-titlebar${compact?' compact-backbar':''}" aria-label="${esc(name)}"><button class="screen-back" data-go="${back}" aria-label="返回">${icon('back')}</button><span>${compact?'':name}</span><span class="right">${right}</span></div>`; }
function action(label,name,extra='',secondary=false) { const extraClass=extra.match(/class="([^"]*)"/)?.[1]||'';extra=extra.replace(/class="[^"]*"/,'');return `<button class="screen-action${secondary?' secondary':''} ${extraClass}" data-action="${name}" ${extra}>${label}</button>`; }
function pauseSnapshot(s=session) { const p=copy(s); p.timer.elapsed=elapsed(s,s===session?clockNow():Date.now()); p.timer.startedAt=null; pauseDuel(p,s===session?clockNow():Date.now()); return p; }
function render() {
  ensureTurnClock(session);
  resumeRiftClock(session);
  resumePokemonClock(session);
  ensurePokemonTurn(session);
  if(lifeSessionId!==session.id){clearLifeRolls();lifeSessionId=session.id;}
  const surfaceGame=['home','history'].includes(ui.page)?ui.selectedGame:ui.viewId?recordSource().game:session.game;
  document.body.classList.toggle('rift-theme',surfaceGame==='rift');
  document.body.classList.toggle('ygo-theme',surfaceGame==='ygo');
  document.body.classList.toggle('pokemon-theme',surfaceGame==='pokemon');
  const screen=$('#device-screen');
  if(ui.page!=='home')homeEntrance.leave();
  if(flowPage()){renderFlow(screen);volumePanel.sync();paintHardwareFocus();updateLive();renderManager();return;}
  const active = ['count','adjust','damage','statuses','slot-edit','games'].includes(ui.page)?'count':['timer','duration'].includes(ui.page)?'timer':ui.page==='coin'?'coin':'more';
  const overlay = ui.randomPopup||ui.page==='adjust'||recording||recordPending||recorderBusy||ui.confirm;
  screen.innerHTML=`<div class="screen-frame ${usesTurnClock(session)&&['count','order'].includes(ui.page)?'duel-frame':''}"><header class="screen-header" ${overlay?'inert':''}><button class="game-trigger" data-go="${usesTurnClock(session)?'more':'games'}" aria-label="${usesTurnClock(session)?'设备菜单':'选择游戏'}">${esc(GAMES[session.game].name)} ${icon('down')}</button>${usesTurnClock(session)?'<span></span>':`<button class="mini-clock" data-go="timer" aria-label="查看对局计时">${icon('timer')}<span>${formatTime(remaining(session,clockNow()))}</span></button>`}</header><div class="screen-content" ${overlay?'inert':''}>${pageContent()}</div><nav class="screen-nav ${usesTurnClock(session)?'ygo-nav':''}" aria-label="设备功能" ${overlay?'inert':''}>${(usesTurnClock(session)?[['count','count','对局'],['coin',session.game==='rift'?'dice':'coin',session.game==='rift'?'随机':'硬币'],['more','more','更多']]:[['count','count','计数'],['coin','coin','硬币'],['timer','timer','计时'],['more','more','更多']]).map(([p,i,t])=>`<button data-go="${p}" ${active===p?'aria-current="page"':''} aria-label="${t}">${icon(i)}${t}</button>`).join('')}</nav>${ui.page==='adjust'?calculator():''}${ui.randomPopup?randomPopup():''}${recording || recordPending || recorderBusy ? recordingOverlay():''}${ui.confirm?confirmOverlay():''}${ui.notice?`<div class="screen-toast" role="status">${esc(ui.notice)}</div>`:''}</div>`;
  $('#key-select').setAttribute('aria-label',usesTurnClock(session)?(session.turnClock.phase==='running'?'实体切换键，回合结束':'实体切换键，打开菜单'):'实体切换键');
  $('#key-record').classList.toggle('recording',!!recording);
  updateLive();
  paintLifeRolls();
  renderManager();
  volumePanel.sync();
  paintHardwareFocus();
}
function pageContent() {
  switch(ui.page) {
    case 'count':return countPage();
    case 'order':return orderPage();
    case 'coin':return coinPage();
    case 'timer':return timerPage();
    case 'duration':return durationPage();
    case 'games':return gamesPage();
    case 'settings':return settingsPage();
    case 'players':return playersPage();
    case 'more':return morePage();
    case 'damage':return damagePage();
    case 'statuses':return statusesPage();
    case 'slot-edit':return slotEditPage();
    case 'log':return logPage();
    case 'detail':return detailPage();
    case 'note':return notePage();
    case 'history':return historyPage();
    case 'backup':return backupPage();
    default:return '';
  }
}
function halveLife(player){ui.player=player;session.selected=player;ui.page='count';act(now=>setCounter(session,player,Math.floor(session.players[player].value/2),now));}
function openLife(player,mode='subtract') {ui.player=player;session.selected=player;ui.amount='0';ui.calcMode=mode;ui.page='adjust';render();}
function duelPage(){
 const panel=i=>`<section class="duel-player ${i===1?'opponent':''} ${session.selected===i?'selected':''}">${duelClock(i)}<button class="duel-life" data-action="select" data-player="${i}" aria-label="选择${esc(session.players[i].name)}，生命值${session.players[i].value}">${session.players[i].value}</button><div class="duel-actions"><button data-action="minus" data-player="${i}" aria-label="${esc(session.players[i].name)}扣除生命值">−</button><button data-action="open-half" data-player="${i}" aria-label="${esc(session.players[i].name)}生命值减半">½</button><button data-action="plus" data-player="${i}" aria-label="${esc(session.players[i].name)}增加生命值">＋</button></div></section>`;
 const last=session.lastRandom;const face=last?.kind==='coin'?last.results[0]:null;
 const faceIcon=randomArtwork('coin',face===null?1:face);
 return `<div class="duel-board ${session.mode===1?'duel-solo':''}">${session.mode===2?panel(1):`<div class="solo-opponent-clock">${duelClock(1)}</div>`}<div class="duel-axis"><button data-action="undo" aria-label="撤销" ${!session.undo.length?'disabled':''}>${icon('undo')}</button><span aria-hidden="true"></span><button class="duel-coin ${ui.randomBusy?'spinning':''}" data-action="duel-coin" aria-label="抛硬币${face===null?'':face?'，上次正面':'，上次反面'}" ${ui.randomBusy?'disabled':''}>${faceIcon}</button><span aria-hidden="true"></span><button data-go="more" aria-label="更多">${icon('more')}</button></div>${panel(0)}</div>`;
}
function countPage() {
  if(session.game==='pokemon')return session.turnClock.phase==='running'?pokemonBoard(session,icon,clockNow()):session.turnClock.phase==='paused'?orderPage():readyPage();
  if(session.game==='rift')return session.turnClock.phase==='running'?riftBoard(session,icon,clockNow()):session.turnClock.phase==='paused'?orderPage():readyPage();
  if(session.game==='ygo')return session.turnClock.phase==='running'?duelPage():readyPage();
  const g=GAMES[session.game];
  return `<div class="count-page${session.mode===1?' solo':''}">${session.players.slice(0,session.mode).map((p,i)=>`<section class="mini-player${session.selected===i?' selected':''}${ui.face && i?' turned':''}"><div class="mini-player-content"><div class="mini-player-heading"><button data-action="select" data-player="${i}" aria-label="选择${esc(p.name)}"><span class="selection-dot"></span>${esc(p.name)}</button>${session.game==='pokemon'?`<button class="screen-player-note" data-action="open-damage" data-player="${i}">宝可梦伤害 ›</button>`:`<small>${g.label}</small>`}</div><div class="mini-value-row"><button class="mini-step" data-action="minus" data-player="${i}" aria-label="${esc(p.name)}减少${session.step}" ${p.value===0?'disabled':''}>−<small>${session.step}</small></button><button class="mini-value${p.value>99999?' small-value':''}" data-action="adjust" data-player="${i}" aria-label="计算${esc(p.name)}${g.label}，当前${p.value}">${p.value}<span>${g.unit}</span></button><button class="mini-step positive" data-action="plus" data-player="${i}" aria-label="${esc(p.name)}增加${session.step}" ${p.value>=g.max?'disabled':''}>＋<small>${session.step}</small></button></div></div></section>`).join('')}<div class="counter-options"><div class="step-selectors"><span>步长</span>${g.steps.map(n=>`<button data-action="step" data-value="${n}" aria-pressed="${session.step===n}">${n}</button>`).join('')}</div><button class="undo-mini" data-action="undo" ${!session.undo.length?'disabled':''}>${icon('undo')}撤销</button></div><div class="mini-turn"><span>回合 ${session.turn} · ${esc(session.players[session.active].name)}</span><button class="next-turn" data-action="turn" aria-label="下一回合">下一回合${icon('arrow')}</button></div></div>`;
}
function calculator() {
  if(session.game==='ygo')return simpleCalculator();
  const p=session.players[ui.player];
  return `<div class="full-screen calculator ${session.game==='ygo'&&session.mode===2&&ui.player===1?'opponent-calculator':''}"><div class="full-header"><button class="back-button" data-go="count" aria-label="返回计数">${icon('back')}</button><span>${esc(p.name)} · ${GAMES[session.game].label}</span>${session.game==='ygo'?'<button class="header-action" data-action="half">减半</button>':'<span></span>'}</div><div class="calc-value"><small>当前 ${p.value}</small><span>${ui.calcMode==='half'?Math.floor(p.value/2):esc(ui.amount)}</span></div><div class="calc-modes">${[['subtract','扣除'],['add','增加'],['set','设为']].map(([v,t])=>`<button data-action="calc-mode" data-mode="${v}" aria-pressed="${ui.calcMode===v}">${t}</button>`).join('')}</div><div class="keypad" ${ui.calcMode==='half'?'inert style="opacity:.3"':''}>${['1','2','3','4','5','6','7','8','9','清空','0','退格'].map(n=>`<button class="${n.length>1?'utility':''}" data-action="digit" data-digit="${n}" aria-label="输入${n}">${n}</button>`).join('')}</div><button class="calc-submit" data-action="calc-apply">确认${ui.calcMode==='half'?'减半为':ui.calcMode==='subtract'?'扣除':ui.calcMode==='add'?'增加':'设为'} ${ui.calcMode==='half'?Math.floor(p.value/2):esc(ui.amount)}</button></div>`;
}
function coinPage() {
  const last=session.lastRandom, type=ui.randomKind;
  const same=last?.kind===type;
  const text=same?last.results.map(v=>type==='coin'?(v?'正':'反'):v).join(' · '):'结果会自动记入本局';
  const riftDice=session.game==='rift'&&type==='dice',riftCoin=session.game==='rift'&&type==='coin';
  const coinValue=same?last.results[0]:1;
  const face=same?(type==='coin'?(last.results[0]?'正':'反'):String(last.results[0])):(type==='coin'?'?':'6');
  return `<div class="coin-page"><div class="coin-topline"><span>${type==='coin'?'抛硬币':'六面骰'}</span><button data-action="random-kind">${type==='coin'?'切换骰子':'切换硬币'} ›</button></div><div class="coin-disc${riftDice?' rift-dice-preview':riftCoin?' rift-coin-preview':''}${session.game==='pokemon'?' pokemon-preview':session.game==='ygo'?' source-art':''}${ui.randomBusy?' spinning':''}" ${riftDice?`role="img" aria-label="骰子${same?last.results[0]:6}点"`:riftCoin?`role="img" aria-label="${same?(coinValue?'正面':'反面'):'符文硬币预览'}"`:''}>${riftDice?riftDieFace(same?last.results[0]:6):riftCoin?`<span class="rift-coin-face ${coinValue?'coin-head':'coin-tail'}">${riftCoinFace(coinValue)}</span>`:["ygo","pokemon"].includes(session.game)?randomArtwork(type,same?last.results[0]:type==='coin'?1:6):ui.randomBusy?'…':face}</div><div class="coin-results" aria-live="polite">${ui.randomBusy?'正在落下…':esc(text)}</div><div class="coin-amounts">${type==='coin'?[1,3,5,10].map(n=>`<button data-action="coin-count" data-value="${n}" aria-pressed="${ui.coinCount===n}">${n}枚</button>`).join(''):'<span class="screen-hint">1 至 6，等概率随机</span>'}</div>${action(type==='coin'?`抛 ${ui.coinCount} 枚硬币`:'掷骰子','random',ui.randomBusy?'disabled':'')}<p class="coin-footnote">随机结果保留，切页不会重抛。</p></div>`;
}
function timerPage() {
  const running=session.timer.startedAt!==null;
  return `<div class="timer-page"><div class="timer-kind">${session.timer.kind==='up'?'正计时':`${Math.round(session.timer.duration/60000)}分钟倒计时`}</div><div class="timer-big">${formatTime(remaining(session,clockNow()))}</div><p class="timer-caption">${running?'计时中，切换页面仍会继续':session.timer.elapsed?'计时已暂停':'准备好后开始'}</p>${action(icon(running?'pause':'play')+(running?'暂停计时':'开始计时'),'timer-toggle')}<div class="timer-secondary"><button data-go="duration">设置时间</button><button data-action="timer-reset">重置</button></div></div>`;
}
function durationPage() {
  return title('设置计时','timer')+`<div class="page-pad"><div class="split-switch">${[['up','正计时'],['down','倒计时']].map(([k,t])=>`<button data-action="duration-kind" data-kind="${k}" aria-pressed="${ui.timerKind===k}">${t}</button>`).join('')}</div><div class="duration-options">${(session.game==='ygo'?[30,45,50]:[5,15,30,45,50,60]).map(n=>`<button data-action="duration-value" data-value="${n}" aria-pressed="${ui.minutes===n}">${n}分</button>`).join('')}</div><label class="duration-custom">分钟（1–1440）<input id="duration-minutes" aria-label="计时分钟" type="number" min="1" max="1440" value="${ui.minutes}"></label>${action('应用并重置','duration-apply')}</div>`;
}
function gamesPage() {
  return title('选择游戏','count')+`<div class="page-pad"><div class="screen-list">${Object.entries(GAMES).map(([k,g])=>`<button data-action="game" data-game="${k}" class="${session.game===k?'current':''}">${icon(k==='pokemon'?'damage':'count')}<span>${g.name}<small>${g.label}</small></span><span class="trailing">${session.game===k?'当前':'›'}</span></button>`).join('')}</div><p class="screen-hint" style="margin-top:10px">切换游戏时保留当前记录。</p></div>`;
}
function morePage() {
  if(usesTurnClock(session))return ygoMenu();
  return `<div class="more-grid">${[['log','note','对局记录'],['note','mic','复盘记录'],['settings','settings','对局设置'],['history','history','历史对局'],['backup','export','导出 / 导入'],['new','plus','新对局']].map(([p,i,t])=>`<button ${p==='new'?'data-action="new"':`data-go="${p}"`}>${icon(i)}${t}</button>`).join('')}</div>`;
}
function settingsPage() {
  if(usesTurnClock(session))return title('使用人数','more')+`<div class="page-pad"><div class="split-switch mode-switch" role="group" aria-label="使用人数" data-mode="${session.mode}"><button data-action="mode" data-mode="1" aria-pressed="${session.mode===1}">单人</button><button data-action="mode" data-mode="2" aria-pressed="${session.mode===2}">双人共用</button></div><p class="screen-hint">${session.game==='pokemon'?'触屏标记本回合操作。中间键复原三项提示、切换计时并翻转屏幕。':session.game==='rift'?'加减键只改得分；中间键短按切换双方计分与计时。经验值仅触屏加减。':'双人面对面显示。点击血量选择记血对象；实体切换键用于回合结束。'}</p></div>`;
  return title('对局设置','more')+`<div class="page-pad"><div class="split-switch mode-switch" role="group" aria-label="使用人数" data-mode="${session.mode}"><button data-action="mode" data-mode="1" aria-pressed="${session.mode===1}">单人</button><button data-action="mode" data-mode="2" aria-pressed="${session.mode===2}">双人共用</button></div><div class="setting-row"><span>对坐显示</span><button class="setting-switch${ui.face?' on':''}" data-action="face" ${session.mode===1||session.game==='ygo'?'disabled':''}>${session.game==='ygo'&&session.mode===2?'固定对坐':ui.face?'已开启':'已关闭'}</button></div><div class="setting-row"><span>玩家名称</span><button class="setting-switch" data-go="players">修改 ›</button></div><div class="setting-row"><span>当前游戏</span><button class="setting-switch" data-go="games">切换 ›</button></div><p class="screen-hint" style="margin-top:12px">顶部玩家名或实体切换键，选择加减操作的玩家。</p></div>`;
}
function playersPage() {
  return title('玩家名称','settings')+`<div class="page-pad"><div class="settings-form">${session.players.slice(0,session.mode).map((p,i)=>`<label><span class="setting-label">玩家 ${i+1}</span><input class="setting-input" id="player-name-${i}" maxlength="20" value="${esc(p.name)}"></label>`).join('')}${action('保存名称','names-save')}<p class="screen-hint">文字输入暂借用电脑键盘，硬件输入方式后续验证。</p></div></div>`;
}
function damagePage() {
  const p=session.players[ui.player], s=p.slots[ui.slot];
  return title('宝可梦伤害','count','<button data-go="slot-edit">编辑</button>')+`<div class="player-switcher">${session.players.slice(0,session.mode).map((p,i)=>`<button data-action="damage-player" data-player="${i}" aria-pressed="${ui.player===i}">${esc(p.name)}</button>`).join('')}</div><div class="damage-grid">${p.slots.map((s,i)=>`<button data-action="damage-slot" data-slot="${i}" aria-pressed="${ui.slot===i}" aria-label="${esc(s.name)}，${s.damage}点伤害"><span>${esc(s.name)}</span><strong>${s.damage}</strong></button>`).join('')}</div><div class="damage-focus"><div>${esc(s.name)}<br><small>已受伤害</small></div><strong>${s.damage}</strong></div><div class="damage-buttons">${[-100,-10,10,100].map(n=>`<button data-action="damage-change" data-value="${n}" aria-label="伤害${n>0?'增加':'减少'}${Math.abs(n)}" ${n<0&&s.damage===0?'disabled':''}>${n>0?'+':''}${n}</button>`).join('')}</div><div class="damage-state"><span>${s.statuses.length?esc(s.statuses.join(' / ')):'无特殊状态'}</span><button data-go="statuses">状态 ›</button></div>`;
}
function statusesPage() {
  const s=session.players[ui.player].slots[ui.slot];
  return title('特殊状态','damage')+`<div class="page-pad"><div class="status-list">${['中毒','灼伤','睡眠','麻痹','混乱'].map(t=>`<button data-action="status" data-status="${t}" aria-pressed="${s.statuses.includes(t)}">${t}<span>${s.statuses.includes(t)?'已标记':'○'}</span></button>`).join('')}</div><p class="screen-hint" style="margin-top:8px">睡眠、麻痹和混乱互相替换。</p></div>`;
}
function slotEditPage() {
  const s=session.players[ui.player].slots[ui.slot];
  return title('编辑宝可梦','damage')+`<div class="page-pad"><label><span class="setting-label">位置或宝可梦名称</span><input id="slot-name" class="setting-input" maxlength="30" value="${esc(s.name)}"></label><p class="screen-hint" style="margin:10px 0">换上新的宝可梦时，可清空本位置伤害和状态。</p><div class="backup-actions">${action('保存名称','slot-save')}${action('清空伤害与状态','slot-clear','',true)}</div></div>`;
}
function logPage() {
  if(session.game==='ygo')return simpleLog();
  const entries=visibleEvents(session).filter(e=>ui.filter==='all'||['note','audio'].includes(e.type)).slice().reverse();
  return title('对局记录','more',`${entries.length}条`)+`<div class="log-toolbar"><button data-action="filter">${ui.filter==='all'?'全部操作':'复盘记录'} ${icon('down')}</button><button data-go="note">＋ 记复盘</button></div><div class="log-scroll">${entries.length?entries.map(e=>`<button class="log-item" data-action="detail" data-id="${esc(e.id)}"><small>${formatTime(e.elapsed)} · 回合${e.turn}${e.type==='audio'?' · 录音':''}</small><span>${esc(e.text)}</span></button>`).join(''):`<div class="empty-screen"><div>${icon('note')}<br>还没有记录<br>操作会自动留在这里。</div></div>`}</div>`;
}
function detailPage() {
  const e=recordSource().events.find(e=>e.id===ui.detail); if(!e)return title('记录','log')+'<div class="empty-screen">记录不存在</div>';
  return title(e.type==='audio'?'复盘录音':'记录详情',ui.recordBack?'record':'log')+`<div class="page-pad"><p class="screen-hint">${formatTime(e.elapsed)}${usesTurnClock(session)?'':` · 第${e.turn}回合`}</p><p class="detail-text" style="margin-top:10px">${esc(e.text)}</p>${e.type==='audio'?`<div class="audio-detail">${action(icon(playingAudioId===e.audioId&&!playingAudio?.paused?'pause':'play')+(playingAudioId===e.audioId&&!playingAudio?.paused?'暂停':'回听录音'),'play-audio',`data-audio="${esc(e.audioId)}"`)}<div class="audio-progress"><span></span></div><span class="audio-time">00:00 / ${formatTime((e.duration||0)*1000)}</span>${action('删除这条复盘','delete-audio',`data-id="${esc(e.id)}"`,true)}</div>`:''}</div>`;
}
function notePage() {
  return title('记一段复盘','more',`回合${session.turn}`)+`<div class="note-page">${action(icon('mic')+'开始语音记录','record')}<textarea id="note-text" maxlength="2000" aria-label="文字复盘" placeholder="或在这里写一点想法…">${esc(ui.noteDraft||'')}</textarea>${action('保存文字','note','',true)}<p class="screen-hint">语音最长60秒；不自动转写。文字输入暂用电脑键盘。</p></div>`;
}
function historyPage() {
  return title('历史对局','more',`${library.archives.length}局`)+`<div class="page-pad">${library.archives.length?library.archives.map(s=>`<div class="history-item"><button data-action="resume" data-id="${esc(s.id)}"><span>${esc(GAMES[s.game].name)} · 回合${s.turn}<small>${new Date(s.createdAt).toLocaleDateString('zh-CN')} · ${s.events.length}条记录</small></span>${icon('arrow')}</button></div>`).join(''):'<div class="empty-screen">新建对局后，原对局保存在这里。</div>'}</div>`;
}
function backupPage() {
  return title('导出与导入','more')+`<div class="page-pad"><div class="backup-actions"><button class="screen-action" data-action="export-json"><strong>完整备份（含录音）</strong></button>${action('导出文字复盘','export-text','',true)}${action('导入已有备份','import','',true)}${!storageOK?action('导出原始数据','raw-backup','',true):''}</div><p class="screen-hint" style="margin-top:12px">备份下载到电脑，之后可导回设备模拟器。原记录不会被覆盖。</p></div>`;
}
function recordingOverlay() {
  const pending=recordPending||recorderBusy;
  return `<div class="full-screen record-overlay">${icon('mic')}<h2>${recordPending?'准备录音…':recorderBusy?'正在保存…':'<span class="record-dot"></span>正在录音'}</h2><div class="record-duration">${recording?formatTime(Date.now()-recording.started):'00:00'}</div><p class="screen-hint">${recordPending?'请在浏览器中允许麦克风':recorderBusy?'请稍候，保存完成后自动返回':'长按右侧录音键，松开保存<br>也可点击下方结束'}</p>${!pending?action('结束并保存','record-stop'):''}</div>`;
}
function confirmOverlay() {
  return `<div class="full-screen confirm-overlay"><h2>${esc(ui.confirm.title)}</h2><p>${esc(ui.confirm.text)}</p><div class="row-actions">${action('取消','cancel-confirm','',true)}${action(esc(ui.confirm.label),'confirm')}</div></div>`;
}
function updateLive() {
  const now=clockNow(), value=remaining(session,now);
  if(usesTurnClock(session)){const totals=turnTimes(session,now);document.querySelectorAll('[data-turn-time]').forEach(el=>el.textContent=formatTime(totals[Number(el.dataset.turnTime)]));}
  document.querySelectorAll('.pokemon-clock').forEach(el=>{const running=Number(el.dataset.clockPlayer)===session.turnClock?.active;el.classList.toggle('running',running);const marker=el.querySelector('svg');if(marker)marker.innerHTML=icons[running?'play':'pause'];});
  document.querySelectorAll('.mini-clock span,.timer-big').forEach(el=>el.textContent=formatTime(value));
  if(recording && $('.record-duration')) $('.record-duration').textContent=formatTime(Date.now()-recording.started);
  if(playingAudio && $('.audio-time')) { $('.audio-time').textContent=`${formatTime(playingAudio.currentTime*1000)} / ${formatTime((playingAudio.duration||0)*1000)}`; const bar=$('.audio-progress>span');if(bar)bar.style.width=`${Math.min(100,100*playingAudio.currentTime/(playingAudio.duration||1))}%`; }
  if(!usesTurnClock(session)&&session.timer.kind==='down'&&value===0&&session.timer.startedAt!==null){session.timer.elapsed=session.timer.duration;session.timer.startedAt=null;event(session,'timer','倒计时结束');save();toast('计时结束，请确认对局流程');}
}
function renderRecording() { render(); if(recordError) { $('#host-message').textContent=recordError; ui.notice='录音不可用，请查看模拟器说明'; clearTimeout(noticeTimeout); noticeTimeout=setTimeout(()=>{ui.notice='';render();},3500);render(); } }
function stopPlayback(){ if(playingAudio)playingAudio.pause();playingAudio=null;playingAudioId=null;if(audioURL)URL.revokeObjectURL(audioURL);audioURL=null; }
async function playAudio(id){
  stopEffects();
  if(playingAudioId===id && playingAudio){if(playingAudio.paused)await playingAudio.play().catch(()=>toast('无法播放录音'));else playingAudio.pause();render();return;}
  stopPlayback();try{const a=await getAudio(id);if(!a){toast('原录音无法读取');return;}audioURL=URL.createObjectURL(a.blob);playingAudio=new Audio(audioURL);playingAudio.volume=volume.get()/100;playingAudioId=id;playingAudio.addEventListener('ended',()=>render());await playingAudio.play();render();}catch{toast('无法播放录音，请尝试下载');}
}
function navigate(page){if(session.game==='pokemon'&&['damage','statuses','slot-edit','settings'].includes(page))page='more';if(flowNavigate(page))return;if(usesTurnClock(session)&&['players','note','backup','timer','duration'].includes(page))page='more';if(ui.randomPopup)return;if(recording||recordPending||recorderBusy)return;if(ui.page==='detail'&&page!=='detail')stopPlayback();if(page==='duration'){ui.timerKind=session.timer.kind;ui.minutes=Math.round(session.timer.duration/60000);}ui.page=page;ui.notice='';render();}
function hardware(direction){
  if(volumePanel.isOpen){volumePanel.adjust(direction);return;}
  if(recording||recordPending||recorderBusy||ui.pokemonFlipping)return;
  if(menuHardware(direction))return;
  if(usesTurnClock(session)&&session.turnClock.phase!=='running')return;
  if(ui.page==='damage')act(now=>changeDamage(session,ui.player,ui.slot,session.players[ui.player].slots[ui.slot].damage+direction*10,now));
  else if(ui.page==='count'&&session.game==='rift')act(now=>changeRiftStat(session,session.selected,'score',direction,now));
  else if(ui.page==='count'&&session.game==='pokemon')return;
  else if(ui.page==='count'&&session.game==='ygo')openLife(session.selected,direction>0?'add':'subtract');
  else if(ui.page==='count')act(now=>setCounter(session,session.selected,session.players[session.selected].value+direction*session.step,now));
  else if(ui.page==='coin'){if(!ui.randomBusy)randomAction();}
  else toast('加减键用于计数和伤害页面');
}
function selectNext(){
 if(volumePanel.isOpen){volumePanel.close();return;}
 if(ui.pokemonFlipping)return;
 if(recording){stopRecording();return;}if(recordPending||recorderBusy)return;
 if(menuSelect())return;
 if(session.game==='pokemon'){animatePokemonTurn(false);return;}
 if(session.game==='rift'){if(session.turnClock.phase==='running')act(now=>switchRiftSide(session,now));return;}
 if(usesTurnClock(session)){if(session.turnClock.phase==='running')act(now=>switchDuelTurn(session,now));return;}
 if(ui.page==='damage'){ui.slot=(ui.slot+1)%6;render();}else{session.selected=session.mode===1?0:1-session.selected;save();render();}
}
async function animatePokemonTurn(reverting=false){
 if(ui.pokemonFlipping||recording||recordPending||recorderBusy)return;
 const before=session.turnClock?.active,board=$('.pokemon-rotor');
 const changed=reverting?undoPokemon(session,clockNow()):flipPokemonTurn(session,clockNow());
 if(!changed)return;
 save();clockNow();
 if(before===session.turnClock.active||!board||matchMedia('(prefers-reduced-motion: reduce)').matches||!board.animate){render();return;}
 const from=before?180:0,direction=reverting?-1:1,mid=from+90*direction,to=from+180*direction;
 const screen=$('#device-screen');ui.pokemonFlipping=true;screen.inert=true;
 $('#key-select').disabled=true;$('#key-record').disabled=true;
 let first,second;
 try{
  // Turn only the reminder/control layer; both player clocks stay fixed outside it.
  first=board.animate([{transform:`rotate(${from}deg) scale(1)`,opacity:1},{offset:.3,transform:`rotate(${from}deg) scale(.58)`,opacity:1},{transform:`rotate(${mid}deg) scale(.58)`,opacity:.25}],{duration:200,easing:'ease-in-out',fill:'forwards'});
  await first.finished;
  render();
  second=$('.pokemon-rotor').animate([{transform:`rotate(${mid}deg) scale(.58)`,opacity:.25},{offset:.7,transform:`rotate(${to}deg) scale(.58)`,opacity:1},{transform:`rotate(${to}deg) scale(1)`,opacity:1}],{duration:200,easing:'ease-in-out',fill:'forwards'});
  await second.finished;
 }catch{
  // An interrupted animation must still expose the single committed turn.
 }finally{first?.cancel();second?.cancel();ui.pokemonFlipping=false;screen.inert=false;$('#key-select').disabled=false;$('#key-record').disabled=false;render();}
}
function digit(value){if(ui.calcMode==='half')return;sound('tap');if(value==='清空')ui.amount='0';else if(value==='退格')ui.amount=ui.amount.slice(0,-1)||'0';else if(ui.amount==='0')ui.amount=value;else if(ui.amount.length<6)ui.amount+=value;render();}
function applyCalc(){const amount=Number(ui.amount),p=session.players[ui.player];const value=ui.calcMode==='half'?Math.floor(p.value/2):ui.calcMode==='set'?amount:p.value+(ui.calcMode==='add'?amount:-amount);ui.page='count';act(now=>setCounter(session,ui.player,value,now));}
function randomAction(){if(ui.randomPopup||ui.randomBusy)return;if(usesTurnClock(session)){showRandomPopup();return;}try{roll(session,ui.randomKind,ui.randomKind==='coin'?ui.coinCount:1,clockNow());save();ui.randomBusy=true;render();clearTimeout(randomTimeout);randomTimeout=setTimeout(()=>{ui.randomBusy=false;render();},matchMedia('(prefers-reduced-motion: reduce)').matches?0:500);}catch{toast('随机数不可用，请检查浏览器');}}
$('#device-screen').addEventListener('input',e=>{if(e.target.id==='note-text')ui.noteDraft=e.target.value;});
$('#device-screen').addEventListener('click',async e=>{
  if(volumePanel.isOpen)return;
  const button=e.target.closest('button');if(!button||button.disabled||ui.pokemonFlipping)return;
  if(ui.randomPopup){
    if(ui.randomBusy)return;
    if(button.dataset.action==='random-close'){ui.randomPopup=null;render();}
    else if(button.dataset.action==='random-again'){
      ui.randomKind=ui.randomPopup.kind;
      if(ui.randomKind==='coin')ui.coinCount=ui.randomPopup.results.length;
      showRandomPopup();
    }
    return;
  }
  if(button.dataset.go){navigate(button.dataset.go);return;}
  const a=button.dataset.action,p=Number(button.dataset.player);
  if(await flowAction(a,button))return;
  if(recording||recordPending||recorderBusy){if(a==='record-stop')stopRecording();return;}
  if(a==='duel-start'){stopPlayback();resetPokemonBoard(session);session.players.forEach(p=>{p.value=GAMES[session.game].start;if(session.game==='rift')p.experience=0;});if(session.game==='rift')session.selected=0;session.undo=[];session.turnClock={phase:'ready',totals:[0,0],active:0,startedAt:null};session.matchStatus='order';ui.player=0;ui.detail=null;ui.amount='0';ui.page='order';save();render();}
  else if(a==='duel-begin'){session.matchStatus='playing';ui.page='count';act(now=>{const first=Number(button.dataset.first);if(startDuel(session,first,now)&&session.game==='rift')session.selected=session.mode===1?0:first;});}
  else if(a==='pokemon-mark')act(now=>markPokemonStep(session,Number(button.dataset.index),now));
  else if(a==='rift-select'){session.selected=p;ui.page='count';save();render();}
  else if(a==='rift-change'){const stat=button.dataset.stat;if(stat==='score')session.selected=p;act(now=>changeRiftStat(session,p,stat,Number(button.dataset.delta),now));}
  else if(a==='rift-dice'){ui.randomKind='dice';randomAction();}
  else if(a==='select'){session.selected=p;save();render();}
  else if((a==='plus'||a==='minus')&&session.game==='ygo')openLife(p,a==='plus'?'add':'subtract');
  else if(a==='open-half')halveLife(p);
  else if(a==='duel-coin'){ui.randomKind='coin';ui.coinCount=1;randomAction();}
  else if(a==='plus'||a==='minus')act(now=>setCounter(session,p,session.players[p].value+(a==='plus'?1:-1)*session.step,now));
  else if(a==='step'){session.step=Number(button.dataset.value);save();render();}
  else if(a==='undo'){if(session.game==='pokemon')animatePokemonTurn(true);else act(now=>undo(session,now));}
  else if(a==='turn')act(now=>nextTurn(session,now));
  else if(a==='adjust'){ui.player=p;ui.amount='0';ui.calcMode='subtract';ui.page='adjust';render();}
  else if(a==='digit')digit(button.dataset.digit);
  else if(a==='calc-mode'){ui.calcMode=button.dataset.mode;render();}
  else if(a==='calc-apply')applyCalc();
  else if(a==='half')halveLife(ui.player);
  else if(a==='random-kind'){ui.randomKind=ui.randomKind==='coin'?'dice':'coin';render();}
  else if(a==='coin-count'){ui.coinCount=Number(button.dataset.value);render();}
  else if(a==='random')randomAction();
  else if(a==='timer-toggle'){act(now=>{if(!toggleTimer(session,now))toast('倒计时已结束，请先重置');});}
  else if(a==='timer-reset'){confirmation('重置计时','当前计时将清零。已保存的对局记录仍然保留。',()=>{ui.confirm=null;act(now=>resetTimer(session,session.timer.kind,session.timer.duration,now));},'重置');}
  else if(a==='duration-kind'){ui.minutes=Number($('#duration-minutes')?.value)||ui.minutes;ui.timerKind=button.dataset.kind;render();}
  else if(a==='duration-value'){ui.minutes=Number(button.dataset.value);render();}
  else if(a==='duration-apply'){const n=Number($('#duration-minutes').value);if(!Number.isInteger(n)||n<1||n>1440){toast('请输入1至1440分钟');return;}ui.minutes=n;confirmation('应用计时设置','应用后当前计时将清零，并暂停等待开始。',()=>{ui.confirm=null;ui.page='timer';act(now=>resetTimer(session,ui.timerKind,n*60000,now));},'应用');}
  else if(a==='game'){requestHome();}
  else if(a==='new')requestHome();
  else if(a==='mode'){
    const mode=Number(button.dataset.mode);
    if(![1,2].includes(mode))return;
    if(setDisplayMode(session,mode,clockNow())){if(mode===1)ui.player=0;save();renderManager();}
    // Keep the DOM intact so the indicator can finish/reverse its transition.
    const control=button.closest('.mode-switch');
    control.dataset.mode=String(session.mode);
    control.querySelectorAll('[data-action="mode"]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.mode)===session.mode)));
    const faceButton=$('[data-action="face"]');if(faceButton)faceButton.disabled=session.mode===1||session.game==='ygo';
    const buttons=hardwareButtons();syncHardwareCursor(buttons);hwIndex=buttons.indexOf(button);paintHardwareFocus();
  }
  else if(a==='face'){ui.face=!ui.face;render();}
  else if(a==='names-save'){session.players.slice(0,session.mode).forEach((p,i)=>p.name=$(`#player-name-${i}`).value.trim().slice(0,20)||(i?'对方':'我方'));save();ui.page='settings';render();}
  else if(a==='open-damage'){ui.player=p;ui.slot=session.selectedSlot[p]||0;ui.page='damage';render();}
  else if(a==='damage-player'){ui.player=p;ui.slot=session.selectedSlot[p]||0;render();}
  else if(a==='damage-slot'){ui.slot=Number(button.dataset.slot);session.selectedSlot[ui.player]=ui.slot;session.selected=ui.player;save();render();}
  else if(a==='damage-change')act(now=>changeDamage(session,ui.player,ui.slot,session.players[ui.player].slots[ui.slot].damage+Number(button.dataset.value),now));
  else if(a==='status')act(now=>toggleStatus(session,ui.player,ui.slot,button.dataset.status,now));
  else if(a==='slot-save'){const value=$('#slot-name').value.trim();if(!value){toast('请输入名称');return;}act(now=>{session.players[ui.player].slots[ui.slot].name=value;event(session,'setup',`宝可梦位置改名为${value}`,{},now);});ui.page='damage';render();}
  else if(a==='slot-clear')confirmation('清空当前位置','本位置的伤害和特殊状态将清空。',()=>{ui.confirm=null;session.undo.push(copy({players:session.players,turn:session.turn,active:session.active,eventCursor:session.events.length}));const target=session.players[ui.player].slots[ui.slot];target.damage=0;target.statuses=[];event(session,'setup',`${target.name}伤害与状态已清空`,{undoable:true});ui.page='damage';save();render();},'清空');
  else if(a==='filter'){ui.filter=ui.filter==='all'?'notes':'all';render();}
  else if(a==='detail'){ui.detail=button.dataset.id;ui.page='detail';render();}
  else if(a==='note'){const text=$('#note-text').value.trim();if(!text){toast('请先写下复盘内容');return;}ui.noteDraft='';act(now=>event(session,'note',text,{},now));ui.filter='notes';ui.page='log';render();}
  else if(a==='record')startRecording();
  else if(a==='record-stop')stopRecording();
  else if(a==='play-audio')playAudio(button.dataset.audio);
  else if(a==='download-audio')downloadAudio(button.dataset.audio);
  else if(a==='resume'){ui.viewId=button.dataset.id;ui.recordBack='history';ui.recordTab='events';ui.page='record';render();}
  else if(a==='export-json'){if(!hasRecording())exportJSON(button);}
  else if(a==='export-text'){if(!hasRecording())exportText();}
  else if(a==='import'){if(!hasRecording())$('#import-file').click();}
  else if(a==='raw-backup'){downloadBlob(new Blob([localStorage.getItem(STORAGE_KEY)||'{}'],{type:'application/json'}),'牌局-原始记录.json');}
  else if(a==='cancel-confirm'){ui.confirm=null;render();}
  else if(a==='confirm'){const fn=ui.confirm?.callback;ui.confirm=null;if(fn)await fn();render();}
});
document.querySelectorAll('[data-hardware]').forEach(button=>button.addEventListener('click',()=>button.dataset.hardware==='select'?selectNext():hardware(button.dataset.hardware==='plus'?1:-1)));
const recordKey=$('#key-record');
const recordGesture=createHoldKey({
 onShort:hardwareBack,
 onLong:()=>{holdRequested=true;startRecording(true);},
 onRelease:()=>stopRecording(),
 onCancel:()=>stopRecording()
});
recordKey.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();recordKey.setPointerCapture(e.pointerId);recordGesture.press();});
recordKey.addEventListener('pointerup',()=>recordGesture.release());
recordKey.addEventListener('pointercancel',()=>recordGesture.cancel());
recordKey.addEventListener('lostpointercapture',()=>recordGesture.cancel());
recordKey.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();e.stopPropagation();if(!e.repeat)recordGesture.press();}});
recordKey.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();e.stopPropagation();recordGesture.release();}});
document.addEventListener('keydown',e=>{
 if(volumePanel.isOpen){
  const key=e.key.toLowerCase();
  if(e.target.closest('.volume-effects')&&['enter',' '].includes(key))return;
  if(['a','d','arrowup','arrowdown','arrowleft','arrowright','s','enter','escape','r'].includes(key)){e.preventDefault();e.stopPropagation();if(['s','enter','escape','r'].includes(key)){if(!e.repeat)volumePanel.close();}else volumePanel.adjust(['a','arrowdown','arrowleft'].includes(key)?-1:1);}
  return;
 }
 if(ui.page==='home'&&!ui.confirm&&!recording&&!recordPending&&!recorderBusy&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();if(!e.repeat)switchHomeGame(e.key==='ArrowLeft'?-1:1);return;}
 if(e.target.closest('input,textarea')||e.altKey||e.repeat||ui.pokemonFlipping)return;
 const k=e.key.toLowerCase();
 if(e.ctrlKey||e.metaKey){if(k==='z'&&session.undo.length&&!flowPage()&&!ui.confirm&&!ui.randomPopup&&!recording&&!recordPending&&!recorderBusy){e.preventDefault();if(session.game==='pokemon')animatePokemonTurn(true);else act(now=>undo(session,now));}return;}
 if(k==='r'){e.preventDefault();recordGesture.press();return;}
 if(k==='escape'){e.preventDefault();hardwareBack();return;}
 if(k==='a'||k==='d'){e.preventDefault();hardware(k==='a'?-1:1);return;}
 if(k==='s'){e.preventDefault();selectNext();return;}
 if(ui.confirm||recording||recordPending||recorderBusy||ui.randomPopup)return;
 if(ui.page==='adjust'){if(/^\d$/.test(e.key)){e.preventDefault();digit(e.key);return;}if(e.key==='Backspace'){e.preventDefault();digit('退格');return;}if(e.key==='Enter'){e.preventDefault();applyCalc();return;}}
});
document.addEventListener('keyup',e=>{if(e.key.toLowerCase()==='r')recordGesture.release();});
window.addEventListener('blur',()=>recordGesture.cancel());
window.addEventListener('beforeunload',e=>{save();if(recording||recordPending||recorderBusy){e.preventDefault();e.returnValue='';}});
window.addEventListener('pagehide',()=>{if(recording)stopRecording();});
const homeEntrance=createHomeEntrance({onReady:()=>paintHardwareFocus()});
const volumePanel=createVolumePanel($('#device-screen'),()=>paintHardwareFocus(),()=>!recording&&!recordPending&&!recorderBusy,(dx,dy)=>switchHomeGame(homeSwipeDirection(dx,dy)));
function switchHomeGame(direction){
 if(!direction||ui.page!=='home'||volumePanel.isOpen||ui.confirm||ui.randomPopup||recording||recordPending||recorderBusy||library.cleanupPending)return;
 ui.selectedGame=nextHomeGame(ui.selectedGame,direction);ui.hubIndex=0;hwScope='';ui.notice='';render();
}
volume.subscribe(level=>{if(playingAudio)playingAudio.volume=level;});
const physicalPreview=initPhysicalPreview(applyZoom);
function applyZoom(){const stage=$('.device-stage');const fit=Math.max(.35,(stage.clientWidth-30)/336);$('#device-wrap').style.setProperty('--zoom',String(zoomChoice==='real'?physicalPreview.scale():Math.min(zoomChoice,fit)));}
document.querySelectorAll('[data-scale]').forEach(b=>b.addEventListener('click',()=>{zoomChoice=b.dataset.scale==='real'?'real':Number(b.dataset.scale);$('#physical-preview').hidden=zoomChoice!=='real';document.querySelectorAll('[data-scale]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));applyZoom();}));
window.addEventListener('resize',applyZoom);
setInterval(updateLive,250);
render();save();applyZoom();if(library.cleanupPending)cleanupLegacyRecords();



function ygoMenu(){
 return `<div class="more-grid">${[['log','note','本局记录'],['coin','dice','随机工具'],...(session.game==='pokemon'?[]:[['settings','settings','使用人数']])].map(([p,i,t])=>`<button data-go="${p}">${icon(i)}${t}</button>`).join('')}<button data-action="end-match">${icon('count')}结束本局</button><button data-action="return-home">${icon('back')}回到主菜单</button></div>`;
}
function simpleCalculator(){
 const p=session.players[ui.player],label=ui.player?'对方':'我方',add=ui.calcMode==='add';
 return `<div class="full-screen calculator simple-calculator ${session.mode===2&&ui.player===1?'opponent-calculator':''}"><div class="full-header"><button class="back-button" data-go="count" aria-label="返回计数">${icon('back')}</button><span>${label} · ${add?'增加':'扣除'}</span><span></span></div><div class="calc-value"><small>当前 ${p.value}</small><span>${add?'+':'−'}${esc(ui.amount)}</span></div><div class="keypad">${['1','2','3','4','5','6','7','8','9','清空','0','退格'].map(n=>`<button class="${n.length>1?'utility':''}" data-action="digit" data-digit="${n}" aria-label="输入${n}">${n}</button>`).join('')}</div><button class="calc-submit" data-action="calc-apply">确认${add?'增加':'扣除'} ${esc(ui.amount)}</button></div>`;
}
function simpleLog(){
 const entries=visibleEvents(session).filter(e=>e.type!=='audio').slice().reverse();
 return title('记录','more',`${entries.length}条`)+`<div class="simple-log log-scroll">${entries.length?entries.map(e=>e.type==='audio'?`<button class="log-item" data-action="detail" data-id="${esc(e.id)}"><small>${formatTime(e.elapsed)} · 录音</small><span>${esc(e.text)} · 点击回听</span></button>`:`<button class="log-item" data-action="detail" data-id="${esc(e.id)}"><small>${formatTime(e.elapsed)}</small><span>${esc(e.text)}</span></button>`).join(''):'<div class="empty-screen">操作会自动记录。<br>按住实体录音键，记下复盘。</div>'}</div>`;
}
function showRandomPopup(){
 if(ui.randomBusy||recording||recordPending||recorderBusy||ui.confirm)return;
 try{
  roll(session,ui.randomKind,ui.randomKind==='coin'?ui.coinCount:1,clockNow());save();
  ui.randomPopup=copy(session.lastRandom);ui.randomBusy=true;render();sound(ui.randomKind==='coin'?'coin':'dice');
  const delay=session.game==='rift'?(matchMedia('(prefers-reduced-motion: reduce)').matches?120:ui.randomKind==='dice'?RIFT_DICE_ROLL_MS:RIFT_COIN_FLIP_MS):1000;
  clearTimeout(randomTimeout);randomTimeout=setTimeout(()=>{ui.randomBusy=false;render();},delay);
 }catch{ui.randomPopup=null;ui.randomBusy=false;toast('随机数不可用，请检查浏览器');}
}
function randomPopup(){
 const result=ui.randomPopup,coin=result.kind==='coin';
 const text=coin?result.results.map(v=>v?'正面':'反面').join(' · '):result.results.join(' · ');
 const face=session.game==='rift'?riftArtwork(result.kind,result.results[0],ui.randomBusy):randomArtwork(result.kind,result.results[0],ui.randomBusy);
 return `<div class="random-overlay" ${session.game==='pokemon'&&session.turnClock?.active===1?'style="transform:rotate(180deg)"':''} role="dialog" aria-modal="true" aria-label="${coin?'硬币':'骰子'}结果"><div class="random-card"><div class="random-mirrored">${ui.randomBusy?'抛掷中':esc(text)}</div><div class="popup-coin source-art">${face}</div><div class="random-result" role="status">${ui.randomBusy?'抛掷中…':esc(text)}</div><div class="random-actions">${ui.randomBusy?'<button class="screen-action random-wait" disabled>等待结果</button>':'<button class="screen-action" data-action="random-again" data-hw-default>再来一次</button><button class="screen-action secondary" data-action="random-close">关闭</button>'}</div></div></div>`;
}
function renderManager(){
 const node=$('#manager-list');if(!node||!$('#computer-manager').open)return;
 node.innerHTML=[session,...library.archives.filter(s=>s.id!==session.id)].map((s,i)=>`<details class="manager-session"><summary>${i?esc(recordTitle(s)):'当前对局'} · ${esc(GAMES[s.game].name)} · ${new Date(s.createdAt).toLocaleString('zh-CN')}</summary><button data-backup-id="${esc(s.id)}">下载本局备份（含录音）</button><ol>${visibleEvents(s).map(e=>`<li>${formatTime(e.elapsed)} ${esc(e.text)}${e.type==='audio'?` <button data-download-audio="${esc(e.audioId)}">下载录音</button>`:''}</li>`).join('')||'<li>暂无记录</li>'}</ol></details>`).join('');
}
async function backupStored(id,button){
 if(hasRecording())return;
 const source=id===session.id?session:library.archives.find(s=>s.id===id);if(!source)return;
 const snapshot=pauseSnapshot(source);snapshot.undo=[];button.disabled=true;const recordings=[];let missing=0;
 try{
  for(const e of snapshot.events.filter(e=>e.type==='audio')){const a=await getAudio(e.audioId).catch(()=>null);if(a)recordings.push({id:a.id,duration:a.duration,createdAt:a.createdAt,type:a.blob.type,base64:await blobBase64(a.blob)});else missing++;}
  downloadBlob(new Blob([JSON.stringify({format:'paiju-backup-v1',exportedAt:new Date().toISOString(),session:snapshot,recordings},null,2)],{type:'application/json'}),`牌局-${GAMES[source.game].name}-${source.id.slice(0,8)}.json`);
  $('#manager-message').textContent=missing?`备份已导出，${missing}条录音文件无法读取。`:'备份已导出。';
 }catch{$('#manager-message').textContent='导出失败，请重试。';}finally{button.disabled=false;}
}
$('#computer-manager').addEventListener('toggle',renderManager);
$('#manager-list').addEventListener('click',e=>{const b=e.target.closest('button');if(b?.dataset.backupId)backupStored(b.dataset.backupId,b);if(b?.dataset.downloadAudio)downloadAudio(b.dataset.downloadAudio);});
$('#host-import').addEventListener('click',()=>{if(!hasRecording()&&!ui.randomPopup)$('#import-file').click();});

function openAudioDB() {
  if (!audioDBPromise) audioDBPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('当前浏览器不支持本机录音存储')); return; }
    const req = indexedDB.open('paiju-audio-v1', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('recordings', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result); req.onerror = () => { audioDBPromise = null; reject(req.error); };
    req.onblocked = () => { audioDBPromise = null; reject(new Error('请关闭其他牌局页面后重试')); };
  });
  return audioDBPromise;
}
async function putAudio(value) {
  const db = await openAudioDB();
  return new Promise((resolve, reject) => { const tx = db.transaction('recordings', 'readwrite'); tx.objectStore('recordings').put(value); tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(tx.error || new Error('录音无法保存')); });
}
async function getAudio(id) {
  const db = await openAudioDB();
  return new Promise((resolve, reject) => { const req = db.transaction('recordings').objectStore('recordings').get(id); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
}
async function startRecording(held = false) {
  if(volumePanel.isOpen){holdRequested=false;return;}
  if(ui.randomPopup||ui.confirm||library.cleanupPending||ui.pokemonFlipping)return;
  if (recording || recordPending || recorderBusy) return;
  const target=recordingTarget(library,['record','detail'].includes(ui.page)?ui.viewId:null);
  if(!target){holdRequested=false;toast('请先开始对局，或打开一场对局的复盘');return;}
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    recordError = '此浏览器无法录音。请在最新版Chrome或Edge的安全页面中打开；请确认浏览器支持录音。'; renderRecording(); toast('浏览器暂不支持录音。'); return;
  }
  stopEffects();stopPlayback();
  recordError = ''; recordPending = true; renderRecording();
  let stream;
  try {
    await openAudioDB();
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    if (held && !holdRequested) { stream.getTracks().forEach(track => track.stop()); recordPending = false; renderRecording(); return; }
    const mimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const parts = [], started = Date.now(), sessionId = target.id, contextElapsed = elapsed(target,target===session?clockNow():Date.now()), contextTurn = target.turn;
    recording = { recorder, stream, started, timeout: null };
    recorder.addEventListener('dataavailable', e => { if (e.data.size) parts.push(e.data); });
    recorder.addEventListener('stop', async () => {
      stream.getTracks().forEach(track => track.stop());
      const duration = Math.min(60, (Date.now() - started) / 1000), blob = new Blob(parts, { type: recorder.mimeType || mimeType || 'audio/webm' });
      recorderBusy = true; renderRecording();
      try {
        if (!blob.size) throw new Error('没有收到录音数据，请检查麦克风后再试。');
        const id = crypto.randomUUID();
        await putAudio({ id, sessionId, blob, duration, createdAt: started });
        event(target, 'audio', `复盘录音 · ${Math.max(1, Math.round(duration))}秒`, { audioId: id, duration, elapsed: contextElapsed, turn: contextTurn });
        if(!save())throw new Error('对局索引未能保存，请保留下载的录音。'); renderJournal(); toast('复盘已保存到这一局');
      } catch (error) {
        if (blob.size) downloadBlob(blob, `牌局-未存入浏览器的录音.${audioExtension(blob.type)}`);
        recordError = `录音保存失败${blob.size ? '，已尝试下载原录音' : ''}。${error.message || '请导出备份或检查存储空间。'}`;
      } finally { recorderBusy = false; renderRecording(); }
    });
    recorder.addEventListener('error', () => { recordError = '录音中断，请检查麦克风连接。'; stopRecording(); });
    recorder.start(250); recording.timeout = setTimeout(() => { stopRecording(); toast('已达到60秒，正在保存录音。'); }, 60000);
    recordPending = false; renderRecording();
  } catch (error) {
    stream?.getTracks().forEach(track => track.stop()); recording = null; recordPending = false;
    recordError = error.name === 'NotAllowedError' ? '麦克风权限未获允许。请在浏览器地址栏开放麦克风后重试，或稍后重试。' : error.name === 'NotFoundError' ? '没有找到麦克风，请连接后重试。' : `无法开始录音：${error.message || '请检查麦克风或浏览器存储权限。'}`;
    renderRecording();
  }
}
function stopRecording() {
  holdRequested = false;
  if (!recording) return;
  const current = recording; recording = null; recorderBusy = true; clearTimeout(current.timeout);
  if (current.recorder.state !== 'inactive') current.recorder.stop();
  renderRecording();
}
function audioExtension(type) { return type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : type.includes('wav') ? 'wav' : 'webm'; }
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 15000);
}
async function downloadAudio(id) {
  try { const value = await getAudio(id); if (!value) { toast('找不到原录音。请检查是否已清理浏览器数据。'); return; } downloadBlob(value.blob, `牌局-${id.slice(0, 8)}.${audioExtension(value.blob.type)}`); }
  catch { toast('录音无法读取，请检查浏览器存储权限。'); }
}
const blobBase64 = blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); });
async function exportJSON(button) {
  button.disabled = true; button.querySelector('strong').textContent = '正在整理备份…';
  try {
    const snapshot = pauseSnapshot(); snapshot.undo = [];
    const recordings = []; let missing = 0;
    for (const e of snapshot.events.filter(e => e.type === 'audio')) {
      const audio = await getAudio(e.audioId).catch(() => null);
      if (audio) recordings.push({ id: audio.id, duration: audio.duration, createdAt: audio.createdAt, type: audio.blob.type, base64: await blobBase64(audio.blob) }); else missing++;
    }
    const data = { format: 'paiju-backup-v1', exportedAt: new Date().toISOString(), session: snapshot, recordings };
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `牌局-${GAMES[session.game].name}-${new Date().toISOString().slice(0, 10)}.json`);
    closeModal(); toast(missing ? `已导出；${missing}条录音原文件无法读取，未包含在备份中。` : '完整备份已导出');
  } catch { toast('导出失败，请稍后重试，或先导出文字版。'); button.disabled = false; button.querySelector('strong').textContent = '重试完整备份'; }
}
function exportText() {
  const text = [`# ${GAMES[session.game].name}对局复盘`, '', `玩家：${session.players.slice(0, session.mode).map(p => p.name).join(' / ')}`, `开始时间：${new Date(session.createdAt).toLocaleString('zh-CN')}`, `当前回合：${session.turn}`, `对局计时：${formatTime(elapsed(session, clockNow()))}`, '', '## 对局时间线', '', ...visibleEvents(session).map(e => `- [${formatTime(e.elapsed)}${usesTurnClock(session)?'':` · 第${e.turn}回合`}] ${e.text}${e.type === 'audio' ? '（录音需单独下载）' : ''}`), '', '## 赛后补充', '', '- 做得好的决策：', '- 想重来的决策：', '- 下次尝试：', ''].join('\n');
  downloadBlob(new Blob([text], { type: 'text/markdown;charset=utf-8' }), `牌局-${GAMES[session.game].name}-复盘.md`); closeModal(); toast('文字复盘已导出');
}
$('#import-file').addEventListener('change', async e => {
  const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
  if (hasRecording() || recorderBusy) return;
  if (file.size > 30 * 1024 * 1024) { toast('备份超过30MB，请使用更小的单局备份。'); return; }
  try {
    const data = JSON.parse(await file.text());
    if (data.format !== 'paiju-backup-v1' || !isSession(data.session) || !Array.isArray(data.recordings) || data.recordings.length > 500) throw new Error('备份格式不正确，请选择牌局导出的JSON文件。');
    const restored = copy(data.session); restored.id = crypto.randomUUID(); restored.undo = []; restored.lastRandom = null;
    restored.timer.elapsed = Math.min(30 * 86400000, elapsed(restored)); restored.timer.startedAt = null; pauseDuel(restored); ensureTurnClock(restored);
    for (const a of data.recordings) {
      if (typeof a.id !== 'string' || typeof a.base64 !== 'string' || a.base64.length > 15 * 1024 * 1024 || typeof a.type !== 'string' || !/^audio\/(webm|ogg|mp4|wav|mpeg)(;.*)?$/.test(a.type)) throw new Error('备份中的录音格式无效。');
    }
    if(library.archives.length>=HISTORY_LIMIT){showCapacity('home');return;}
    confirmation('导入对局备份', '作为独立历史记录导入，不改变当前对局。', async () => {
      if(library.archives.length>=HISTORY_LIMIT){showCapacity('home');return;}
      try {
        const importedAudioIds = new Map();
        for (const a of data.recordings) {
          const bytes = Uint8Array.from(atob(a.base64), c => c.charCodeAt(0));
          const importedId = crypto.randomUUID(); importedAudioIds.set(a.id, importedId);
          await putAudio({ id: importedId, sessionId: restored.id, blob: new Blob([bytes], { type: a.type }), duration: a.duration, createdAt: a.createdAt });
        }
        restored.events.forEach(e => { e.id = crypto.randomUUID(); if (e.type === 'audio' && importedAudioIds.has(e.audioId)) e.audioId = importedAudioIds.get(e.audioId); });
        restored.matchStatus='completed';library.archives.unshift(restored);ui.viewId=restored.id;ui.recordTab='events';ui.recordBack='history';ui.page='record';save();render();toast('已导入对局备份');
      } catch { toast('录音导入失败，请检查浏览器空间与文件完整性。原对局未切换。'); }
    }, '导入历史');
  } catch (error) { toast(error.message || '无法读取备份文件'); }
});


function readyPage(){
 return `<div class="duel-ready"><h2>准备对局</h2><p>${session.game==='pokemon'?'填能 · 支援者 · 竞技场':session.game==='rift'?'开始后得分、经验值归零':'开始后双方生命值重置为 8000'}</p><div class="ready-actions">${session.game==='rift'?action(icon('dice')+'掷骰子','rift-dice','',true):action(icon('coin')+'抛硬币','duel-coin','',true)}${action(icon('play')+'开始对局','duel-start')}</div><small>短按返回键打开对局菜单</small></div>`;
}
function orderPage(){
 return `<div class="duel-order"><div class="full-header"><button data-go="count" aria-label="返回准备界面">${icon('back')}</button><span>选择己方先后手</span><span></span></div><div class="order-actions">${action('先手','duel-begin','data-first="0"')}${action('后手','duel-begin','data-first="1"',true)}<p>${session.game==='pokemon'?(session.turnClock.phase==='paused'?'保留本回合提示，选择计时方':'每次翻转复原三项提示'):session.game==='rift'?(session.turnClock.phase==='paused'?'保留当前分数，选择开始计时的一方':'得分 0 · 经验值 0'):'双方 8000 LP · 用时从零开始'}<br>选择后立即计时</p></div></div>`;
}
function duelClock(i){
 const active=session.turnClock.phase==='running'&&session.turnClock.active===i;
 return `<div class="duel-clock ${active?'running':''}"><span>${active?icon('play'):icon('pause')}${i?'对方':'己方'}</span><time data-turn-time="${i}">${formatTime(turnTimes(session,clockNow())[i])}</time></div>`;
}

// Decorative feedback only: controls, routing, timing and life settlement stay unchanged.
$('#device-screen').addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||b.disabled||recording||recordPending||recorderBusy)return;
 if(ui.randomPopup||volumePanel.isOpen||e.target.closest('.volume-panel'))return;
 if(!['digit','calc-apply','open-half','half','duel-begin','duel-coin','rift-dice','random','play-audio','record'].includes(b.dataset.action))sound('tap');
});

function randomArtwork(kind,value,rolling=false){
 if(session.game==='pokemon')return pokemonArtwork(kind,value,rolling);
 if(kind==='coin')return `<span class="random-art coin-art ${rolling?'art-flipping':''}" aria-hidden="true">${rolling?'<img class="coin-front" src="./art/dueltools/coin-head.png" alt=""><img class="coin-back" src="./art/dueltools/coin-tail.png" alt="">':`<img src="./art/dueltools/coin-${value?'head':'tail'}.png" alt="">`}</span>`;
 return `<span class="random-art dice-art ${rolling?'art-tumbling':''}" aria-hidden="true">${rolling?'<span class="dice-frames"></span>':`<img src="./art/dueltools/dice-${value}.png" alt="">`}</span>`;
}
// Warm small local textures so flipping never exposes unloaded faces.
for(const name of ['coin-head','coin-tail',...Array.from({length:6},(_,i)=>`dice-${i+1}`),...Array.from({length:5},(_,i)=>`dice-roll-${i+1}`)]){const img=new Image();img.src=`./art/dueltools/${name}.png`;}

// Device menu, settlement and archived reviews share the same 240 × 320 display.
function flowPage(){return ['home','history','record','settlement','exit','detail'].includes(ui.page);}
function recordSource(){return ui.viewId?library.archives.find(s=>s.id===ui.viewId)||session:session;}
function flowHeader(label,back='flow-back',right='',keepTitle=false){const compact=usesTurnClock(session)&&!keepTitle;return `<header class="flow-header${compact?' compact-backbar':''}" aria-label="${esc(label)}"><button data-action="${back}" aria-label="返回">${icon('back')}</button>${compact?'<span></span>':`<strong>${esc(label)}</strong>`}<span>${right}</span></header>`;}
function choice(label,a,selected,extra=''){return `<button class="flow-choice ${selected?'chosen':''}" data-action="${a}" aria-pressed="${selected}" ${extra}><span>${esc(label)}</span>${icon('arrow')}</button>`;}
function renderFlow(screen){
 screen.innerHTML=`<div class="screen-frame flow-frame"><main class="flow-content" ${recording||recordPending||recorderBusy||ui.confirm?'inert':''}>${flowContent()}</main>${recording||recordPending||recorderBusy?recordingOverlay():''}${ui.confirm?confirmOverlay():''}${ui.notice?`<div class="screen-toast" role="status">${esc(ui.notice)}</div>`:''}</div>`;
 if(ui.page==='home'&&!library.cleanupPending)homeEntrance.sync(screen.querySelector('.game-home'),ui.selectedGame);
 $('#key-select').setAttribute('aria-label','实体中间键，确认选择');
 $('#key-record').classList.toggle('recording',!!recording);
}
function flowContent(){
 if(library.cleanupPending)return `<div class="exit-options"><h2>清理旧记录</h2><p>${ui.cleaning?'正在删除旧对局及录音…':'旧录音尚未清理完成，请重试。'}</p>${action('重试清理','retry-cleanup',ui.cleaning?'disabled':'')}</div>`;
 if(ui.page==='home')return homeScreen({game:ui.selectedGame,name:GAMES[ui.selectedGame].name,resume:hasDuel(session)&&session.game===ui.selectedGame,selected:ui.hubIndex});
 if(ui.page==='history'){
  const list=historyRecords();
  return flowHeader('对局复盘','flow-back',`${library.archives.length}/${HISTORY_LIMIT}`)+`${ui.capacity?`<p class="capacity-message" role="status">${library.archives.length>=HISTORY_LIMIT?'记录已满，请删除旧记录后继续。':'空间已释放，返回即可继续。'}</p>`:''}<div class="archive-scroll">${list.length?list.map((s,i)=>`<div class="archive-row"><button class="archive-open ${ui.historyIndex===i?'chosen':''}" data-action="open-record" data-id="${esc(s.id)}"><strong>${esc(recordTitle(s))}</strong><small>${new Date(s.completedAt||s.createdAt).toLocaleDateString('zh-CN')} · ${audioIds(s).length} 条复盘</small></button><button class="archive-delete" data-action="delete-match" data-id="${esc(s.id)}" aria-label="删除${esc(recordTitle(s))}">删除</button></div>`).join(''):'<div class="empty-screen">还没有已完成对局。<br>结束本局后，记录会保存在这里。</div>'}</div>`;
 }
 if(ui.page==='record'){
  const source=recordSource(),entries=visibleEvents(source).filter(e=>ui.recordTab==='reviews'?['audio','note'].includes(e.type):!['audio','note'].includes(e.type));
  return flowHeader(ui.viewId?recordTitle(source):'本局记录','flow-back','',!!ui.viewId)+`<div class="record-scroll">${ui.recordTab==='reviews'?'<p class="record-tip">长按录音键添加</p>':''}${entries.length?entries.map(e=>e.type==='audio'?`<button class="log-item" data-action="detail" data-id="${esc(e.id)}"><small>${formatTime((e.duration||0)*1000)}</small><span>复盘 ${entries.filter(x=>x.type==='audio').indexOf(e)+1}</span></button>`:`<button class="log-item" data-action="detail" data-id="${esc(e.id)}"><small>${formatTime(e.elapsed)}</small><span>${esc(e.text)}</span></button>`).join(''):`<div class="empty-screen">${ui.recordTab==='reviews'?'还没有复盘录音。<br>长按右侧录音键即可添加。':'暂无对局操作。<br>已撤回的操作不会显示。'}</div>`}</div><nav class="record-tabs" aria-label="记录分类"><button data-action="record-tab" data-tab="events" aria-pressed="${ui.recordTab==='events'}">对局记录</button><button data-action="record-tab" data-tab="reviews" aria-pressed="${ui.recordTab==='reviews'}">复盘 ${audioIds(source).length}</button></nav>`;
 }
 if(ui.page==='detail')return detailPage();
 if(ui.page==='exit')return flowHeader('本局尚未完成')+`<div class="exit-options"><p>结束并保存，或放弃本局再返回。<br>放弃将删除本局记录和录音。</p>${action('结束对局并保存','end-match')}${action('放弃本局','discard-match','class="danger"',true)}${action('继续本局','continue-match','',true)}</div>`;
 if(ui.page==='settlement')return settlementPage();
 return '';
}
function settlementPage(){
 const m=session.settlement,step=session.settlementStep||'format';
 if(step!=='recap'){
  const stageText=m.format==='swiss'?`第 ${m.round} 轮瑞士轮`:m.format==='knockout'?STAGES[m.stage]:`第 ${m.practice} 场练习赛`;
  const row=(field,label,value,locked=false)=>`<div class="settle-row ${field===step?'row-active':''} ${locked?'row-fixed':''}" data-settle-row="${field}">${locked?'<span></span>':`<button class="row-arrow" data-action="settle-adjust" data-field="${field}" data-delta="-1" aria-label="上一项${label}">${icon('back')}</button>`}<button class="row-value" data-action="settle-row" data-field="${field}" ${locked?'disabled':''} aria-label="确认${label}，${esc(value)}"><small>${label}</small><strong>${esc(value)}</strong></button>${locked?'<span></span>':`<button class="row-arrow" data-action="settle-adjust" data-field="${field}" data-delta="1" aria-label="下一项${label}">${icon('back')}</button>`}</div>`;
  return flowHeader('对局结算','settle-back')+`<div class="settle-sheet" data-format="${m.format}">${row('format','赛制',FORMATS[m.format])}${row('stage',m.format==='swiss'?'轮次':m.format==='knockout'?'阶段':'场次',stageText,m.format==='practice')}<div class="settle-result ${step==='result'?'row-active':''}" data-settle-row="result"><small>己方结果</small><div class="settle-result-buttons">${Object.entries(RESULTS).map(([key,label])=>`<button data-action="set-result" data-result="${key}" aria-pressed="${(m.result||'win')===key}">${label}</button>`).join('')}</div></div><p class="settle-help">加减切换 · 中键确认下移</p></div>`;
 }
 return flowHeader('本局复盘','settle-back')+`<div class="recap-page">${icon('mic')}<strong>${esc(recordTitle(session))}</strong><p>长按录音，松开保存。<br>不录音也可结束。</p><button class="review-link" data-action="review-current">查看本局复盘 · ${audioIds(session).length} 条</button>${action('结束本局','finish-match','data-hw-default')}</div>`;
}
function historyRecords(){return library.archives.filter(s=>ui.capacity||s.game===ui.selectedGame);}
function showCapacity(back){ui.capacity=true;ui.historyReturn=back;ui.historyIndex=0;ui.page='history';render();}
function requestHome(){if(hasRecording())return;stopPlayback();session.exitToHome=hasDuel(session);save();ui.page=hasDuel(session)?'exit':'home';ui.viewId=null;render();}
function resumeCurrent(){ui.viewId=null;ui.page=session.matchStatus==='settling'?'settlement':session.matchStatus==='order'?'order':'count';render();}
function startFromMenu(){
 ui.hubIndex=0;
 if(hasRecording())return;
 if(hasDuel(session)){if(session.game===ui.selectedGame)resumeCurrent();else{ui.page='exit';render();}return;}
 if(library.archives.length>=HISTORY_LIMIT){showCapacity('home');return;}
 stopPlayback();library.active=newSession(ui.selectedGame,{mode:session.mode});session=library.active;session.matchStatus=usesTurnClock(session)?'draft':'playing';ui.viewId=null;ui.player=0;ui.page='count';save();render();
}
function flowNavigate(page){
 if(ui.randomPopup||recording||recordPending||recorderBusy)return true;
 if(page==='games'||page==='home'){requestHome();return true;}
 if(page==='history'){ui.historyReturn='home';ui.historyIndex=0;ui.page='history';render();return true;}
 if(page==='log'){ui.viewId=null;ui.recordTab='events';ui.recordBack='more';ui.page='record';render();return true;}
 if(page==='record'){stopPlayback();ui.page='record';render();return true;}
 if(session.matchStatus==='settling'&&!flowPage()){ui.page='settlement';render();return true;}
 return false;
}
function flowBack(){
 stopPlayback();
 if(ui.page==='home')return;
 if(ui.page==='history'){ui.page=ui.historyReturn||'home';ui.capacity=false;}
 else if(ui.page==='record'){ui.page=ui.recordBack||'history';ui.viewId=null;}
 else if(ui.page==='detail')ui.page='record';
 else if(ui.page==='exit'){session.exitToHome=false;save();resumeCurrent();return;}
 else if(ui.page==='settlement'){settleBack();return;}
 render();
}
function settleBack(){
 const step=session.settlementStep;
 if(step==='format'){
  session.matchStatus=usesTurnClock(session)?(session.turnClock.phase==='ready'?'draft':'playing'):'playing';
  if(usesTurnClock(session)&&session.turnClock.phase==='paused'){session.turnClock.phase='running';session.turnClock.startedAt=Date.now();}
  ui.page='count';
 } else session.settlementStep=step==='stage'?'format':step==='result'?(session.settlement.format==='practice'?'format':'stage'):'result';
 save();render();
}
function settleNext(){confirmSettlementRow(session);save();render();}
async function flowAction(a,b){
 if(library.cleanupPending){if(a==='retry-cleanup')await cleanupLegacyRecords();return true;}
 if(!['home-game','menu-start','menu-history','flow-back','return-home','end-match','continue-match','discard-match','settle-row','settle-adjust','set-format','set-stage','round-change','set-result','settle-next','settle-back','finish-match','review-current','open-record','record-tab','delete-match','delete-audio'].includes(a))return false;
 if(hasRecording())return true;
 if(a==='home-game'){switchHomeGame(Number(b.dataset.direction));}
 else if(a==='menu-start')startFromMenu();
 else if(a==='menu-history'){ui.hubIndex=1;ui.page='history';ui.historyReturn='home';ui.capacity=false;ui.historyIndex=0;render();}
 else if(a==='flow-back')flowBack();
 else if(a==='return-home')requestHome();
 else if(a==='continue-match'){session.exitToHome=false;save();resumeCurrent();}
 else if(a==='end-match'){if(!hasDuel(session)){requestHome();return true;}stopPlayback();clearLifeRolls();beginSettlement(library,clockNow());ui.page='settlement';ui.viewId=null;save();render();}
 else if(a==='settle-adjust'){session.settlementStep=b.dataset.field;adjustSettlementRow(session,Number(b.dataset.delta));save();render();}
 else if(a==='settle-row'){if(session.settlementStep===b.dataset.field)settleNext();else{session.settlementStep=b.dataset.field;save();render();}}
 else if(a==='set-format'){session.settlement.format=b.dataset.format;save();render();}
 else if(a==='set-stage'){session.settlement.stage=Number(b.dataset.stage);save();render();}
 else if(a==='round-change'){session.settlement.round=Math.max(1,Math.min(99,session.settlement.round+Number(b.dataset.delta)));save();render();}
 else if(a==='set-result'){const confirmed=session.settlementStep==='result'&&(session.settlement.result||'win')===b.dataset.result;session.settlement.result=b.dataset.result;session.settlementStep='result';if(confirmed)settleNext();else{save();render();}}
 else if(a==='settle-next')settleNext();
 else if(a==='settle-back')settleBack();
 else if(a==='review-current'){ui.viewId=null;ui.recordBack='settlement';ui.recordTab='reviews';ui.page='record';render();}
 else if(a==='open-record'){stopPlayback();ui.viewId=b.dataset.id;ui.recordTab='events';ui.recordBack='history';ui.page='record';render();}
 else if(a==='record-tab'){stopPlayback();ui.recordTab=b.dataset.tab;render();}
 else if(a==='finish-match'){
  if(!storageOK){toast('请先导出备份并检查存储空间，本局仍保留');return true;}
  const exitHome=session.exitToHome,previous=copy(library),result=finishDuel(library);
  if(!result.ok){if(result.reason==='full')showCapacity('settlement');else toast('请先填写赛制和胜负');return true;}
  if(!save()){library=previous;session=library.active;render();return true;}
  session=library.active;ui.selectedGame=session.game;ui.page=exitHome?'home':'history';ui.historyReturn='home';ui.capacity=false;ui.historyIndex=0;ui.viewId=null;stopPlayback();render();toast('本局已保存');
 }
 else if(a==='discard-match')confirmation('放弃本局？','本局所有操作记录和录音将删除，无法恢复。',async()=>{
  const old=session;
  await removeStoredData(old,()=>{library.active=newSession(old.game,{mode:old.mode});library.active.matchStatus='idle';session=library.active;ui.viewId=null;ui.page='home';},'本局已放弃');
 },'放弃并删除');
 else if(a==='delete-match'){
  const target=library.archives.find(s=>s.id===b.dataset.id);if(!target)return true;
  confirmation('删除这场对局？',`${recordTitle(target)}，包括全部复盘录音，删除后无法恢复。`,async()=>{
   await removeStoredData(target,()=>{library.archives=library.archives.filter(s=>s.id!==target.id);ui.historyIndex=Math.max(0,Math.min(ui.historyIndex||0,historyRecords().length-1));},'对局和录音已删除');
  },'删除');
 }
 else if(a==='delete-audio'){
  const target=recordSource(),entry=target.events.find(e=>e.id===b.dataset.id&&e.type==='audio');if(!entry)return true;
  confirmation('删除这条复盘？','仅删除这段录音，对局操作记录不变。',async()=>{
   await removeStoredData({events:[entry]},()=>{target.events=target.events.filter(e=>e.id!==entry.id);ui.recordTab='reviews';ui.page='record';},'复盘已删除');
  },'删除');
 }
 return true;
}
async function deleteAudioIds(ids){
 if(!ids.length)return;
 const db=await openAudioDB();await new Promise((resolve,reject)=>{const tx=db.transaction('recordings','readwrite');for(const id of ids)tx.objectStore('recordings').delete(id);tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||new Error('无法删除录音'));});
}
async function removeStoredData(target,mutate,message){
 if(!storageOK){toast('存储不可用，请先导出备份');return;}
 stopPlayback();const before=copy(library),ids=audioIds(target);
 // Persist metadata first; on audio-store failure restore it so deletion can be retried.
 mutate();if(!save()){library=before;session=library.active;render();return;}
 try{const used=new Set([library.active,...library.archives].flatMap(audioIds));await deleteAudioIds(ids.filter(id=>!used.has(id)));toast(message);}
 catch{library=before;session=library.active;save();ui.page=ui.viewId?'record':'history';toast('删除未完成，记录已保留，请重试');}
 render();
}
async function cleanupLegacyRecords(){
 if(ui.cleaning)return;ui.cleaning=true;render();
 try{
  const db=await openAudioDB();await new Promise((resolve,reject)=>{const tx=db.transaction('recordings','readwrite');tx.objectStore('recordings').clear();tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error);});
  library.cleanupPending=false;if(!save())library.cleanupPending=true;
 }catch{library.cleanupPending=true;}
 ui.cleaning=false;render();
}

function hardwareMenuMode(){
 return !!(ui.confirm||ui.randomPopup||library.cleanupPending||flowPage()||ui.page==='order'||ui.page==='adjust'||!['count','damage'].includes(ui.page)||(usesTurnClock(session)&&session.turnClock.phase!=='running'));
}
function hardwareButtons(){
 const screen=$('#device-screen');let nodes;
 if(ui.confirm)nodes=screen.querySelectorAll('.confirm-overlay button');
 else if(ui.randomPopup)nodes=screen.querySelectorAll('.random-actions button');
 else if(ui.page==='home')nodes=screen.querySelectorAll('.home-actions button');
 else if(ui.page==='record')nodes=[...screen.querySelectorAll('.record-tabs button'),...screen.querySelectorAll('.record-scroll button')];
 else if(ui.page==='settlement'&&session.settlementStep!=='recap')nodes=screen.querySelectorAll('.row-value');
 else if(ui.page==='history')nodes=screen.querySelectorAll('.archive-scroll button');
 else if(ui.page==='detail')nodes=screen.querySelectorAll('.audio-detail button');
 else if(ui.page==='adjust')nodes=screen.querySelectorAll('.keypad button,.calc-submit');
 else if(ui.page==='more')nodes=screen.querySelectorAll('.more-grid button');
 else nodes=screen.querySelectorAll('.flow-content button,.screen-content button');
 return [...nodes].filter(b=>!b.disabled&&!b.closest('[inert]')&&!b.closest('.flow-header,.screen-titlebar,.full-header')&&b.getClientRects().length);
}
function syncHardwareCursor(buttons){
 const scope=[ui.page,ui.page==='home'?ui.selectedGame:'',ui.viewId||'',ui.page==='record'?ui.recordTab:'',ui.page==='detail'?ui.detail:'',ui.page==='settlement'?session.settlementStep:'',ui.confirm?.title||'',ui.randomPopup?.id||''].join(':');
 if(scope!==hwScope){
  hwScope=scope;
  const preferred=buttons.findIndex(b=>b.hasAttribute('data-hw-default'));
  const chosen=preferred>=0?preferred:buttons.findIndex(b=>b.getAttribute('aria-pressed')==='true'||b.classList.contains('chosen'));
  hwIndex=Math.max(0,chosen);
 }
 hwIndex=Math.min(Math.max(0,hwIndex),Math.max(0,buttons.length-1));
}
function paintHardwareFocus(scroll=false){
 if(volumePanel.isOpen){for(const id of ['#key-minus','#key-plus','#key-select'])$(id).disabled=false;$('#key-select').setAttribute('aria-label','实体中间键，确认音量并返回');return;}
 document.querySelectorAll('#device-screen .hw-selected').forEach(b=>b.classList.remove('hw-selected'));
 const menu=hardwareMenuMode();
 for(const id of ['#key-minus','#key-plus'])$(id).disabled=session.game==='pokemon'&&ui.page==='count'&&!menu;
 $('#key-select').setAttribute('aria-label',menu?'实体中间键，确认选择':session.game==='pokemon'?'实体中间键，复原提示并翻转屏幕':session.game==='rift'?'实体中间键，切换双方得分与计时':usesTurnClock(session)?'实体切换键，回合结束':'实体切换键');
 if(!menu||recording||recordPending||recorderBusy)return;
 const buttons=hardwareButtons();syncHardwareCursor(buttons);
 let selected=buttons[hwIndex];
 if(ui.page==='settlement'&&!ui.confirm&&session.settlementStep!=='recap')selected=session.settlementStep==='result'?$('.settle-result-buttons [aria-pressed="true"]'):$(`[data-settle-row="${session.settlementStep||'format'}"]`);
 if(selected){selected.classList.add('hw-selected');if(scroll){const container=selected.closest('.archive-scroll,.record-scroll,.page-pad');if(container){const y=selected.offsetTop-container.offsetTop;if(y<container.scrollTop)container.scrollTop=y;else if(y+selected.offsetHeight>container.scrollTop+container.clientHeight)container.scrollTop=y+selected.offsetHeight-container.clientHeight;}}}
}
function menuHardware(direction){
 if(ui.page==='home')homeEntrance.finish();
 if(!hardwareMenuMode())return false;
 if(library.cleanupPending||ui.randomPopup&&ui.randomBusy)return true;
 if(ui.page==='settings'&&usesTurnClock(session)&&!ui.confirm&&!ui.randomPopup){
  const next=moveIndex(session.mode-1,direction,2)+1;
  $(`.mode-switch [data-mode="${next}"]`)?.click();
  return true;
 }
 if(ui.page==='settlement'&&!ui.confirm&&session.settlementStep!=='recap'){
  adjustSettlementRow(session,direction);
  save();render();return true;
 }
 const buttons=hardwareButtons();syncHardwareCursor(buttons);hwIndex=moveIndex(hwIndex,direction,buttons.length);if(ui.page==='home')ui.hubIndex=hwIndex;
 if(!buttons.length){const detail=$('#device-screen .detail-text');const area=detail&&detail.scrollHeight>detail.clientHeight?detail:$('#device-screen .page-pad');if(area)area.scrollTop+=direction*80;}
 paintHardwareFocus(true);return true;
}
function menuSelect(){
 if(ui.page==='home')homeEntrance.finish();
 if(!hardwareMenuMode())return false;
 if(library.cleanupPending||ui.randomPopup&&ui.randomBusy)return true;
 if(ui.page==='settlement'&&!ui.confirm&&session.settlementStep!=='recap'){
  settleNext();return true;
 }
 const buttons=hardwareButtons();syncHardwareCursor(buttons);
 if(buttons[hwIndex])buttons[hwIndex].click();else if(ui.page==='detail')hardwareBack();
 return true;
}
function hardwareBack(){
 if(volumePanel.isOpen){volumePanel.close();return;}
 if(ui.pokemonFlipping)return;
 if(library.cleanupPending)return;
 if(recording||recordPending){stopRecording();return;}if(recorderBusy)return;
 if(ui.confirm){ui.confirm=null;render();return;}
 if(ui.randomPopup){if(!ui.randomBusy){ui.randomPopup=null;render();}return;}
 if(flowPage()){flowBack();return;}
 stopPlayback();
 if(ui.page==='count'){navigate('more');return;}
 const parent=ui.page==='order'||ui.page==='adjust'||ui.page==='more'||ui.page==='damage'?'count':['statuses','slot-edit'].includes(ui.page)?'damage':'more';
 navigate(parent);
}
