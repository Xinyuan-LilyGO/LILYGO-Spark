/**
 * Play a short success chime when flash completes.
 * Uses Web Audio API - no external audio files needed.
 */
export function playFlashSuccessSound(): void {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;

    // Resume if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Two-tone success chime (ascending)
    const playTone = (freq: number, start: number, duration: number, gain = 0.15) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(gain, now + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
      osc.start(now + start);
      osc.stop(now + start + duration);
    };

    playTone(523.25, 0, 0.15);      // C5
    playTone(659.25, 0.12, 0.2);    // E5
    playTone(783.99, 0.28, 0.35);   // G5 - sustained
  } catch (_) {
    // Audio not supported or user interaction required
  }
}
