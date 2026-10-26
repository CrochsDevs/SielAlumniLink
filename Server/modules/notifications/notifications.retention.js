export const NOTIFICATION_RETENTION_MONTHS = 3;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

// Calendar months in Asia/Manila, with month-end dates clamped to the last
// valid day (e.g. November 30 -> February 28). Do not mutate createdAt.
export const notificationExpiresAt = (createdAt) => {
  const date = new Date(new Date(createdAt).getTime() + MANILA_OFFSET_MS);
  if (Number.isNaN(date.getTime())) throw new TypeError('Invalid notification creation date');
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + NOTIFICATION_RETENTION_MONTHS);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return new Date(date.getTime() - MANILA_OFFSET_MS);
};

export const ensureNotificationRetention = async (db, now = new Date()) => {
  const notifications = db.collection('notifications');
  // Backfill existing records before enabling TTL. Reading a notification
  // never changes its expiry; both read and unread records are retained alike.
  await notifications.updateMany(
    { createdAt: { $type: 'date' }, expiresAt: { $exists: false } },
    [{ $set: { expiresAt: { $dateAdd: {
      startDate: '$createdAt', unit: 'month', amount: NOTIFICATION_RETENTION_MONTHS,
      timezone: 'Asia/Manila',
    } } } }],
  );
  // Hard-delete the existing backlog immediately on startup. MongoDB then
  // continues deleting expired documents independently of the API process.
  await notifications.deleteMany({ expiresAt: { $lte: now } });
  await notifications.createIndex({ expiresAt: 1 }, {
    name: 'notifications_expiry_ttl', expireAfterSeconds: 0,
  });
  await notifications.createIndex({ recipientAuthId: 1, createdAt: -1 });
};
