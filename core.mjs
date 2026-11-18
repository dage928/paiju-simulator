export const GAMES = {
  ygo: { name: '游戏王', short: 'YGO', label: '生命值', unit: 'LP', start: 8000, step: 100, max: 999999, steps: [100, 500, 1000] },
  rift: { name: '符文战场', short: 'RIFTBOUND', label: '得分', unit: '分', start: 0, step: 1, max: 999, steps: [1, 2, 3] },
  pokemon: { name: '宝可梦', short: 'POKÉMON', label: '回合提示', unit: '项', start: 6, step: 1, max: 6, steps: [1] }
};
const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const copy = (value) => structuredClone(value);
export const usesTurnClock = session => ['ygo', 'rift', 'pokemon'].includes(session.game);
export function newSession(game = 'ygo', options = {}, now = Date.now()) {
  if (!GAMES[game]) game = 'ygo';
  return {
    version: 1, id: uid(), game, mode: options.mode === 1 ? 1 : 2, createdAt: now,
    players: [0, 1].map(i => ({ name: options.names?.[i]?.slice(0, 20) || (i ? '对方' : '我方'), value: GAMES[game].start,
      ...(game === 'rift' ? { experience: 0 } : {}),
      slots: Array.from({ length: 6 }, (_, j) => ({ name: j ? `备战 ${j}` : '战斗宝可梦', damage: 0, statuses: [] })) })),
    selected: 0, selectedSlot: [0, 0], step: GAMES[game].step, turn: 1, active: 0,
    timer: { kind: 'up', duration: 50 * 60 * 1000, elapsed: 0, startedAt: null },
    ...(['ygo','rift','pokemon'].includes(game) ? { turnClock: { phase: 'ready', totals: [0, 0], active: 0, startedAt: null } } : {}),
    ...(game==='pokemon'?{pokemonTurn:{used:[false,false,false]}}:{}),
    events: [], undo: [], lastRandom: null
  };
}
export function elapsed(session, now = Date.now()) {
  if (usesTurnClock(session) && session.turnClock) return turnTimes(session, now).reduce((a, b) => a + b, 0);
  return session.timer.elapsed + (session.timer.startedAt === null ? 0 : Math.max(0, now - session.timer.startedAt));
}
export function remaining(session, now = Date.now()) {
  return session.timer.kind === 'down' ? Math.max(0, session.timer.duration - elapsed(session, now)) : elapsed(session, now);
}
export function formatTime(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(seconds / 3600), m = Math.floor(seconds / 60) % 60, s = seconds % 60;
  return `${h ? String(h).padStart(2, '0') + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
export function event(session, type, text, extra = {}, now = Date.now()) {
  const e = { id: uid(), at: now, elapsed: elapsed(session, now), turn: session.turn, type, text, ...extra };
  session.events.push(e);
  return e;
}
function remember(session) {
  session.undo.push(copy({ players: session.players, turn: session.turn, active: session.active, eventCursor: session.events.length }));
  if (session.undo.length > 100) session.undo.shift();
}
export function setCounter(session, player, value, now = Date.now()) {
  if (!session.players[player] || !Number.isFinite(Number(value))) return false;
  const target = Math.max(0, Math.min(GAMES[session.game].max, Math.round(Number(value))));
  const before = session.players[player].value;
  if (target === before) return false;
  remember(session);
  session.players[player].value = target;
  event(session, 'counter', `${session.players[player].name} ${GAMES[session.game].label} ${before} → ${target}`, { player, before, after: target, delta: target - before }, now);
  return true;
}
export function setExperience(session, player, value, now = Date.now()) {
  if (session.game !== 'rift' || !session.players[player] || !Number.isFinite(Number(value))) return false;
  const after = Math.max(0, Math.min(999, Math.round(Number(value))));
  const before = session.players[player].experience ?? 0;
  if (before === after) return false;
  remember(session);
  session.players[player].experience = after;
  event(session, 'experience', `${session.players[player].name} 经验值 ${before} → ${after}`, { player, before, after, delta: after-before, undoable: true }, now);
  return true;
}
export function changeDamage(session, player, slot, value, now = Date.now()) {
  const target = session.players[player]?.slots?.[slot];
  if (!target || !Number.isFinite(Number(value))) return false;
  const after = Math.max(0, Math.min(9990, Math.round(Number(value) / 10) * 10));
  if (target.damage === after) return false;
  remember(session);
  const before = target.damage;
  target.damage = after;
  event(session, 'damage', `${session.players[player].name} · ${target.name} 伤害 ${before} → ${after}`, { player, slot, before, after }, now);
  return true;
}
export function toggleStatus(session, player, slot, status, now = Date.now()) {
  if (!['中毒', '灼伤', '睡眠', '麻痹', '混乱'].includes(status)) return;
  const target = session.players[player]?.slots?.[slot];
  if (!target) return;
  remember(session);
  const enabled = !target.statuses.includes(status);
  target.statuses = target.statuses.filter(s => s !== status && !(enabled && ['睡眠', '麻痹', '混乱'].includes(status) && ['睡眠', '麻痹', '混乱'].includes(s)));
  if (enabled) target.statuses.push(status);
  event(session, 'status', `${session.players[player].name} · ${target.name} ${enabled ? '标记' : '取消'}${status}`, { player, slot, status, enabled }, now);
}
export function nextTurn(session, now = Date.now()) {
  remember(session);
  session.turn += 1;
  session.active = session.mode === 1 ? 0 : 1 - session.active;
  event(session, 'turn', `第 ${session.turn} 回合 · ${session.players[session.active].name}`, {}, now);
}
export function undo(session, now = Date.now()) {
  const previous = session.undo.pop();
  if (!previous) return false;
  const { eventCursor, ...state } = previous;
  Object.assign(session, state);
  if (session.mode === 1) session.active = 0;
  event(session, 'undo', '已撤销上一次数值、状态或回合操作', { undoes: Number.isInteger(eventCursor) ? session.events[eventCursor]?.id : undefined }, now);
  return true;
}
export function toggleTimer(session, now = Date.now()) {
  if (session.timer.startedAt === null) {
    if (session.timer.kind === 'down' && elapsed(session, now) >= session.timer.duration) return false;
    session.timer.startedAt = now;
    event(session, 'timer', '开始计时', {}, now);
  } else {
    session.timer.elapsed = elapsed(session, now);
    session.timer.startedAt = null;
    event(session, 'timer', '暂停计时', {}, now);
  }
  return true;
}
export function resetTimer(session, kind, duration, now = Date.now()) {
  session.timer = { kind: kind === 'down' ? 'down' : 'up', duration: Math.max(60000, Math.min(1440 * 60000, Number(duration) || 50 * 60000)), elapsed: 0, startedAt: null };
  event(session, 'timer', session.timer.kind === 'down' ? `设置倒计时 ${Math.round(session.timer.duration / 60000)} 分钟` : '重置为正计时', {}, now);
}
export function randomInt(max, fill = array => crypto.getRandomValues(array)) {
  if (!Number.isInteger(max) || max < 1 || max > 1000) throw new RangeError('Invalid random range');
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do { fill(buffer); } while (buffer[0] >= limit);
  return buffer[0] % max;
}
export function roll(session, kind = 'coin', count = 1, now = Date.now(), fill) {
  const n = Math.max(1, Math.min(10, Math.floor(count)));
  const results = Array.from({ length: n }, () => randomInt(kind === 'coin' ? 2 : 6, fill) + (kind === 'coin' ? 0 : 1));
  const text = kind === 'coin' ? `${n === 1 ? '抛硬币' : n + '次抛硬币'}：${results.map(v => v ? '正面' : '反面').join('、')}` : `掷骰子：${results.join('、')}`;
  session.lastRandom = { kind, results, id: uid() };
  event(session, 'random', text, { kind, results }, now);
  return results;
}
export function isSession(value) {
  return !!value && (value.pokemonTurn===undefined||!!value.pokemonTurn&&Array.isArray(value.pokemonTurn.used)&&value.pokemonTurn.used.length===3&&value.pokemonTurn.used.every(v=>typeof v==='boolean')) && (value.turnClock === undefined || validTurnClock(value.turnClock)) && value.version === 1 && !!GAMES[value.game] && typeof value.id === 'string' && [1, 2].includes(value.mode)
    && Array.isArray(value.players) && value.players.length === 2
    && value.players.every(p => typeof p.name === 'string' && p.name.length <= 20 && Number.isInteger(p.value) && p.value >= 0 && p.value <= GAMES[value.game].max
      && (p.experience === undefined || Number.isInteger(p.experience) && p.experience >= 0 && p.experience <= 999)
      && Array.isArray(p.slots) && p.slots.length === 6 && p.slots.every(s => typeof s.name === 'string' && s.name.length <= 30 && Number.isInteger(s.damage) && s.damage >= 0 && s.damage <= 9990 && Array.isArray(s.statuses) && s.statuses.every(t => ['中毒', '灼伤', '睡眠', '麻痹', '混乱'].includes(t))))
    && Number.isInteger(value.turn) && value.turn >= 1 && value.turn < 100000 && [0, 1].includes(value.active) && value.active < value.mode && [0, 1].includes(value.selected) && value.selected < value.mode
    && Array.isArray(value.selectedSlot) && value.selectedSlot.length === 2 && value.selectedSlot.every(n => Number.isInteger(n) && n >= 0 && n < 6)
    && Number.isFinite(value.step) && value.step > 0 && value.step <= 100000
    && !!value.timer && ['up', 'down'].includes(value.timer.kind) && Number.isFinite(value.timer.duration) && value.timer.duration > 0 && Number.isFinite(value.timer.elapsed) && value.timer.elapsed >= 0
    && (value.timer.startedAt === null || Number.isFinite(value.timer.startedAt)) && Array.isArray(value.events) && value.events.length <= 10000
    && value.events.every(e => e && typeof e.id === 'string' && typeof e.text === 'string' && e.text.length <= 10000 && typeof e.type === 'string' && Number.isFinite(e.elapsed)) && Array.isArray(value.undo);
}

// Kept separate from selected/active: editing or undoing life must not switch clocks.
export function ensureTurnClock(session) {
  if (usesTurnClock(session) && !session.turnClock) {
    const legacyPokemon=session.game==='pokemon';
    if(legacyPokemon&&session.timer.startedAt!==null)session.timer.elapsed+=Math.max(0,Date.now()-session.timer.startedAt);
    const phase=legacyPokemon&&['playing','draft'].includes(session.matchStatus)&&session.events.length?'paused':'ready';
    session.turnClock = { phase, totals: [0, 0], active: 0, startedAt: null };
    session.timer.startedAt = null;
  }
  return session.turnClock;
}
export function turnTimes(session, now = Date.now()) {
  const clock = session.turnClock;
  if (!clock) return [0, 0];
  const totals = [...clock.totals];
  if (clock.phase === 'running') totals[clock.active] += Math.max(0, now - clock.startedAt);
  return totals;
}
export function startDuel(session, first, now = Date.now()) {
  const clock = ensureTurnClock(session);
  if (!clock || clock.phase === 'running' || ![0, 1].includes(first)) return false;
  clock.active = first; clock.startedAt = now; clock.phase = 'running';
  event(session, 'duel', `开始对局 · ${first ? '对方' : '我方'}开始计时`, {}, now);
  return true;
}
export function switchDuelTurn(session, now = Date.now()) {
  const clock = session.turnClock;
  if (!clock || clock.phase !== 'running') return false;
  clock.totals = turnTimes(session, now);
  clock.active = 1 - clock.active; clock.startedAt = now;
  event(session, 'duel-turn', `回合结束 · ${clock.active ? '对方' : '我方'}开始计时`, { totals: [...clock.totals] }, now);
  return true;
}
export function pauseDuel(session, now = Date.now()) {
  const clock = session.turnClock;
  if (!clock || clock.phase !== 'running') return;
  clock.totals = turnTimes(session, now); clock.phase = 'paused'; clock.startedAt = null;
}
function validTurnClock(clock) {
  return !!clock && ['ready', 'running', 'paused'].includes(clock.phase)
    && [0, 1].includes(clock.active) && Array.isArray(clock.totals) && clock.totals.length === 2
    && clock.totals.every(n => Number.isFinite(n) && n >= 0)
    && (clock.phase === 'running' ? Number.isFinite(clock.startedAt) && clock.startedAt >= 0 : clock.startedAt === null);
}

// Starting from preparation always creates a fresh duel, including imported/legacy states.
export function prepareDuel(previous, now = Date.now()) {
  return newSession('ygo', { mode: previous.mode, names: previous.players.map(p => p.name) }, now);
}

// Display preferences must not reset the duel or its running clock.
export function setDisplayMode(session,mode,now=Date.now()){
  if(![1,2].includes(mode)||session.mode===mode)return false;
  session.mode=mode;
  if(mode===1){session.selected=0;if(!usesTurnClock(session))session.active=0;}
  event(session,'setup',`切换为${mode===1?'单人':'双人共用'}模式`,{},now);
  return true;
}
