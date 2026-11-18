import { GAMES, newSession, copy, event, elapsed, remaining, formatTime, setCounter, changeDamage, toggleStatus, nextTurn, undo, toggleTimer, resetTimer, roll, isSession } from './core.mjs';

const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const iconPaths = {
  archive: '<path d="M4 8h16v12H4zM3 4h18v4H3zM9 12h6"/>', help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 1.5-2.5 3.5M12 17h.01"/>',
  arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>', plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', undo: '<path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 7 7v3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', chevron: '<path d="m8 10 4 4 4-4"/>', play: '<path d="m8 4 12 8-12 8z"/>', pause: '<path d="M8 5v14M16 5v14"/>',
  coin: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><path d="M12 8v8M10 10l2-2"/>', dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7 7h.01M17 7h.01M12 12h.01M7 17h.01M17 17h.01"/>',
  sliders: '<path d="M4 7h5m4 0h7M4 17h9m4 0h3"/><circle cx="11" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>', switch: '<path d="M4 7h15l-4-4M20 17H5l4 4M19 7l-4 4M5 17l4-4"/>',
  mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>', shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>', close: '<path d="m6 6 12 12M18 6 6 18"/>', note: '<path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4"/>', check: '<path d="m5 12 4 4L19 6"/>',
  turn: '<path d="M5 8h12l-4-4M19 16H7l4 4M17 8l-4 4M7 16l4-4"/>', upload: '<path d="M12 17V3m-5 5 5-5 5 5M4 16v5h16v-5"/>', trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.note}</svg>`;
function paintIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
paintIcons();

const STORAGE_KEY = 'paiju-library-v1';
let library = { active: newSession(), archives: [] };
let storageOK = true;
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (isSession(parsed.active) && Array.isArray(parsed.archives) && parsed.archives.every(isSession)) library = parsed;
    else warnStorage('本机旧记录无法读取。原始数据未覆盖；请先通过历史对局导出原始备份。');
  }
} catch { warnStorage('浏览器未允许读取本机记录。本次可以使用，请在结束时导出备份。'); }
let session = library.active;
let journalFilter = 'all', coinCount = 1, faceToFace = false, modalAction = null, adjustMode = 'subtract';
let audioDBPromise, recording = null, recorderBusy = false, recordPending = false, holdRequested = false, recordError = '';
let toastTimeout, randomTimeout, randomBusy = false, lastRenderedRandom = '', expiredFor = '', audioURLs = new Map();
let runtimeAnchor = { startedAt: session.timer.startedAt, time: performance.now(), carried: session.timer.startedAt === null ? 0 : Math.max(0, Date.now() - session.timer.startedAt) };

function warnStorage(text) {
  storageOK = false;
  $('#storage-warning').hidden = false; $('#storage-warning').textContent = text;
  $('#save-status').textContent = '请导出备份';
}
function save() {
  if (!storageOK) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
    $('#save-status').textContent = '已保存在本机';
  } catch { warnStorage('本机存储空间不足或保存被阻止。请导出复盘，避免关闭页面后丢失。'); }
}
function toast(message) {
  clearTimeout(toastTimeout); $('#toast').textContent = message; $('#toast').classList.add('visible');
  toastTimeout = setTimeout(() => $('#toast').classList.remove('visible'), 3200);
}
function updateAnchor() {
  if (runtimeAnchor.startedAt !== session.timer.startedAt) runtimeAnchor = { startedAt: session.timer.startedAt, time: performance.now(), carried: 0 };
}
function clockNow() {
  updateAnchor();
  return session.timer.startedAt === null ? Date.now() : session.timer.startedAt + runtimeAnchor.carried + Math.max(0, performance.now() - runtimeAnchor.time);
}
function act(fn, { message, player, drawLog = true } = {}) {
  fn(clockNow()); save(); render(drawLog);
  if (player !== undefined) { const field = $(`[data-value="${player}"]`); field?.classList.add('change-flash'); }
  if (message) toast(message);
}

function render(drawLog = true) {
  const focusKey = document.activeElement?.dataset?.fid;
  const game = GAMES[session.game];
  $('#game-title').textContent = `${game.name}对战`;
  $('#game-description').textContent = session.game === 'pokemon' ? '奖赏卡、每只宝可梦的伤害，分开记清楚。' : session.game === 'rift' ? '每一分，都在通往下一次胜利。' : '每一次变化，都有迹可循。';
  document.querySelectorAll('.game-button').forEach(el => {
    const selected = el.dataset.game === session.game; el.classList.toggle('active', selected);
    if (selected) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
  document.querySelectorAll('[data-action="mode"]').forEach(el => el.setAttribute('aria-pressed', String(Number(el.dataset.mode) === session.mode)));
  for (let i = 0; i < 2; i++) if (document.activeElement !== $(`#name-${i}`)) $(`#name-${i}`).value = session.players[i].name;
  $('#second-name').hidden = session.mode === 1;
  $('#face-to-face').disabled = session.mode === 1;
  $('#undo-button').disabled = !session.undo.length;
  const board = $('#counter-board');
  board.className = `counter-board${session.mode === 1 ? ' solo' : ''}${session.game === 'pokemon' ? ' pokemon-board' : ''}`;
  board.innerHTML = session.players.slice(0, session.mode).map((p, i) => session.game === 'pokemon' ? pokemonPlayer(p, i) : counterPlayer(p, i)).join('');
  $('#turn-text').textContent = `第 ${session.turn} 回合 · ${session.players[session.active].name}`;
  $('#selected-label').textContent = `当前选择：${session.players[session.selected].name}`;
  $('#step-buttons').innerHTML = game.steps.map(v => `<button data-action="step" data-value="${v}" data-fid="step-${v}" aria-pressed="${session.step === v}">${v}</button>`).join('');
  $('#coin-count-text').textContent = String(coinCount);
  renderTimer(); renderRecording(); renderRandom();
  if (drawLog) renderJournal();
  if (focusKey) document.querySelector(`[data-fid="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
}
function playerHead(p, i) {
  return `<div class="player-head"><button class="player-select" data-action="select" data-player="${i}" data-fid="select-${i}" aria-pressed="${session.selected === i}" aria-label="选择${escapeHTML(p.name)}"><span class="player-dot"></span>${escapeHTML(p.name)}</button><span class="player-order">P${i + 1}</span></div>`;
}
function counterControls(p, i, label = '') {
  return `<div class="counter-controls"><button data-action="minus" data-player="${i}" data-fid="minus-${i}" aria-label="${escapeHTML(p.name)}${label}减少${session.step}" ${p.value === 0 ? 'disabled' : ''}>${icon('minus')}${session.step}</button><button class="positive" data-action="plus" data-player="${i}" data-fid="plus-${i}" aria-label="${escapeHTML(p.name)}${label}增加${session.step}" ${p.value >= GAMES[session.game].max ? 'disabled' : ''}>${icon('plus')}${session.step}</button></div>`;
}
function counterPlayer(p, i) {
  const g = GAMES[session.game];
  return `<article class="player${session.selected === i ? ' selected' : ''}${faceToFace && i ? ' turned' : ''}"><div class="player-content">${playerHead(p, i)}<p class="counter-label">${g.label}</p><button class="value-button" data-action="adjust" data-player="${i}" data-fid="value-${i}" aria-label="计算${escapeHTML(p.name)}${g.label}，当前${p.value}"><span class="counter-value" data-value="${i}">${p.value}</span><span class="value-unit">${g.unit}</span></button>${session.game === 'rift' ? '<p class="score-target">目标分数可自行确认</p>' : ''}${counterControls(p, i)}</div></article>`;
}
function pokemonPlayer(p, i) {
  const slot = session.selectedSlot[i], target = p.slots[slot];
  return `<article class="player${session.selected === i ? ' selected' : ''}${faceToFace && i ? ' turned' : ''}"><div class="player-content">${playerHead(p, i)}<div class="pokemon-prizes"><div><p class="counter-label">剩余奖赏卡</p><button class="prize-value" data-action="adjust" data-player="${i}" data-fid="value-${i}" aria-label="调整${escapeHTML(p.name)}剩余奖赏卡"><strong data-value="${i}">${p.value}</strong><span>张</span></button></div><div class="prize-pips" aria-label="奖赏卡数量">${Array.from({ length: 6 }, (_, j) => `<button class="${j < p.value ? 'filled' : ''}" data-action="prizes" data-player="${i}" data-count="${j + 1}" data-fid="prize-${i}-${j}" aria-label="${escapeHTML(p.name)}剩余${j + 1}张奖赏卡" aria-pressed="${p.value === j + 1}"></button>`).join('')}</div></div><div class="pokemon-positions">${p.slots.map((s, j) => `<button class="pokemon-position${slot === j ? ' selected' : ''}${s.statuses.length ? ' has-status' : ''}" data-action="slot" data-player="${i}" data-slot="${j}" data-fid="slot-${i}-${j}" aria-pressed="${slot === j}" aria-label="${escapeHTML(s.name)}，${s.damage}点伤害${s.statuses.length ? '，' + s.statuses.join('、') : ''}">${escapeHTML(s.name)}<strong>${s.damage}</strong></button>`).join('')}</div><div class="damage-editor"><div class="damage-title"><span>${escapeHTML(target.name)} · 伤害</span><button data-action="slot-edit" data-player="${i}">改名 / 清空</button></div><div class="damage-controls"><button data-action="damage-minus" data-player="${i}" data-fid="damage-minus-${i}" aria-label="${escapeHTML(p.name)}选中宝可梦伤害减10" ${target.damage === 0 ? 'disabled' : ''}>− 10</button><button data-action="damage-plus" data-player="${i}" data-fid="damage-plus-${i}" aria-label="${escapeHTML(p.name)}选中宝可梦伤害加10">＋ 10</button></div><div class="status-buttons">${['中毒', '灼伤', '睡眠', '麻痹', '混乱'].map(s => `<button data-action="status" data-player="${i}" data-status="${s}" data-fid="status-${i}-${s}" aria-pressed="${target.statuses.includes(s)}">${s}</button>`).join('')}</div></div>${counterControls(p, i, '奖赏卡')}</div></article>`;
}
function renderTimer() {
  const now = clockNow();
  const value = remaining(session, now);
  $('#timer-value').textContent = formatTime(value);
  $('#timer-kind').textContent = session.timer.kind === 'down' ? `${Math.round(session.timer.duration / 60000)}分钟倒计时` : '正计时';
  const running = session.timer.startedAt !== null;
  $('#timer-state').textContent = running ? '对局进行中' : session.timer.elapsed ? '已暂停' : '尚未开始';
  $('#timer-button').innerHTML = `${icon(running ? 'pause' : 'play')}<span>${running ? '暂停' : '开始计时'}</span>`;
  const expired = session.timer.kind === 'down' && value <= 0;
  $('.timer-bar').classList.toggle('timer-expired', expired);
  if (expired && running && expiredFor !== session.id + session.timer.duration) {
    expiredFor = session.id + session.timer.duration;
    session.timer.elapsed = session.timer.duration; session.timer.startedAt = null;
    event(session, 'timer', '倒计时结束'); save(); renderJournal();
    toast('计时结束，请确认当前对局的结束流程。');
  }
}
function renderRandom() {
  const value = session.lastRandom, box = $('#random-result');
  if (randomBusy) return;
  if (!value) { box.textContent = '结果会记入时间线'; lastRenderedRandom = ''; return; }
  const result = value.kind === 'coin' ? value.results.map(v => v ? '正面' : '反面').join(' · ') : value.results.join(' · ');
  box.innerHTML = `<strong>${escapeHTML(result)}</strong>${value.kind === 'coin' && value.results.length > 1 ? `<span>　${value.results.filter(Boolean).length}正 / ${value.results.filter(v => !v).length}反</span>` : ''}`;
  if (lastRenderedRandom !== value.id) { box.classList.remove('revealing'); void box.offsetWidth; box.classList.add('revealing'); lastRenderedRandom = value.id; }
}
function renderJournal() {
  $('#event-count').textContent = String(session.events.length);
  $('#note-count').textContent = String(session.events.filter(e => ['note', 'audio'].includes(e.type)).length);
  document.querySelectorAll('[data-action="filter"]').forEach(el => el.setAttribute('aria-selected', String(el.dataset.filter === journalFilter)));
  const list = $('#event-list');
  list.setAttribute('aria-labelledby', journalFilter === 'all' ? 'tab-all' : 'tab-notes');
  const events = session.events.filter(e => journalFilter === 'all' || ['note', 'audio'].includes(e.type));
  const previousScroll = list.scrollTop;
  if (!events.length) {
    list.innerHTML = `<div class="empty-journal">${icon(journalFilter === 'all' ? 'note' : 'mic')}<strong>${journalFilter === 'all' ? '好牌局，从这一刻开始' : '留下你的对局思路'}</strong><p>${journalFilter === 'all' ? '调整一次数值，抛一枚硬币。<br>牌局的故事会从这里展开。' : '写下一点观察，或录一段语音。<br>复盘时，就能找到当时的想法。'}</p></div>`;
    return;
  }
  list.innerHTML = events.slice().reverse().map(e => `<div class="event-row"><span class="event-symbol ${escapeHTML(e.type)}">${icon(e.type === 'audio' ? 'mic' : e.type === 'note' ? 'note' : e.type === 'random' ? (e.kind === 'coin' ? 'coin' : 'dice') : e.type === 'timer' ? 'clock' : e.type === 'turn' ? 'turn' : e.type === 'undo' ? 'undo' : 'plus')}</span><div><div class="event-meta"><time>${formatTime(e.elapsed)}</time><span>第 ${escapeHTML(e.turn)} 回合</span>${e.type === 'audio' ? '<span>语音</span>' : ''}</div><p class="event-text ${e.type === 'note' ? 'note' : ''}">${escapeHTML(e.text)}</p>${e.type === 'audio' ? `<audio controls preload="none" data-audio="${escapeHTML(e.audioId)}" aria-label="回听复盘录音"></audio><div class="audio-actions"><button data-action="download-audio" data-audio="${escapeHTML(e.audioId)}">下载录音</button></div>` : ''}</div></div>`).join('');
  list.scrollTop = previousScroll;
  list.querySelectorAll('audio[data-audio]').forEach(async audio => {
    const id = audio.dataset.audio;
    try {
      if (!audioURLs.has(id)) {
        const record = await getAudio(id);
        if (record) audioURLs.set(id, URL.createObjectURL(record.blob));
      }
      if (audioURLs.has(id) && audio.isConnected) audio.src = audioURLs.get(id);
      else if (audio.isConnected) { audio.remove(); }
    } catch { if (audio.isConnected) audio.remove(); }
  });
}

const modal = $('#modal');
$('#modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) { const rect = modal.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) closeModal(); } });
modal.addEventListener('close', () => { modalAction = null; });
function closeModal() { modal.close(); }
function openModal(title, html, callback) {
  $('#modal-title').textContent = title; $('#modal-body').innerHTML = html;
  modalAction = callback || null;
  if (!modal.open) modal.showModal();
  requestAnimationFrame(() => { const first = modal.querySelector('[autofocus]'); if (first) { first.focus(); first.select?.(); } });
}
function confirmation(title, description, callback, label = '确认') {
  openModal(title, `<p class="dialog-description">${escapeHTML(description)}</p><div class="dialog-actions"><button class="secondary-button" data-action="modal-cancel">取消</button><button class="primary-button" data-action="modal-confirm" autofocus>${label}</button></div>`, callback);
}
function hasRecording() {
  if (recording || recordPending || recorderBusy) { toast('请先结束并保存录音。'); return true; }
  return false;
}
function archiveCurrent() {
  if (!session.events.length && !session.timer.elapsed && session.timer.startedAt === null) return;
  const archive = copy(session);
  archive.timer.elapsed = elapsed(session, clockNow()); archive.timer.startedAt = null;
  library.archives = library.archives.filter(s => s.id !== archive.id); library.archives.unshift(archive);
}
function startNew(game = session.game) {
  if (hasRecording()) return;
  const go = () => {
    archiveCurrent();
    library.active = newSession(game, { mode: session.mode, names: session.players.map(p => p.name) }); session = library.active;
    expiredFor = ''; journalFilter = 'all'; save(); render(); toast('新对局已准备好');
  };
  if (session.events.length || session.timer.startedAt !== null || session.timer.elapsed) confirmation('开启新对局', '本局会保存到历史对局，计数与计时将重新开始。', go, '保存并新建');
  else go();
}
function openAdjust(player) {
  const p = session.players[player], g = GAMES[session.game]; adjustMode = 'subtract';
  openModal(`调整${p.name}${g.label}`, `<p class="dialog-description">当前 ${p.value} ${g.unit}。输入本次要调整的数值。</p><div class="segmented adjust-modes"><button data-action="adjust-mode" data-mode="subtract" aria-pressed="true">扣除</button><button data-action="adjust-mode" data-mode="add" aria-pressed="false">增加</button><button data-action="adjust-mode" data-mode="set" aria-pressed="false">设为</button></div><label class="dialog-field"><span>调整数值</span><input id="adjust-amount" class="amount-input" type="number" inputmode="numeric" min="0" max="999999" value="${session.step}" autofocus></label><div class="amount-presets">${g.steps.map(n => `<button data-action="amount-preset" data-value="${n}">${n}</button>`).join('')}${session.game === 'ygo' ? '<button data-action="half" data-player="' + player + '">生命值减半</button>' : ''}</div><p id="adjust-error" class="inline-error" hidden></p><div class="dialog-actions"><button class="secondary-button" data-action="modal-cancel">取消</button><button class="primary-button" data-action="apply-adjust" data-player="${player}">确认调整</button></div>`);
}
function applyAdjust(player) {
  const input = $('#adjust-amount'), amount = Number(input.value);
  if (input.value.trim() === '' || !Number.isInteger(amount) || amount < 0 || amount > 999999) { $('#adjust-error').hidden = false; $('#adjust-error').textContent = '请输入0至999999之间的整数。'; input.focus(); return; }
  const before = session.players[player].value;
  const value = adjustMode === 'set' ? amount : before + (adjustMode === 'add' ? amount : -amount);
  closeModal(); act(now => setCounter(session, player, value, now), { player });
}
function timerSettings() {
  openModal('对局计时', `<p class="dialog-description">可自由设置训练时间。应用后将重置当前计时。</p><label class="dialog-field"><span>计时方式</span><select id="timer-mode"><option value="up" ${session.timer.kind === 'up' ? 'selected' : ''}>正计时</option><option value="down" ${session.timer.kind === 'down' ? 'selected' : ''}>倒计时</option></select></label><label class="dialog-field"><span>倒计时时长（分钟，1至1440）</span><input id="timer-minutes" type="number" inputmode="numeric" min="1" max="1440" value="${Math.round(session.timer.duration / 60000)}"></label><p id="timer-error" class="inline-error" hidden></p><div class="dialog-actions"><button class="secondary-button" data-action="modal-cancel">取消</button><button class="primary-button" data-action="apply-timer">应用并重置</button></div>`);
}
function openSlotEditor(player) {
  const target = session.players[player].slots[session.selectedSlot[player]];
  openModal('编辑宝可梦位置', `<p class="dialog-description">切换或进化时可自行改名；更换宝可梦时请确认是否清空伤害和状态。</p><label class="dialog-field"><span>位置或宝可梦名称</span><input id="slot-name" maxlength="30" value="${escapeHTML(target.name)}" autofocus></label><label class="check-label"><input id="slot-clear" type="checkbox">清空这个位置的伤害与状态</label><div class="dialog-actions"><button class="secondary-button" data-action="modal-cancel">取消</button><button class="primary-button" data-action="save-slot" data-player="${player}">保存</button></div>`);
}
function showHistory() {
  openModal('历史对局', `<p class="dialog-description">只保存在这个浏览器。导出备份后，可在其他设备导入。</p><div class="history-list">${library.archives.length ? library.archives.map(s => `<div class="history-item"><div><strong>${escapeHTML(GAMES[s.game].name)} · ${escapeHTML(s.players[0].name)}${s.mode === 2 ? ' / ' + escapeHTML(s.players[1].name) : ''}</strong><p>${new Date(s.createdAt).toLocaleDateString('zh-CN')} · ${s.events.length}条记录 · 第${s.turn}回合</p></div><button data-action="resume" data-session="${escapeHTML(s.id)}">继续</button></div>`).join('') : '<p class="history-empty">还没有历史对局。<br>开启新对局时，当前记录会保存在这里。</p>'}</div><div class="dialog-actions"><button class="secondary-button" data-action="import">${icon('upload')} 导入备份</button>${!storageOK ? '<button class="secondary-button" data-action="raw-backup">导出原始数据</button>' : ''}<button class="primary-button" data-action="modal-cancel">完成</button></div>`);
}
function showHelp() {
  openModal('让操作跟得上思路', `<p class="dialog-description">点击大数字可输入精确数值。玩家名称旁的小圆点表示当前按键控制的玩家。</p><div class="help-list"><span>减少 / 增加选中玩家数值</span><span><kbd>A</kbd> / <kbd>D</kbd></span><span>切换玩家</span><kbd>S</kbd><span>开始 / 暂停计时</span><kbd>空格</kbd><span>下一回合</span><kbd>T</kbd><span>抛硬币</span><kbd>C</kbd><span>按住录音，松开保存</span><kbd>R</kbd><span>撤销数值、状态或回合操作</span><span><kbd>Ctrl</kbd> + <kbd>Z</kbd></span></div><div class="help-details">宝可梦：先选择一个位置，再调整伤害与状态。奖赏卡单独计数。<br><br>录音需要浏览器麦克风权限，最长60秒。录音不自动转文字；可下载后转写。<br><br>数据只保存在当前浏览器，清理浏览器数据会删除记录。导出的JSON备份包含本局文字与可读取的录音，可重新导入。<br><br>本页验证功能和操作流程；真实屏幕、实体按钮和硬件性能稍后确定。</div><div class="dialog-actions"><button class="primary-button" data-action="modal-cancel">开始试用</button></div>`);
}

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
function renderRecording() {
  const active = !!recording;
  $('#record-toggle').classList.toggle('recording', active);
  $('#record-toggle').disabled = recorderBusy || recordPending;
  $('#record-toggle').innerHTML = `${icon('mic')}<span>${recordPending ? '等待麦克风…' : recorderBusy ? '正在保存…' : active ? '结束并保存' : '语音记录'}</span>`;
  $('#hold-record').classList.toggle('recording', active);
  $('#record-status').classList.toggle('error', !!recordError);
  $('#record-status').textContent = recordError || (recordPending ? '请允许使用麦克风。' : recorderBusy ? '正在把录音保存到本机…' : active ? `正在录音 ${formatTime(Date.now() - recording.started)} · 最长60秒` : '文字和录音仅保存在当前浏览器。');
}
async function startRecording(held = false) {
  if (recording || recordPending || recorderBusy) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    recordError = '此浏览器无法录音。请在最新版Chrome或Edge的安全页面中打开；也可以先写文字笔记。'; renderRecording(); toast('浏览器暂不支持录音，请先使用文字笔记。'); return;
  }
  recordError = ''; recordPending = true; renderRecording();
  let stream;
  try {
    await openAudioDB();
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    if (held && !holdRequested) { stream.getTracks().forEach(track => track.stop()); recordPending = false; renderRecording(); return; }
    const mimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const parts = [], started = Date.now(), sessionId = session.id, contextElapsed = elapsed(session, clockNow()), contextTurn = session.turn;
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
        event(session, 'audio', `复盘录音 · ${Math.max(1, Math.round(duration))}秒`, { audioId: id, duration, elapsed: contextElapsed, turn: contextTurn });
        save(); renderJournal(); toast('录音已保存到本机');
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
    recordError = error.name === 'NotAllowedError' ? '麦克风权限未获允许。请在浏览器地址栏开放麦克风后重试，或使用文字笔记。' : error.name === 'NotFoundError' ? '没有找到麦克风，请连接后重试。' : `无法开始录音：${error.message || '请检查麦克风或浏览器存储权限。'}`;
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
function exportDialog() {
  if (hasRecording() || recorderBusy) { toast('请等待录音保存完成后导出。'); return; }
  openModal('把这一局带走', `<p class="dialog-description">导出JSON可备份文字和录音；文字版适合直接阅读和补充复盘。</p><div class="export-options"><button data-action="export-json">${icon('archive')}<span><strong>完整备份 · JSON</strong><small>包含本局操作、笔记和可读取的录音，可重新导入。</small></span></button><button data-action="export-text">${icon('note')}<span><strong>文字复盘 · Markdown</strong><small>按时间整理操作与笔记，录音请单独下载。</small></span></button></div><div class="dialog-actions"><button class="secondary-button" data-action="import">导入已有备份</button><button class="secondary-button" data-action="modal-cancel">取消</button></div>`);
}
async function exportJSON(button) {
  button.disabled = true; button.querySelector('strong').textContent = '正在整理备份…';
  try {
    const snapshot = copy(session); snapshot.timer.elapsed = elapsed(session, clockNow()); snapshot.timer.startedAt = null; snapshot.undo = [];
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
  const text = [`# ${GAMES[session.game].name}对局复盘`, '', `玩家：${session.players.slice(0, session.mode).map(p => p.name).join(' / ')}`, `开始时间：${new Date(session.createdAt).toLocaleString('zh-CN')}`, `当前回合：${session.turn}`, `对局计时：${formatTime(elapsed(session, clockNow()))}`, '', '## 对局时间线', '', ...session.events.map(e => `- [${formatTime(e.elapsed)} · 第${e.turn}回合] ${e.text}${e.type === 'audio' ? '（录音需单独下载）' : ''}`), '', '## 赛后补充', '', '- 做得好的决策：', '- 想重来的决策：', '- 下次尝试：', ''].join('\n');
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
    restored.timer.elapsed = Math.min(30 * 86400000, elapsed(restored)); restored.timer.startedAt = null;
    for (const a of data.recordings) {
      if (typeof a.id !== 'string' || typeof a.base64 !== 'string' || a.base64.length > 15 * 1024 * 1024 || typeof a.type !== 'string' || !/^audio\/(webm|ogg|mp4|wav|mpeg)(;.*)?$/.test(a.type)) throw new Error('备份中的录音格式无效。');
    }
    confirmation('导入对局备份', '当前对局会保存在历史中，导入的对局将暂停计时后打开。', async () => {
      try {
        const importedAudioIds = new Map();
        for (const a of data.recordings) {
          const bytes = Uint8Array.from(atob(a.base64), c => c.charCodeAt(0));
          const importedId = crypto.randomUUID(); importedAudioIds.set(a.id, importedId);
          await putAudio({ id: importedId, sessionId: restored.id, blob: new Blob([bytes], { type: a.type }), duration: a.duration, createdAt: a.createdAt });
        }
        restored.events.forEach(e => { e.id = crypto.randomUUID(); if (e.type === 'audio' && importedAudioIds.has(e.audioId)) e.audioId = importedAudioIds.get(e.audioId); });
        archiveCurrent();
        library.active = restored; session = restored; journalFilter = 'all'; save(); render(); toast('已导入对局备份');
      } catch { toast('录音导入失败，请检查浏览器空间与文件完整性。原对局未切换。'); }
    }, '导入并打开');
  } catch (error) { toast(error.message || '无法读取备份文件'); }
});

