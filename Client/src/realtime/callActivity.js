let owner = null;
export const acquireCall = next => {
  if (owner && owner !== next) return false;
  owner = next;
  return true;
};
export const releaseCall = previous => { if (owner === previous) owner = null; };
export const isCallBusy = () => owner !== null;
