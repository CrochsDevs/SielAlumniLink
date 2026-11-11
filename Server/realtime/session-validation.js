// Coalesce concurrent packet/timer checks, but always read the account again
// after a check settles. This is not a session cache or a revocation grace period.
export function sessionValidation(check) {
  let pending;
  return () => {
    if (pending) return pending;
    const request = Promise.resolve().then(check).finally(() => {
      if (pending === request) pending = undefined;
    });
    pending = request;
    return request;
  };
}
