import { volume, gameEffects, isVolumePull } from './volume.mjs';
import { playVolumePreview, stopVolumePreview } from './effects.mjs';

export function createVolumePanel(screen, onToggle, canPreview = () => true, onSwipe = () => {}) {
  let panel = null, previousFocus = null, gesture = null, suppressClick = false;
  const locked = new Map();
  const speaker = '<path d="M3 9h4l5-4v14l-5-4H3z"/><path class="volume-waves" d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/><path class="volume-mute" d="m16 9 6 6m0-6-6 6"/>';
  function paint() {
    if (!panel) return;
    const value = volume.get();
    panel.querySelector('output').textContent = `${value}%`;
    panel.querySelector('input').value = value;
    panel.querySelector('input').setAttribute('aria-valuetext', value ? `${value}%` : '静音');
    panel.classList.toggle('muted', value === 0);
    panel.querySelector('.volume-status').textContent = value === 0 ? '已静音' : '音效与录音回放';
    panel.querySelector('[data-volume="-1"]').disabled = value === 0;
    panel.querySelector('[data-volume="1"]').disabled = value === 100;
    const toggle = panel.querySelector('.volume-effects');
    toggle.setAttribute('aria-checked', String(gameEffects.get()));
    toggle.querySelector('span').textContent = gameEffects.get() ? '开启' : '关闭';
  }
  function sync() {
    if (!panel) return;
    for (const child of screen.children) if (child !== panel) {
      if (!locked.has(child)) locked.set(child, child.inert);
      child.inert = true;
    }
    if (!panel.isConnected) screen.append(panel);
  }
  function open() {
    if (panel) return;
    previousFocus = document.activeElement;
    panel = document.createElement('section');
    panel.className = 'volume-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', '音量调节');
    panel.innerHTML = `<button class="volume-back" aria-label="返回原界面"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg></button><svg class="volume-speaker" viewBox="0 0 24 24" aria-hidden="true">${speaker}</svg><output aria-live="polite"></output><p class="volume-status"></p><div class="volume-controls"><button data-volume="-1" aria-label="减小音量">−</button><input type="range" min="0" max="100" step="5" aria-label="音量"><button data-volume="1" aria-label="增大音量">+</button></div><p class="volume-help">${canPreview()?'调节时自动试听':'录音中，暂不试听'}</p><button class="volume-effects" role="switch" aria-label="对局音效" aria-checked="true">对局音效<span></span></button><button class="volume-confirm">确认</button>`;
    panel.querySelector('input').addEventListener('input', e => { volume.set(e.target.value); paint(); audition(); });
    panel.querySelector('input').addEventListener('change', () => audition(true));
    panel.addEventListener('click', e => {
      e.stopPropagation();
      const button = e.target.closest('button');
      if (!button) return;
      if (button.dataset.volume) adjust(Number(button.dataset.volume));
      else if (button.classList.contains('volume-effects')) { gameEffects.set(!gameEffects.get()); paint(); }
      else close();
    });
    paint(); sync(); onToggle(true);
    panel.querySelector('.volume-confirm').focus({ preventScroll: true });
  }
  function close() {
    if (!panel) return;
    stopVolumePreview();
    panel.remove(); panel = null;
    for (const [node, inert] of locked) if (node.isConnected) node.inert = inert;
    locked.clear(); onToggle(false);
    if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus({ preventScroll: true });
  }
  function audition(force = false) { if (canPreview()) playVolumePreview(force); }
  function adjust(direction) { volume.set(volume.get() + direction * 5); paint(); audition(true); }
  screen.addEventListener('pointerdown', e => {
    suppressClick = false;
    if (panel || !e.isPrimary || e.button !== 0 || e.target.closest('input,textarea,select')) return;
    let scroll = e.target;
    while (scroll && scroll !== screen && !(scroll.scrollHeight > scroll.clientHeight && /auto|scroll/.test(getComputedStyle(scroll).overflowY))) scroll = scroll.parentElement;
    gesture = { id:e.pointerId, x:e.clientX, y:e.clientY, lastY:e.clientY, scale:screen.getBoundingClientRect().height / 320, scroll:scroll === screen ? null : scroll };
  }, true);
  screen.addEventListener('pointermove', e => {
    if (!gesture || gesture.id !== e.pointerId) return;
    const dx = (e.clientX - gesture.x) / gesture.scale, dy = (e.clientY - gesture.y) / gesture.scale;
    gesture.dx=dx; gesture.dy=dy;
    if (Math.hypot(dx, dy) > 8) suppressClick = true;
    if (dy < -8 && gesture.scroll) gesture.scroll.scrollTop -= (e.clientY - gesture.lastY) / gesture.scale;
    gesture.lastY = e.clientY;
    gesture.pull = isVolumePull(dx, dy);
    if (suppressClick) {
      e.preventDefault();
      if (!screen.hasPointerCapture(e.pointerId)) screen.setPointerCapture(e.pointerId);
    }
  }, { capture:true, passive:false });
  screen.addEventListener('pointerup', e => {
    if (!gesture || gesture.id !== e.pointerId) return;
    const {pull,dx=0,dy=0} = gesture;
    gesture = null;
    if (pull) { e.preventDefault(); open(); }
    else onSwipe(dx,dy);
  }, true);
  screen.addEventListener('pointercancel', () => { gesture = null; }, true);
  screen.addEventListener('click', e => {
    if (suppressClick && e.detail !== 0) { e.preventDefault(); e.stopImmediatePropagation(); suppressClick = false; }
  }, true);
  return { get isOpen() { return !!panel; }, open, close, adjust, sync };
}
