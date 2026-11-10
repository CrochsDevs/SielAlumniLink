// A short, locally synthesized chime; no audio downloads are needed.
export function createMeetingJoinSound({
  createContext = () => new (window.AudioContext || window.webkitAudioContext)(),
} = {}) {
  let context;
  const voices = new Set();
  const stop = () => {
    for (const { oscillator, gain } of voices) {
      oscillator.onended = null;
      try { oscillator.stop(); } catch { /* Already stopped. */ }
      oscillator.disconnect();
      gain.disconnect();
    }
    voices.clear();
  };
  return {
    // Called directly from the Join button gesture to allow later notifications.
    unlock() {
      try {
        context ||= createContext();
        if (context.state === 'suspended') void context.resume().catch(() => {});
      } catch { /* Meeting access does not depend on audio availability. */ }
    },
    play() {
      if (context?.state !== 'running') return;
      try {
        for (const [frequency, delay] of [[660, 0], [880, 0.16]]) {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          const start = context.currentTime + delay;
          oscillator.type = 'sine';
          oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.07, start + 0.015);
          gain.gain.linearRampToValueAtTime(0, start + 0.2);
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
          oscillator.stop(start + 0.21);
        }
      } catch { stop(); }
    },
    stop,
    destroy() {
      stop();
      if (context && context.state !== 'closed') void context.close().catch(() => {});
      context = null;
    },
  };
}
