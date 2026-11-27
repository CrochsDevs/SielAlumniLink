import { createHash } from 'node:crypto';
import { EMPLOYMENT_STATUSES, isWorking } from './employment.policy.js';

const timestamp = value => value ? new Date(value).getTime() || 0 : 0;
const month = value => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 7) : '';
};

// Keep survey observations intact. Use the newer employment observation when
// reading a profile; subsequent employment edits persist the combined history.
export function withTracerEmployment(profile, tracer) {
  if (!profile || !EMPLOYMENT_STATUSES.includes(tracer?.status)) return profile;
  const observedAt = tracer.updatedAt || tracer.respondedAt;
  const tracerTime = timestamp(observedAt);
  const profileTime = timestamp(profile.employmentUpdatedAt);
  if (profileTime && profileTime >= tracerTime) return profile;
  // Undated legacy surveys may fill an empty record but cannot replace known work.
  if (!tracerTime && (profile.employmentStatus || profile.employmentHistory?.length)) return profile;

  const working = isWorking(tracer.status);
  const history = (profile.employmentHistory || []).filter(job => job && typeof job === 'object').map(job => ({ ...job }));
  const current = working ? history.find(job => job.current && job.company === tracer.company && (job.position || job.role) === tracer.position) : null;
  const startDate = month(tracer.employmentDate);
  for (const job of history) {
    if (!job.current || job === current) continue;
    job.current = false;
    // A survey can omit the start month. Never invent a start date or an
    // end date before a previously recorded role started.
    const endDate = startDate || month(observedAt);
    job.endDate = endDate >= String(job.startDate || '').slice(0, 7) ? endDate : '';
  }
  if (working) {
    if (current) {
      if (startDate) current.startDate = startDate;
      if (tracer.location) current.location = tracer.location;
    } else {
      history.push({
        _id: `tracer-${createHash('sha256').update(JSON.stringify([String(tracer.authId || profile.authId || ''), observedAt, tracer.company, tracer.position])).digest('hex').slice(0, 24)}`,
        company: tracer.company || '', position: tracer.position || '',
        industry: '', location: tracer.location || '', startDate, endDate: '',
        current: true, source: 'tracer',
      });
    }
  }
  return { ...profile, employmentStatus: tracer.status, employmentHistory: history, employmentUpdatedAt: observedAt || null };
}

export const latestEmploymentTracer = [
  { $lookup: {
    from: 'tracer_responses', let: { account: { $toString: '$authId' } },
    pipeline: [
      { $match: { $expr: { $eq: [{ $convert: { input: '$authId', to: 'string', onError: null, onNull: null } }, '$$account'] } } },
      { $sort: { updatedAt: -1, respondedAt: -1, _id: -1 } }, { $limit: 1 },
      { $project: { authId: 1, status: 1, company: 1, position: 1, location: 1, employmentDate: 1, updatedAt: 1, respondedAt: 1 } },
    ], as: '_employmentTracer',
  } },
];
