export function notificationTime(iso) {
  if (!iso) return '';
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d` : `${Math.floor(days / 7)}w`;
}

export function notificationText(item) {
  const name = item.actor?.name;
  if (!name) return { lead: item.kind?.startsWith('connection_') ? item.body || item.title : item.title, text: '', detail: item.kind?.startsWith('connection_') ? '' : item.body };
  if (item.kind === 'connection_request') return { lead: name, text: ' wants to connect with you.' };
  if (item.kind === 'connection_response') return { lead: name, text: item.title?.toLowerCase().includes('declined') ? ' declined your connection request.' : ' accepted your connection request.' };
  const actions = { jobs: ' shared a job: ', events: ' shared an event: ', announcements: ' posted an announcement: ' };
  return { lead: name, text: `${actions[item.kind] || ': '}${item.title || ''}`, detail: item.body };
}
