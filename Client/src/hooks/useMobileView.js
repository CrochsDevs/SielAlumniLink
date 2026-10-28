import { useSyncExternalStore } from 'react';

const query = '(max-width: 639px)';
const subscribe = (notify) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
const snapshot = () => window.matchMedia(query).matches;

export default function useMobileView() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
