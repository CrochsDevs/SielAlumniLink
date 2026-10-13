import { fail, text } from './development.policy.js';

export const COMPETENCY_FRAMEWORK = [
  { key: 'technical', name: 'Technical Skills', category: 'technical', description: 'Apply the tools, methods, and knowledge needed in your field of study.', prompt: 'Describe a project, technical task, or training where you applied your skills.', action: 'Practice a field-specific task and document the result in your portfolio.' },
  { key: 'communication', name: 'Communication Skills', category: 'communication', description: 'Explain ideas clearly, listen actively, and adapt your message to an audience.', prompt: 'Think of a presentation, report, or conversation where you explained an idea clearly.', action: 'Practice presenting a project and ask your mentor for feedback.' },
  { key: 'leadership', name: 'Leadership Skills', category: 'leadership', description: 'Take initiative, support others, and help a group move toward a goal.', prompt: 'Describe an activity you initiated or a time you supported someone else.', action: 'Coordinate a task or lead a small activity and reflect on the outcome.' },
];

export function validateCompetency(key, input = {}) {
  if (!COMPETENCY_FRAMEWORK.some(item => item.key === key)) fail(400, 'Unknown competency');
  const { rating, target } = input;
  if (!Number.isInteger(rating) || rating < 1 || rating > 4) fail(400, 'Choose a skill level from 1 to 4');
  if (!Number.isInteger(target) || target < rating || target > 4) fail(400, 'Your target must be between your current level and level 4');
  return { rating, target, evidence: text(input.evidence, 'Evidence note', 2000), goal: text(input.goal, 'Learning goal', 1000) };
}

export function validateMentorEvaluation(key, input = {}) {
  if (!COMPETENCY_FRAMEWORK.some(item => item.key === key)) fail(400, 'Unknown competency');
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 4) fail(400, 'Choose a skill level from 1 to 4');
  return { rating: input.rating, feedback: text(input.feedback, 'Mentor feedback', 2000, true) };
}

export function competencySnapshot(record, evaluations = []) {
  const assessments = COMPETENCY_FRAMEWORK.flatMap(item => {
    const saved = record?.assessments?.[item.key];
    return saved ? [{ key: item.key, ...saved }] : [];
  });
  const mentorEvaluations = evaluations.filter(item => COMPETENCY_FRAMEWORK.some(skill => skill.key === item.competencyKey)).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const gaps = COMPETENCY_FRAMEWORK.map(item => {
    const self = assessments.find(assessment => assessment.key === item.key);
    const mentor = mentorEvaluations.find(evaluation => evaluation.competencyKey === item.key);
    const currentLevel = mentor?.rating ?? self?.rating ?? null;
    const target = self?.target ?? 3;
    return { key: item.key, currentLevel, target, gap: currentLevel === null ? null : Math.max(0, target - currentLevel), basis: mentor ? 'mentor' : self ? 'self' : 'unassessed' };
  });
  return {
    mentorEvaluations,
    gaps,
    framework: COMPETENCY_FRAMEWORK,
    assessments,
    assessedCount: assessments.length,
    averageLevel: assessments.length ? Math.round(assessments.reduce((sum, item) => sum + item.rating, 0) / assessments.length * 10) / 10 : null,
    strengthCount: assessments.filter(item => item.rating >= 3).length,
    focusCount: gaps.filter(item => item.gap > 0).length,
    updatedAt: record?.updatedAt || null,
  };
}
