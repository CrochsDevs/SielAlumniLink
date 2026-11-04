const invalid = message => { throw Object.assign(new Error(message), { status: 400 }); };

export function validateTracerPeriod(filters = {}) {
  const year = filters.year ?? 'all', quarter = filters.quarter ?? 'all';
  if (typeof year !== 'string' || (year !== 'all' && (!/^\d{4}$/.test(year) || Number(year) < 1900))) invalid('Choose a valid tracing year');
  if (typeof quarter !== 'string' || !['all', '1', '2', '3', '4'].includes(quarter)) invalid('Choose a valid tracing quarter');
  return { year, quarter };
}

export function tracerPeriod(value) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return null;
  const local = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return { year: local.getUTCFullYear(), quarter: Math.floor(local.getUTCMonth() / 3) + 1 };
}

const fields = ['batch', 'program', 'status', 'company', 'position', 'salaryRange', 'employmentDate',
  'location', 'jobAlignment', 'alignmentExplanation'];

export function buildTracerPeriodReport(documents, filters = {}) {
  const { year, quarter } = validateTracerPeriod(filters);
  const years = new Set(), latest = new Map();
  for (const document of documents) {
    const history = Array.isArray(document.responseHistory) ? document.responseHistory.filter(row => row && typeof row === 'object') : [];
    const observations = [...history, { ...document, recordedAt: document.updatedAt || document.respondedAt }];
    for (const snapshot of observations) {
      const recordedAt = snapshot.recordedAt || snapshot.updatedAt || snapshot.respondedAt || null;
      const period = tracerPeriod(recordedAt);
      if (period) years.add(period.year);
      if (year !== 'all' && String(period?.year) !== year) continue;
      if (quarter !== 'all' && String(period?.quarter) !== quarter) continue;
      const time = period ? new Date(recordedAt).getTime() : -Infinity;
      const key = String(document.authId), previous = latest.get(key);
      if (previous && (previous.time > time || (previous.time === time && String(previous.row._id) > String(document._id)))) continue;
      const row = Object.fromEntries(fields.map(field => [field, snapshot[field] ?? (['batch', 'program'].includes(field) ? document[field] : '') ?? '']));
      latest.set(key, { time, row: {
        ...row, _id: document._id, authId: document.authId, email: snapshot.email || document.email || '',
        name: typeof document._tracerName === 'string' ? document._tracerName : '',
        profilePicture: typeof document._tracerPicture === 'string' ? document._tracerPicture : null,
        respondedAt: document.respondedAt || recordedAt, updatedAt: recordedAt,
        tracingYear: period?.year ?? null, tracingQuarter: period?.quarter ?? null,
      } });
    }
  }
  return { responses: [...latest.values()].sort((a, b) => (b.time - a.time) || String(b.row._id).localeCompare(String(a.row._id))).map(value => value.row),
    periods: { year, quarter, years: [...years].sort((a, b) => b - a), timezone: 'Asia/Manila' } };
}
