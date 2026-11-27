export const INTERVIEW_QUESTIONS = [
  { id: 'introduction', question: 'Tell me about yourself.', hint: 'Connect your education, relevant experience, and the role you want.' },
  { id: 'motivation', question: 'Why are you interested in this role?', hint: 'Explain what interests you and how your skills match the work.' },
  { id: 'strength', question: 'What strength would you bring to our team?', hint: 'Give a specific example that demonstrates your strength.' },
  { id: 'challenge', question: 'Tell me about a challenge you overcame.', hint: 'Use STAR: Situation, Task, Action, Result.' },
  { id: 'teamwork', question: 'Describe a time you worked with others to reach a goal.', hint: 'Explain your contribution, how you communicated, and the outcome.' },
  { id: 'growth', question: 'What skill are you currently working to improve?', hint: 'Describe the steps you are taking and how you measure progress.' },
];
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const entries = (value, required, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !INTERVIEW_QUESTIONS.some(q => q.id === key))) fail(400, `Invalid ${label}`);
  return Object.fromEntries(INTERVIEW_QUESTIONS.map(({ id }) => {
    const text = value[id] ?? '';
    if (typeof text !== 'string' || text.length > 3000 || (required && !text.trim())) fail(400, `${label} must contain ${required ? 'a response for every question and ' : ''}at most 3,000 characters per question`);
    return [id, text.trim()];
  }));
};

export function interviewView(record, isStudent) {
  const work = record?.interview;
  return { questions: INTERVIEW_QUESTIONS, state: work?.state || 'not_started',
    ...(isStudent ? { draft: work?.draft || {} } : {}),
    submission: work?.submission || null, feedback: work?.feedback || {},
    reviewedAt: work?.reviewedAt || null, reviewedBy: work?.reviewedBy || '',
  };
}

export function changeInterview(current, input, isStudent, actorId, now = new Date()) {
  if (!input || !Number.isInteger(input.revision) || input.revision < 0) fail(400, 'Refresh the interview before saving.');
  if (input.revision !== (current?.revision || 0)) fail(409, 'Interview practice changed. Reload the latest version before saving.');
  const work = current?.interview || {};
  const interview = { ...work };
  if (['draft', 'submit'].includes(input.action)) {
    if (!isStudent) fail(403, 'Only the student can save or submit answers.');
    if (['submitted', 'completed'].includes(work.state)) fail(409, 'Your mentor must request revisions before you can edit these answers.');
    interview.draft = entries(input.answers, input.action === 'submit', 'Answers');
    interview.state = input.action === 'submit' ? 'submitted' : work.state === 'revision_requested' ? 'revision_requested' : 'draft';
    if (input.action === 'submit') {
      interview.submission = { answers: interview.draft, questions: INTERVIEW_QUESTIONS, submittedAt: now, version: (work.submission?.version || 0) + 1 };
      interview.feedback = {};
      interview.reviewedAt = null;
      interview.reviewedBy = '';
    }
  } else if (['request_revision', 'complete'].includes(input.action)) {
    if (isStudent) fail(403, 'Only the connected mentor can review answers.');
    if (!(work.state === 'submitted' || (work.state === 'completed' && input.action === 'request_revision'))) fail(409, 'There is no submitted interview awaiting this review.');
    interview.feedback = entries(input.feedback, true, 'Feedback');
    interview.state = input.action === 'complete' ? 'completed' : 'revision_requested';
    interview.reviewedAt = now;
    interview.reviewedBy = actorId;
  } else fail(400, 'Unknown interview action.');
  const complete = interview.state === 'completed';
  return { interview, status: complete ? 'completed' : 'in_progress', startedAt: current?.startedAt || now,
    completedAt: complete ? now : null, confirmedByAuthId: complete ? actorId : null };
}
