export function createRingingTimeout({ onExpire, now = Date.now, schedule = setTimeout, cancel = clearTimeout }) {
  let timer;
  let generation = 0;
  const stop = () => {
    generation += 1;
    if (timer !== undefined) cancel(timer);
    timer = undefined;
  };
  return {
    stop,
    start(callId, peerAuthId, expiresAt = now() + 30000) {
      stop();
      const current = generation;
      timer = schedule(() => {
        if (current !== generation) return;
        stop();
        onExpire(callId, peerAuthId);
      }, Math.min(30000, Math.max(0, expiresAt - now())));
    },
  };
}
