// Theme: 'light' | 'dark' | 'system' (persisted in localStorage).
// 'system' follows the OS preference and updates live.
const KEY = 'theme';
let mediaQuery = null;
let mediaHandler = null;

const systemDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

export const getTheme = () => {
  try {
    return localStorage.getItem(KEY) || 'system';
  } catch {
    return 'system';
  }
};

export const isDarkActive = () => {
  const theme = getTheme();
  return theme === 'dark' || (theme === 'system' && systemDark());
};

export const applyTheme = () => {
  document.documentElement.classList.toggle('dark', isDarkActive());
};

const stopSystemListener = () => {
  if (mediaQuery && mediaHandler) {
    mediaQuery.removeEventListener('change', mediaHandler);
    mediaQuery = null;
    mediaHandler = null;
  }
};

export const setTheme = (theme) => {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // ignore
  }
  stopSystemListener();
  if (theme === 'system' && typeof window !== 'undefined') {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaHandler = () => applyTheme();
    mediaQuery.addEventListener('change', mediaHandler);
  }
  applyTheme();
};

// Call once at startup (main.jsx) so listeners attach for 'system'.
export const initTheme = () => {
  setTheme(getTheme());
};
