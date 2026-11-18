// Device output level is separate from match data and microphone capture gain.
export const VOLUME_KEY = 'paiju-volume-v1';
export const GAME_EFFECTS_KEY = 'paiju-game-effects-v1';
export function createGameEffects(storage) {
  let enabled = true;
  try { enabled = storage?.getItem(GAME_EFFECTS_KEY) !== 'off'; } catch {}
  const listeners = new Set();
  return {
    get: () => enabled,
    set(next) {
      enabled = !!next;
      try { storage?.setItem(GAME_EFFECTS_KEY, enabled ? 'on' : 'off'); } catch {}
      for (const listener of listeners) listener(enabled);
      return enabled;
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  };
}
export function clampVolume(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 100;
}
export function createVolume(storage) {
  let value = 100;
  try { const saved = storage?.getItem(VOLUME_KEY); if (saved !== null && saved !== undefined) value = clampVolume(saved); } catch {}
  const listeners = new Set();
  return {
    get: () => value,
    set(next) {
      value = clampVolume(next);
      try { storage?.setItem(VOLUME_KEY, String(value)); } catch {}
      for (const listener of listeners) listener(value / 100);
      return value;
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  };
}
let storage;
try { storage = globalThis.localStorage; } catch {}
export const volume = createVolume(storage);
export const gameEffects = createGameEffects(storage);
export function isVolumePull(dx, dy) { return dy >= 32 && dy > Math.abs(dx) * 1.4; }
