export const MENTORSHIP_GOALS = [
  { key: 'resume_building', title: 'Resume Building', description: 'Build and refine a resume that presents your skills and experience.' },
  { key: 'interview_preparation', title: 'Interview Preparation', description: 'Practice answers, prepare examples, and build interview confidence.' },
  { key: 'career_planning', title: 'Career Planning', description: 'Explore career paths and agree on practical next steps.' },
];
export const GOAL_STATUSES = ['not_started', 'in_progress', 'completed'];
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };

export function resumeChecklist(profile = {}, portfolio = {}) {
  profile ||= {};
  portfolio ||= {};
  const filled = value => typeof value === 'string' && !!value.trim();
  const contact = [profile.contactEmail, profile.contactNumber, profile.location].some(filled);
  const links = Array.isArray(profile.profileLinks)
    ? profile.profileLinks.some(link => filled(link?.url))
    : [profile.portfolioWebsite, profile.website, profile.github, profile.linkedin].some(filled);
  const sections = [
    { key: 'about', label: 'About', filled: filled(profile.bio), recordedAt: profile.updatedAt || null },
    { key: 'contact', label: 'Contact & links', filled: contact || links, recordedAt: profile.updatedAt || null },
    ...[['skills', 'Skills'], ['projects', 'Projects'], ['research', 'Research Papers'], ['certifications', 'Certifications'], ['seminars', 'Seminars Attended'], ['awards', 'Awards']].map(([key, label]) => {
      const values = portfolio[key] ?? profile[key];
      return { key, label, filled: Array.isArray(values) && values.some(entry => filled(entry) || filled(entry?.title)), recordedAt: portfolio[key] !== undefined ? portfolio.updatedAt || null : profile.updatedAt || null };
    }),
  ];
  return sections.map(section => ({ ...section, recordedAt: section.filled ? section.recordedAt : null }));
}

export function validateGoal(key, input) {
  if (!MENTORSHIP_GOALS.some(goal => goal.key === key)) fail('Unknown mentorship goal');
  if (!input || !GOAL_STATUSES.includes(input.status)) fail('Choose Not Started, In Progress, or Completed');
  if (!Number.isInteger(input.revision) || input.revision < 0) fail('Refresh the goal before updating its progress');
  if (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > 1000)) fail('Progress note must be text of up to 1000 characters');
  return { status: input.status, ...(input.note !== undefined ? { note: input.note.trim() } : {}), revision: input.revision };
}

export function goalSnapshot(records = [], activities = {}) {
  const goals = MENTORSHIP_GOALS.map(goal => {
    const record = records.find(item => item.goalKey === goal.key);
    const activitySources = [...(activities[goal.key] || [])];
    if (record?.note?.trim()) activitySources.push({
      label: goal.key === 'interview_preparation' ? 'Practice activity recorded in this mentorship' : 'Activity note saved in this mentorship',
      recordedAt: record.updatedAt || null,
    });
    const mentorConfirmed = record?.status === 'completed' && !!(record.confirmedByAuthId || record.updatedByRole === 'alumni');
    let status = record?.status || 'not_started';
    if (status === 'completed' && !mentorConfirmed) status = 'in_progress';
    if (status === 'not_started' && activitySources.length) status = 'in_progress';
    return { ...goal, status, activitySources, mentorConfirmed,
      note: record?.note || '', revision: record?.revision || 0,
      updatedAt: record?.updatedAt || null, updatedByName: record?.updatedByName || '', updatedByRole: record?.updatedByRole || '',
      startedAt: record?.startedAt || activitySources.find(source => source.recordedAt)?.recordedAt || null,
      completedAt: mentorConfirmed ? record?.completedAt || null : null };
  });
  const completed = goals.filter(goal => goal.status === 'completed').length;
  return { goals, summary: { total: goals.length, completed, inProgress: goals.filter(goal => goal.status === 'in_progress').length,
    notStarted: goals.filter(goal => goal.status === 'not_started').length, percent: Math.round(completed / goals.length * 100) } };
}
