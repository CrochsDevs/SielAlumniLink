// Share an outstanding refresh without caching its result. clear() starts a new
// lifecycle; an older completion must never clear the replacement task.
export function createPendingTask() {
  let pending;
  let epoch = 0;
  return {
    run(task) {
      if (pending) return pending;
      const started = epoch;
      const request = Promise.resolve().then(() => started === epoch ? task() : undefined).finally(() => {
        if (pending === request) pending = undefined;
      });
      pending = request;
      return request;
    },
    clear() { ++epoch; pending = undefined; },
  };
}
