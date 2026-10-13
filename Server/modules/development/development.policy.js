export const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
export const PORTFOLIO_SECTIONS = ['skills', 'certifications', 'seminars', 'projects', 'research', 'awards'];
export const text = (value, label, max = 200, required = false) => {
  if (value == null) value = '';
  if (typeof value !== 'string') fail(400, `${label} must be text`);
  const result = value.trim();
  if ((required && !result) || result.length > max) fail(400, `${label} ${!result ? 'is required' : `must be at most ${max} characters`}`);
  return result;
};
export const today = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
export const pastDate = (value, label = 'Date') => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(400, `${label} must be a valid date`);
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || value > today()) fail(400, `${label} cannot be invalid or in the future`);
  return value;
};
export const validateInternship = input => {
  const company = text(input.company, 'Internship company', 200, true);
  const supervisor = text(input.supervisor, 'Supervisor', 200, true);
  const requiredHours = input.requiredHours;
  const hoursCompleted = input.hoursCompleted;
  if (typeof requiredHours !== 'number' || !Number.isFinite(requiredHours) || requiredHours < 1 || requiredHours > 10000) fail(400, 'Required hours must be between 1 and 10,000');
  if (typeof hoursCompleted !== 'number' || !Number.isFinite(hoursCompleted) || hoursCompleted < 0 || hoursCompleted > requiredHours) fail(400, 'Completed hours must be between zero and the required hours');
  const startDate = pastDate(input.startDate, 'Internship start');
  const endDate = input.endDate ? pastDate(input.endDate, 'Internship end') : '';
  if (endDate && endDate < startDate) fail(400, 'End date cannot precede the start date');
  return { company, supervisor, requiredHours, hoursCompleted, startDate, endDate,
    evaluation: text(input.evaluation, 'Evaluation', 3000), location: text(input.location, 'Location'),
    completed: hoursCompleted >= requiredHours };
};
export const validatePortfolio = (section, input) => {
  if (!PORTFOLIO_SECTIONS.includes(section)) fail(400, 'Unknown portfolio section');
  if (!Array.isArray(input) || input.length > (section === 'skills' ? 10 : 100)) fail(400, `Invalid ${section} list`);
  const entries = input.map(entry => ['projects', 'research'].includes(section)
    ? { title: text(entry?.title, 'Title', 200, true), desc: text(entry?.desc, 'Description', 2000) }
    : text(entry, 'Entry', 300, true));
  const keys = entries.map(entry => typeof entry === 'string' ? entry.toLowerCase() : entry.title.toLowerCase());
  if (new Set(keys).size !== keys.length) fail(400, 'Remove duplicate entries');
  return entries;
};
export const calculateReadiness = ({ mentorCount = 0, eventCount = 0, portfolio = {}, internships = [] }) => {
  const completeSections = PORTFOLIO_SECTIONS.filter(key => portfolio[key]?.length).length;
  const bestProgress = Math.max(0, ...internships.map(record => Math.min(1, record.hoursCompleted / record.requiredHours || 0)));
  const factors = [
    { key: 'mentorship', label: 'Mentorship participation', value: mentorCount, target: 1, ratio: Math.min(1, mentorCount), link: '/student/mentorship' },
    { key: 'events', label: 'Event attendance', value: eventCount, target: 3, ratio: Math.min(1, eventCount / 3), link: '/student/journey' },
    { key: 'certifications', label: 'Certifications', value: portfolio.certifications?.length || 0, target: 3, ratio: Math.min(1, (portfolio.certifications?.length || 0) / 3), link: '/student/portfolio' },
    { key: 'portfolio', label: 'Portfolio completeness', value: completeSections, target: 6, ratio: completeSections / 6, link: '/student/portfolio' },
    { key: 'internship', label: 'Internship completion', value: Math.round(bestProgress * 100), target: 100, ratio: bestProgress, link: '/student/internship' },
  ].map(factor => ({ ...factor, maxPoints: 20, points: Math.round(factor.ratio * 20) }));
  const score = factors.reduce((sum, factor) => sum + factor.points, 0);
  return { score, maxScore: 100, level: score >= 80 ? 'Highly Prepared' : score >= 60 ? 'Prepared' : score >= 40 ? 'Developing' : 'Getting Started', factors, formulaVersion: 1 };
};
