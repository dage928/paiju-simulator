export const HOME_GAMES = ['ygo', 'rift', 'pokemon'];
export const HOME_ENTRY_MS = 800;
export function nextHomeGame(game, direction) {
  return HOME_GAMES[(Math.max(0, HOME_GAMES.indexOf(game)) + (direction < 0 ? 2 : 1)) % 3];
}
export function homeSwipeDirection(dx, dy) {
  return Math.abs(dx) >= 32 && Math.abs(dx) > Math.abs(dy) * 1.4 ? (dx < 0 ? 1 : -1) : 0;
}
const svg = (body, box='0 0 100 100') => `<svg viewBox="${box}" aria-hidden="true">${body}</svg>`;
const fist = () => svg('<path class="fist-cuff" d="M3 34h27l8 10v41H3z"/><path class="fist-hand" d="M27 37 42 20h36q7 0 7 9v6q10 1 10 10v23q0 14-15 16H39L27 73z"/><path class="fist-lines" d="M46 22v22m15-22v22m17-22v22M32 51h33q9 0 9 8t-9 8H49l-7 11M84 36v17"/><path class="fist-rune" d="m13 47 10 12-10 12 4-12z"/>');
const card = () => svg('<rect x="17" y="4" width="66" height="92" rx="3" class="card-edge"/><path class="card-frame" d="M23 10h54v80H23z"/><path class="card-line" d="m50 17 20 33-20 33-20-33zM30 50h40M50 17v66"/><path class="card-eye" d="M32 50q18-19 36 0-18 19-36 0Z"/><path class="card-core" d="m50 41 7 9-7 9-7-9z"/>');
const ball = () => svg('<circle cx="50" cy="50" r="44" class="ball-inside"/><g class="ball-lid"><path d="M6 50a44 44 0 0 1 88 0Z" class="ball-red"/><path d="M16 49h68" class="ball-seam"/><path d="M23 29q8-11 21-13" class="ball-shine"/></g><g class="ball-base"><path d="M6 50a44 44 0 0 0 88 0Z" class="ball-white"/><path d="M6 50h88" class="ball-seam"/><circle cx="50" cy="50" r="13" class="ball-button"/><circle cx="50" cy="50" r="6" class="ball-dot"/></g>');
const art = game => game === 'rift' ? fist() : game === 'ygo' ? card() : ball();
function backdrop(game) {
  if(game==='rift')return svg('<circle cx="120" cy="83" r="74"/><circle cx="120" cy="83" r="60"/><path d="m120 4 46 79-46 79-46-79zM39 83h162M120 9v148m-70-94 18 10-18 10m140-20-18 10 18 10"/>','0 0 240 320');
  if(game==='ygo')return svg('<path d="m120-28 118 114-118 114L2 86zM120-6l94 92-94 92-94-92zM0 191l42 42v87m198-129-42 42v87M0 215l25 25v80m215-105-25 25v80"/>','0 0 240 320');
  return svg('<circle cx="120" cy="73" r="86"/><circle cx="120" cy="73" r="65"/><path d="M0 73h72m96 0h72"/><circle cx="120" cy="73" r="47"/><path d="M-12 274q132-120 264 0M-12 296q132-120 264 0"/>','0 0 240 320');
}
function entrance(game) {
  const shards=game==='ygo'?Array.from({length:8},(_,i)=>`<span class="home-shard" style="--sx:${[-125,-80,-40,80,125,40,-110,110][i]}px;--sy:${[-85,-135,125,-125,85,145,15,-15][i]}px;--sr:${i%2?135:-145}deg;--slice:${['polygon(0 0,50% 0,50% 50%)','polygon(50% 0,100% 0,50% 50%)','polygon(100% 0,100% 50%,50% 50%)','polygon(100% 50%,100% 100%,50% 50%)','polygon(100% 100%,50% 100%,50% 50%)','polygon(50% 100%,0 100%,50% 50%)','polygon(0 100%,0 50%,50% 50%)','polygon(0 50%,0 0,50% 50%)'][i]}">${card()}</span>`).join(''):'';
  return `<div class="home-intro" aria-hidden="true"><div class="home-actor actor-left">${art(game)}</div><div class="home-actor actor-right">${art(game)}</div><span class="home-impact"></span>${shards}</div>`;
}
export function homeScreen({game,name,resume=false,selected=0}) {
  const index=HOME_GAMES.indexOf(game);
  return `<section class="game-home home-${game}" aria-label="${name}主菜单"><div class="home-backdrop" aria-hidden="true">${backdrop(game)}</div><div class="home-content"><header class="home-heading"><div class="home-mark" aria-hidden="true"><span>${art(game)}</span><span>${art(game)}</span></div><div class="home-title-row"><button data-action="home-game" data-direction="-1" aria-label="上一个游戏">${svg('<path d="m60 25-25 25 25 25"/>')}</button><h1>${name}</h1><button data-action="home-game" data-direction="1" aria-label="下一个游戏">${svg('<path d="m40 25 25 25-25 25"/>')}</button></div></header><div class="home-actions"><button data-action="menu-start" ${selected===0?'data-hw-default':''}>${resume?'继续本局':'开始对局'}${svg('<path d="m36 24 40 26-40 26z"/>')}</button><button data-action="menu-history" ${selected===1?'data-hw-default':''}>对局复盘${svg('<path d="M25 18h50v64H25zM37 35h26M37 50h26M37 65h18"/>')}</button></div><div class="home-pagination" aria-label="游戏模式 ${index+1} / 3">${HOME_GAMES.map((_,i)=>`<span ${i===index?'class="active"':''}></span>`).join('')}</div><p class="home-swipe-hint">左右滑动切换游戏</p></div>${entrance(game)}</section>`;
}

// Keep one finite entrance, including across toast/volume rerenders. Fast swipes replace it.
export function createHomeEntrance({now=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout,reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches,onReady=()=>{}}={}) {
  let lastGame=null, started=0, active=false, timer=null, root=null;
  function finish() {
    const wasActive=active;
    if(timer!==null)cancel(timer); timer=null; active=false;
    root?.classList.remove('home-entering');
    const content=root?.querySelector('.home-content'); if(content)content.inert=false;
    if(wasActive)onReady();
  }
  return {
    sync(node,game) {
      root=node;
      if(game!==lastGame){finish();lastGame=game;started=now();active=!reduced();}
      if(!root)return;
      if(reduced()||now()-started>=HOME_ENTRY_MS)finish();
      if(active){
        root.classList.add('home-entering');
        root.style.setProperty('--home-delay',`${-(now()-started)}ms`);
        root.querySelector('.home-content').inert=true;
        if(timer===null)timer=schedule(finish,Math.max(0,HOME_ENTRY_MS-(now()-started)));
      }
    },
    finish,
    leave(){finish();root=null;},
    get active(){return active;}
  };
}
