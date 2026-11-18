// Presentation only. The stored life total is committed before any animation starts.
export const LIFE_ROLL_MS = 2304.036;
export function createLifeRoll(from, to, cue, startedAt, reducedMotion = false) {
  let fallbackAt = cue ? null : startedAt, progress = 0;
  return {
    sample(now) {
      let next = 0;
      if (cue?.state === 'ended' || cue?.state === 'cancelled') next = 1;
      else if (cue?.state === 'playing') {
        const duration = Number.isFinite(cue.audio.duration) && cue.audio.duration > 0 ? cue.audio.duration : LIFE_ROLL_MS / 1000;
        next = cue.audio.currentTime / duration;
      } else {
        if (cue?.state === 'failed' || (cue?.state === 'waiting' && now - startedAt > 1200)) {
          cue.cancel?.(); cue = null; fallbackAt = now;
        }
        if (!cue) next = (now - (fallbackAt ?? startedAt)) / LIFE_ROLL_MS;
      }
      // Never move backwards after buffering, clock rounding or an output failure.
      progress = Math.max(progress, Math.min(1, Math.max(0, next)));
      const distance = Math.abs(to - from);
      const steps = progress >= 1 ? distance : Math.min(Math.max(0, distance - 1), Math.floor(distance * progress));
      return { value: reducedMotion ? to : from + Math.sign(to - from) * steps, done: progress >= 1 || from === to };
    }
  };
}
