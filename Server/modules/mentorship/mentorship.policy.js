export const MENTORSHIP_GOALS = [
  { key: 'resume_building', title: 'Resume Building', description: 'Build and refine a resume that presents your skills and experience.' },
  { key: 'interview_preparation', title: 'Interview Preparation', description: 'Practice answers, prepare examples, and build interview confidence.' },
  { key: 'career_planning', title: 'Career Planning', description: 'Explore career paths and agree on practical next steps.' },
];
export const GOAL_STATUSES = ['not_started', 'in_progress', 'completed'];
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };

export function validateGoal(key, input) {
  if (!MENTORSHIP_GOALS.some(goal => goal.key === key)) fail('Unknown mentorship goal');
  if (!input || !GOAL_STATUSES.includes(input.status)) fail('Choose Not Started, In Progress, or Completed');
  if (!Number.isInteger(input.revision) || input.revision < 0) fail('Refresh the goal before updating its progress');
  if (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > 1000)) fail('Progress note must be text of up to 1000 characters');
  return { status: input.status, ...(input.note !== undefined ? { note: input.note.trim() } : {}), revision: input.revision };
}

export function goalSnapshot(records = []) {
  const goals = MENTORSHIP_GOALS.map(goal => {
    const record = records.find(item => item.goalKey === goal.key);
    return { ...goal, status: record?.status || 'not_started', note: record?.note || '', revision: record?.revision || 0,
      updatedAt: record?.updatedAt || null, updatedByName: record?.updatedByName || '', updatedByRole: record?.updatedByRole || '',
      startedAt: record?.startedAt || null, completedAt: record?.completedAt || null };
  });
  const completed = goals.filter(goal => goal.status === 'completed').length;
  return { goals, summary: { total: goals.length, completed, inProgress: goals.filter(goal => goal.status === 'in_progress').length,
    notStarted: goals.filter(goal => goal.status === 'not_started').length, percent: Math.round(completed / goals.length * 100) } };
}
