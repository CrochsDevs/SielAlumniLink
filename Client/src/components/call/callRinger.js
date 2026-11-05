// Original synthesized tones; no downloaded audio or network requests needed.
export function createCallRinger({
  createContext = () => new (window.AudioContext || window.webkitAudioContext)(),
  repeat = setInterval,
  cancelRepeat = clearInterval,
} = {}) {
  let context;
  let mode;
  let timer;
  let disposed = false;
  let lastPulse = -Infinity;
  const voices = new Set();

  const pulse = () => {
    if (!mode || !context || context.state !== 'running' || context.currentTime - lastPulse < 1) return;
    lastPulse = context.currentTime;
    const tone = (frequency, offset, duration, volume) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + offset;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.02);
      gain.gain.setValueAtTime(volume, start + duration - 0.04);
      gain.gain.linearRampToValueAtTime(0, start + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      const voice = { oscillator, gain };
      voices.add(voice);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        voices.delete(voice);
      };
      oscillator.start(start);
      oscillator.stop(start + duration);
    };
    if (mode === 'incoming') {
      for (const offset of [0, 0.65]) {
        tone(660, offset, 0.18, 0.1);
        tone(880, offset + 0.2, 0.25, 0.1);
      }
    } else {
      tone(440, 0, 1.1, 0.045);
      tone(480, 0, 1.1, 0.045);
    }
  };

  const unlock = () => {
    if (disposed) return;
    try {
      context ||= createContext();
      if (context.state === 'suspended') {
        void context.resume().then(pulse).catch(() => {});
      } else {
        pulse();
      }
    } catch { /* Calling still works when audio is unavailable. */ }
  };

  const stop = () => {
    mode = null;
    lastPulse = -Infinity;
    if (timer !== undefined) cancelRepeat(timer);
    timer = undefined;
    for (const { oscillator, gain } of voices) {
      try { oscillator.stop(); } catch { /* Already ended. */ }
      oscillator.disconnect();
      gain.disconnect();
    }
    voices.clear();
  };

  return {
    unlock,
    stop,
    start(nextMode) {
      stop();
      if (!nextMode || disposed) return;
      mode = nextMode;
      unlock();
      timer = repeat(pulse, 3000);
    },
    destroy() {
      disposed = true;
      stop();
      if (context && context.state !== 'closed') void context.close().catch(() => {});
    },
  };
}
