// Today's chats show HH:mm; older chats show their age in days or weeks.
export const formatTime = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  // Compare local calendar dates so yesterday counts as 1d even near midnight.
  const calendarDay = (value) => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  const days = Math.floor((calendarDay(now) - calendarDay(date)) / 86400000);
  if (days >= 7) return `${Math.floor(days / 7)}w`;
  if (days >= 1) return `${days}d`;
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
