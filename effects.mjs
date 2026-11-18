import { volume, gameEffects } from './volume.mjs';
// Source-provided short cues. Playback never blocks or changes game state.
const levels = { tap: .18, start: .32, life: .22, coin: .28, dice: .26, turn: .24 };
const players = new Map();
const tickets = new Map();
let lastTap = 0;
let preview = null, lastPreview = -Infinity;
const previewLevel = .28;
volume.subscribe(level => {
  for (const [name, audio] of players) audio.volume = levels[name] * level;
  if (preview) preview.volume = previewLevel * level;
});
// Mute existing cues without interrupting the audio clock driving LP animation.
gameEffects.subscribe(enabled => { for (const audio of players.values()) audio.muted = !enabled; });
export function stopVolumePreview() {
  if (preview) { preview.pause(); preview.currentTime = 0; }
  lastPreview = -Infinity;
}
export function playVolumePreview(force = false) {
  if (document.hidden || volume.get() === 0) { stopVolumePreview(); return; }
  const now = performance.now();
  if (!force && now - lastPreview < 140) return;
  lastPreview = now;
  if (!preview) {
    preview = document.createElement('audio');
    preview.src = new URL('./audio/tap.wav', import.meta.url).href;
    preview.preload = 'auto'; preview.dataset.uiSound = 'volume-preview';
    preview.hidden = true; preview.setAttribute('aria-hidden', 'true');
    document.body.append(preview);
  }
  preview.volume = previewLevel * volume.get() / 100;
  preview.currentTime = 0;
  preview.play().catch(() => {});
  return preview;
}
export function stopEffect(name) {
  const ticket=tickets.get(name);if(ticket)ticket.state='cancelled';
  const audio=players.get(name);if(audio){audio.pause();audio.currentTime=0;}
}
export function stopEffects() { for (const name of players.keys()) stopEffect(name); stopVolumePreview(); }
export function playEffect(name) {
  if (!(name in levels) || document.hidden || !gameEffects.get()) return;
  if (name === 'tap') {
    const now = performance.now();
    if (now - lastTap < 35) return;
    lastTap = now;
  } else {
    // Keep action cues readable, even during fast repeated life adjustments.
    for (const key of players.keys()) if (key !== 'tap') stopEffect(key);
  }
  let audio = players.get(name);
  if (!audio) {
    audio = document.createElement('audio');
    audio.src = new URL(`./audio/${name}.wav`, import.meta.url).href;
    audio.preload = 'auto'; audio.dataset.uiSound = name;
    audio.hidden = true; audio.setAttribute('aria-hidden', 'true');
    document.body.append(audio); players.set(name, audio);
    audio.addEventListener('ended',()=>{const t=tickets.get(name);if(t)t.state='ended';});
    audio.addEventListener('error',()=>{const t=tickets.get(name);if(t)t.state='failed';});
  }
  const ticket={audio,state:'waiting',cancel(){if(tickets.get(name)===ticket)stopEffect(name);}};
  tickets.set(name,ticket);
  audio.muted = false;
  audio.volume = levels[name] * volume.get() / 100; audio.currentTime = 0;
  // Browser autoplay restrictions or unavailable output must not interrupt play.
  audio.play().then(()=>{if(tickets.get(name)===ticket&&ticket.state==='waiting')ticket.state='playing';}).catch(()=>{if(tickets.get(name)===ticket&&ticket.state!=='cancelled')ticket.state='failed';});
  return ticket;
}
document.addEventListener('visibilitychange', () => { if (document.hidden) stopEffects(); });