function adjustSelected(direction) {
  const i = session.selected; act(now => setCounter(session, i, session.players[i].value + direction * session.step, now), { player: i });
}
function randomAction(kind) {
  if (randomBusy) return;
  try {
    act(now => roll(session, kind, kind === 'coin' ? coinCount : 1, now));
    randomBusy = true;
    $('#random-result').textContent = kind === 'coin' ? '硬币落下中…' : '骰子滚动中…';
    document.querySelectorAll('[data-action="coin"], [data-action="dice"]').forEach(b => b.disabled = true);
    clearTimeout(randomTimeout); randomTimeout = setTimeout(() => {
      randomBusy = false; document.querySelectorAll('[data-action="coin"], [data-action="dice"]').forEach(b => b.disabled = false); renderRandom();
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450);
  } catch { toast('浏览器无法生成安全随机数，请使用最新版浏览器。'); }
}

document.addEventListener('click', async e => {
  const button = e.target.closest('button[data-action]'); if (!button || button.disabled) return;
  const action = button.dataset.action, player = Number(button.dataset.player);
  if (action === 'game') { if (button.dataset.game !== session.game) startNew(button.dataset.game); }
  else if (action === 'mode') {
    const mode = Number(button.dataset.mode); if (mode === session.mode) return;
    act(now => { session.mode = mode; if (mode === 1) { session.active = 0; session.selected = 0; } event(session, 'setup', `切换为${mode === 1 ? '单人' : '双人共用'}模式`, {}, now); });
  }
  else if (action === 'new') startNew();
  else if (action === 'select') { session.selected = player; save(); render(false); }
  else if (action === 'select-next') { session.selected = session.mode === 1 ? 0 : 1 - session.selected; save(); render(false); }
  else if (action === 'minus' || action === 'plus') act(now => setCounter(session, player, session.players[player].value + (action === 'minus' ? -1 : 1) * session.step, now), { player });
  else if (action === 'hardware-minus' || action === 'hardware-plus') adjustSelected(action === 'hardware-minus' ? -1 : 1);
  else if (action === 'step') { session.step = Number(button.dataset.value); save(); render(false); }
  else if (action === 'adjust') openAdjust(player);
  else if (action === 'adjust-mode') { adjustMode = button.dataset.mode; modal.querySelectorAll('[data-action="adjust-mode"]').forEach(b => b.setAttribute('aria-pressed', String(b === button))); $('#adjust-amount').focus(); }
  else if (action === 'amount-preset') { $('#adjust-amount').value = button.dataset.value; $('#adjust-amount').focus(); }
  else if (action === 'apply-adjust') applyAdjust(player);
  else if (action === 'half') { closeModal(); act(now => setCounter(session, player, Math.floor(session.players[player].value / 2), now), { player }); }
  else if (action === 'prizes') act(now => setCounter(session, player, Number(button.dataset.count), now), { player });
  else if (action === 'slot') { session.selectedSlot[player] = Number(button.dataset.slot); session.selected = player; save(); render(false); }
  else if (action === 'damage-minus' || action === 'damage-plus') { const slot = session.selectedSlot[player]; act(now => changeDamage(session, player, slot, session.players[player].slots[slot].damage + (action === 'damage-minus' ? -10 : 10), now)); }
  else if (action === 'status') act(now => toggleStatus(session, player, session.selectedSlot[player], button.dataset.status, now));
  else if (action === 'slot-edit') openSlotEditor(player);
  else if (action === 'save-slot') {
    const name = $('#slot-name').value.trim(); if (!name) { $('#slot-name').focus(); return; }
    const clear = $('#slot-clear').checked, slot = session.selectedSlot[player];
    closeModal(); act(now => {
      session.undo.push(copy({ players: session.players, active: session.active, turn: session.turn })); if (session.undo.length > 100) session.undo.shift();
      const target = session.players[player].slots[slot]; target.name = name; if (clear) { target.damage = 0; target.statuses = []; }
      event(session, 'setup', `${session.players[player].name} · 位置改名为${name}${clear ? '，已清空伤害和状态' : ''}`, {}, now);
    });
  }
  else if (action === 'undo') act(now => undo(session, now), { message: '已撤销；原操作仍保留在时间线中' });
  else if (action === 'next-turn') act(now => nextTurn(session, now));
  else if (action === 'timer') act(now => { if (!toggleTimer(session, now)) toast('倒计时已结束，请先重新设置。'); });
  else if (action === 'timer-settings') timerSettings();
  else if (action === 'apply-timer') {
    const minutes = Number($('#timer-minutes').value), kind = $('#timer-mode').value;
    if (kind === 'down' && (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440 || !Number.isInteger(minutes))) { $('#timer-error').hidden = false; $('#timer-error').textContent = '请输入1至1440之间的整数分钟。'; return; }
    closeModal(); expiredFor = ''; act(now => resetTimer(session, kind, minutes * 60000, now));
  }
  else if (action === 'coin' || action === 'dice') randomAction(action);
  else if (action === 'random-settings') {
    openModal('硬币数量', `<p class="dialog-description">一次抛1至10枚，每枚结果都会记入时间线。</p><label class="dialog-field"><span>硬币数量</span><select id="coin-count">${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${coinCount === i + 1 ? 'selected' : ''}>${i + 1} 枚</option>`).join('')}</select></label><div class="dialog-actions"><button class="primary-button" data-action="save-coins">确认</button></div>`);
  }
  else if (action === 'save-coins') { coinCount = Number($('#coin-count').value); closeModal(); render(false); }
  else if (action === 'filter') { journalFilter = button.dataset.filter; renderJournal(); }
  else if (action === 'note') {
    const text = $('#note-text').value.trim(); if (!text) { toast('先写一点想法，再记下来。'); $('#note-text').focus(); return; }
    $('#note-text').value = ''; act(now => event(session, 'note', text, {}, now), { message: '已记下此刻的想法' }); $('#event-list').scrollTop = 0;
  }
  else if (action === 'record') { if (recording) stopRecording(); else startRecording(); }
  else if (action === 'download-audio') downloadAudio(button.dataset.audio);
  else if (action === 'history') showHistory();
  else if (action === 'resume') {
    if (hasRecording() || recorderBusy) return;
    const target = library.archives.find(s => s.id === button.dataset.session); if (!target) return;
    const restored = copy(target); archiveCurrent(); library.archives = library.archives.filter(s => s.id !== target.id);
    library.active = restored; session = restored; journalFilter = 'all'; expiredFor = ''; closeModal(); save(); render(); toast('已打开历史对局，计时保持暂停');
  }
  else if (action === 'export') exportDialog();
  else if (action === 'export-json') exportJSON(button);
  else if (action === 'export-text') exportText();
  else if (action === 'import') { if (!hasRecording()) { closeModal(); $('#import-file').click(); } }
  else if (action === 'raw-backup') downloadBlob(new Blob([localStorage.getItem(STORAGE_KEY) || '{}'], { type: 'application/json' }), '牌局-原始数据.json');
  else if (action === 'help') showHelp();
  else if (action === 'modal-cancel') closeModal();
  else if (action === 'modal-confirm') { const callback = modalAction; closeModal(); if (callback) await callback(); }
});

for (let i = 0; i < 2; i++) $(`#name-${i}`).addEventListener('change', e => {
  const name = e.target.value.trim().slice(0, 20); session.players[i].name = name || (i ? '对方' : '我方'); save(); render(false);
});
$('#face-to-face').addEventListener('change', e => { faceToFace = e.target.checked; render(false); });
$('#note-text').addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); $('#add-note').click(); } });
$('#modal-body').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'adjust-amount') { e.preventDefault(); modal.querySelector('[data-action="apply-adjust"]').click(); } });
const holdButton = $('#hold-record');
holdButton.addEventListener('pointerdown', e => { if (e.button !== 0) return; e.preventDefault(); holdRequested = true; holdButton.setPointerCapture(e.pointerId); startRecording(true); });
holdButton.addEventListener('pointerup', () => { if (holdRequested) stopRecording(); });
holdButton.addEventListener('pointercancel', () => { if (holdRequested) stopRecording(); });
holdButton.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); holdRequested = true; startRecording(true); } });
holdButton.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); stopRecording(); } });
document.addEventListener('keydown', e => {
  if (e.target.closest('input,textarea,select,[contenteditable=true]') || modal.open || e.altKey || e.repeat) return;
  if (e.target.closest('button') && [' ', 'Enter'].includes(e.key)) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (session.undo.length) act(now => undo(session, now)); return; }
  if (e.ctrlKey || e.metaKey) return;
  const key = e.key.toLowerCase();
  if (key === 'a') { e.preventDefault(); adjustSelected(-1); }
  else if (key === 'd') { e.preventDefault(); adjustSelected(1); }
  else if (key === 's') { e.preventDefault(); session.selected = session.mode === 1 ? 0 : 1 - session.selected; save(); render(false); }
  else if (key === ' ') { e.preventDefault(); act(now => toggleTimer(session, now)); }
  else if (key === 't') { e.preventDefault(); act(now => nextTurn(session, now)); }
  else if (key === 'c') { e.preventDefault(); randomAction('coin'); }
  else if (key === 'r') { e.preventDefault(); holdRequested = true; startRecording(true); }
  else if (key === '?') showHelp();
});
$('.journal-tabs').addEventListener('keydown', e => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault(); journalFilter = e.key === 'Home' ? 'all' : e.key === 'End' ? 'notes' : journalFilter === 'all' ? 'notes' : 'all';
  renderJournal(); $(journalFilter === 'all' ? '#tab-all' : '#tab-notes').focus();
});
document.addEventListener('keyup', e => { if (e.key.toLowerCase() === 'r' && holdRequested) stopRecording(); });
window.addEventListener('blur', () => { if (holdRequested) stopRecording(); });
window.addEventListener('beforeunload', e => {
  save();
  if (recording || recordPending || recorderBusy) { e.preventDefault(); e.returnValue = ''; }
});
window.addEventListener('pagehide', () => { if (recording) stopRecording(); });
setInterval(() => { renderTimer(); if (recording) renderRecording(); }, 250);
render(); save();
