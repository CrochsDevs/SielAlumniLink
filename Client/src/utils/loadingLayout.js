export function loadingLayout(pathname = '') {
  const path = pathname.replace(/\/+$/, '');
  if (/\/(message|messages|inbox)(\/|$)/.test(path)) return 'messages';
  if (/\/(accounts|settings|tracer|portfolio|employment|setup-password)(\/|$)/.test(path)) return 'form';
  if (/\/(profile|users\/[^/]+)$/.test(path)) return 'profile';
  if (/\/(events|calendar)(\/|$)/.test(path)) return 'calendar';
  if (/^\/admin\/.+/.test(path)) return 'table';
  if (path === '/community-status') return 'list';
  if (/\/(feed|stories|success)(\/|$)/.test(path)) return 'feed';
  if (/^\/(admin|student|alumni)$/.test(path)) return 'dashboard';
  return 'cards';
}
