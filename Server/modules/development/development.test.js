import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateReadiness, pastDate, validateInternship, validatePortfolio } from './development.policy.js';

test('readiness starts at zero and exposes the five scoring factors', () => {
  const result = calculateReadiness({});
  assert.equal(result.score, 0); assert.equal(result.level, 'Getting Started');
  assert.equal(result.factors.length, 5); assert.equal(result.factors.reduce((sum, factor) => sum + factor.maxPoints, 0), 100);
});
test('readiness uses recorded progress and can produce the requested 82/100 example', () => {
  const portfolio = { skills: ['SQL'], certifications: ['A', 'B'], seminars: ['Career seminar'], projects: [{ title: 'Project' }], research: [{ title: 'Research' }], awards: [] };
  const result = calculateReadiness({ mentorCount: 1, eventCount: 2, portfolio, internships: [{ requiredHours: 100, hoursCompleted: 95 }] });
  assert.equal(result.score, 82); assert.equal(result.level, 'Highly Prepared');
  assert.deepEqual(result.factors.map(factor => factor.points), [20, 13, 13, 17, 19]);
});
test('readiness is capped at 100 and extra records never inflate completed factors', () => {
  const portfolio = Object.fromEntries(['skills', 'certifications', 'seminars', 'projects', 'research', 'awards'].map(key => [key, ['A', 'B', 'C', 'D']]));
  const result = calculateReadiness({ mentorCount: 20, eventCount: 50, portfolio, internships: [{ hoursCompleted: 100, requiredHours: 100 }, { hoursCompleted: 100, requiredHours: 100 }] });
  assert.equal(result.score, 100); assert.equal(result.level, 'Highly Prepared');
});
test('internship validation prevents invented completion, invalid dates, and missing supervisors', () => {
  const valid = { company: 'Campus', supervisor: 'Supervisor', hoursCompleted: 0, requiredHours: 486, startDate: '2025-01-01' };
  assert.equal(validateInternship(valid).completed, false);
  assert.equal(validateInternship({ ...valid, hoursCompleted: 486 }).completed, true);
  for (const changes of [{ supervisor: '' }, { company: ' ' }, { requiredHours: 0 }, { requiredHours: Infinity }, { hoursCompleted: -1 }, { hoursCompleted: 487 }, { hoursCompleted: '486' }, { startDate: '2025-02-30' }, { startDate: '2099-01-01' }, { endDate: '2024-12-31' }]) assert.throws(() => validateInternship({ ...valid, ...changes }), error => error.status === 400);
});
test('portfolio entries validate titles, duplicate certificates, section names, and skill limits', () => {
  assert.deepEqual(validatePortfolio('projects', [{ title: ' A ', desc: ' B ' }]), [{ title: 'A', desc: 'B' }]);
  for (const [section, entries] of [['unknown', []], ['skills', Array.from({ length: 11 }, (_, i) => `Skill ${i}`)], ['certifications', ['Certificate', 'certificate']], ['projects', [{ title: '' }]], ['awards', 'Award']]) assert.throws(() => validatePortfolio(section, entries), error => error.status === 400);
  assert.throws(() => pastDate('2026-02-30'), error => error.status === 400);
});
