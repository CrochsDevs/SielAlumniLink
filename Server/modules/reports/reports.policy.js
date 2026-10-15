export const TIMEZONE = 'Asia/Manila';
export const SOURCES = [
  { key: 'logins', label: 'Logins', collection: 'activity_logs', actor: 'authId', date: 'createdAt', filter: { action: 'login' } },
  { key: 'posts', label: 'Community posts', collection: 'feed_posts', actor: 'authorAuthId', date: 'createdAt', filter: { deletedAt: null, 'moderation.blocked': { $ne: true } } },
  { key: 'comments', label: 'Comments', collection: 'feed_comments', actor: 'authorAuthId', date: 'createdAt', filter: { deletedAt: null } },
  { key: 'jobApplications', label: 'Job applications', collection: 'job_applications', actor: 'applicantAuthId', date: 'createdAt' },
  { key: 'referralApplications', label: 'Referral applications', collection: 'referral_applications', actor: 'applicantAuthId', date: 'createdAt' },
  { key: 'registrations', label: 'Event registrations', collection: 'event_registrations', actor: 'authId', date: 'registeredAt' },
  { key: 'surveys', label: 'Survey submissions', collection: 'survey_responses', actor: 'authId', date: 'createdAt' },
];
export const manilaDate = now => new Date(new Date(now).getTime() + 8 * 3600000).toISOString().slice(0, 10);
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
export const requireAdmin = user => { if (String(user?.role).toLowerCase() !== 'admin') fail(403, 'Only administrators can view dashboard reports.'); };

export function reportPeriod(value, now = new Date()) {
  const date = value === undefined ? manilaDate(now) : value;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '2000-01-01' || date > manilaDate(now)) fail(400, 'Choose a valid report date from 2000 through today.');
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) fail(400, 'Choose a valid calendar date.');
  const year = parsed.getUTCFullYear(), month = parsed.getUTCMonth() + 1;
  const start = new Date(`${year}-01-01T00:00:00+08:00`);
  const end = new Date(Math.min(new Date(`${year + 1}-01-01T00:00:00+08:00`).getTime(), new Date(now).getTime() + 1));
  return { date, year, month, monthKey: date.slice(0, 7), days: new Date(Date.UTC(year, month, 0)).getUTCDate(), start, end };
}

export function summarizeEngagement(rows, period) {
  const make = (key, label) => ({ key, label, total: 0, actors: new Set(), counts: Object.fromEntries(SOURCES.map(source => [source.key, 0])) });
  const daily = Array.from({ length: 24 }, (_, hour) => make(`${period.date}T${String(hour).padStart(2, '0')}`, `${String(hour).padStart(2, '0')}:00`));
  const monthly = Array.from({ length: period.days }, (_, day) => make(`${period.monthKey}-${String(day + 1).padStart(2, '0')}`, String(day + 1)));
  const yearly = Array.from({ length: 12 }, (_, month) => make(`${period.year}-${String(month + 1).padStart(2, '0')}`, new Date(Date.UTC(period.year, month, 1)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })));
  const reports = { daily: { ...make(period.date, period.date), buckets: daily }, monthly: { ...make(period.monthKey, period.monthKey), buckets: monthly }, yearly: { ...make(String(period.year), String(period.year)), buckets: yearly } };
  const lookup = Object.fromEntries(Object.entries(reports).map(([key, report]) => [key, new Map(report.buckets.map(bucket => [bucket.key, bucket]))]));
  const add = (target, row) => {
    target.total += row.count;
    target.counts[row.source] += row.count;
    for (const actor of row.actors || []) target.actors.add(String(actor));
  };
  for (const row of rows) {
    if (!SOURCES.some(source => source.key === row.source) || !Number.isFinite(row.count) || row.count < 0 || typeof row.hour !== 'string') continue;
    for (const [key, length] of [['daily', 13], ['monthly', 10], ['yearly', 7]]) {
      const bucket = lookup[key].get(row.hour.slice(0, length));
      if (bucket) { add(bucket, row); add(reports[key], row); }
    }
  }
  const present = ({ actors, counts, ...data }) => ({ ...data, activeMembers: actors.size, breakdown: SOURCES.map(source => ({ key: source.key, label: source.label, count: counts[source.key] })) });
  return Object.fromEntries(Object.entries(reports).map(([key, report]) => [key, { ...present(report), buckets: report.buckets.map(present) }]));
}

export function summarizeMentorship(rows) {
  const counts = { accepted: 0, pending: 0, rejected: 0 };
  for (const row of rows) {
    const key = row._id === 'declined' ? 'rejected' : row._id;
    if (Object.hasOwn(counts, key)) counts[key] += row.count;
  }
  return { ...counts, total: counts.accepted + counts.pending + counts.rejected };
}
