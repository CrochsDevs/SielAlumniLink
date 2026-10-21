export const validateAudience = (audience) =>
  audience !== undefined && !['all', 'alumni'].includes(audience)
    ? 'Choose All (Alumni & Students) or Alumni only.'
    : null;

export function canViewJob(job, user) {
  if (!job || !user) return false;
  if (user.role === 'admin') return true;
  return Boolean(job.isActive && (job.audience !== 'alumni' || user.role === 'alumni'));
}
