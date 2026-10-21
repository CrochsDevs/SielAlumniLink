export const isDeadlinePassed = (job, now = Date.now()) =>
  Boolean(job?.applicationDeadline && new Date(job.applicationDeadline).getTime() <= now);

export function validateDeadline(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) {
    return 'Choose a valid application deadline.';
  }
  return null;
}
