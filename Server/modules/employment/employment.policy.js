import { createHash, randomUUID } from 'node:crypto';

export const EMPLOYMENT_STATUSES = ['Employed', 'Self-employed', 'Unemployed', 'Studying'];
export const isWorking = status => status === 'Employed' || status === 'Self-employed';
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
const text = (value, label, required = false) => {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > 200 || (required && !value.trim())) fail(`${label} must be ${required ? 'a non-empty' : 'a'} string of up to 200 characters`);
  return value.trim();
};
const month = (value, label, required = false) => {
  const result = text(value, label, required);
  if (result && !/^\d{4}-(0[1-9]|1[0-2])$/.test(result)) fail(`${label} must be a valid month (YYYY-MM)`);
  return result;
};
const jobMonth = value => typeof value === 'string' ? value.slice(0, 7) : '';

export function employmentState(profile) {
  const history = (Array.isArray(profile.employmentHistory) ? profile.employmentHistory : []).filter(job => job && typeof job === 'object');
  const current = history.filter(job => job.current === true).sort((a, b) => jobMonth(b.startDate).localeCompare(jobMonth(a.startDate)))[0];
  const status = EMPLOYMENT_STATUSES.includes(profile.employmentStatus) ? profile.employmentStatus : current ? 'Employed' : 'Not reported';
  return {
    employmentStatus: status,
    currentCompany: isWorking(status) ? current?.company || '' : '',
    position: isWorking(status) ? current?.position || current?.role || '' : '',
    industry: isWorking(status) ? current?.industry || '' : '',
    location: isWorking(status) ? current?.location || '' : '',
    startDate: isWorking(status) ? jobMonth(current?.startDate) : '',
    employmentHistory: history,
    historyRevision: createHash('sha256').update(JSON.stringify([status, history])).digest('hex'),
    employmentUpdatedAt: profile.employmentUpdatedAt || null,
  };
}

export function assertEmploymentRevision(profile, revision) {
  if (revision !== employmentState(profile).historyRevision) {
    throw Object.assign(new Error('Your employment records changed. Refresh and try again.'), { status: 409 });
  }
}

export function removePastEmployment(profile, index, now = new Date()) {
  const history = employmentState(profile).employmentHistory;
  if (!Number.isInteger(index) || index < 0 || index >= history.length) {
    throw Object.assign(new Error('Experience not found'), { status: 404 });
  }
  if (history[index].current) fail('End your current employment before removing a current role.');
  return { employmentHistory: history.filter((_, i) => i !== index), employmentUpdatedAt: now };
}

// Profile experience editing uses the same rules and model as the employment page.
export function changeExperience(profile, input, now = new Date()) {
  assertEmploymentRevision(profile, input?.revision);
  const { action, index, entry } = input;
  if (!['add', 'edit', 'remove'].includes(action)) fail('Invalid experience action');
  const state = employmentState(profile);
  const history = state.employmentHistory;
  if (action !== 'add' && (!Number.isInteger(index) || index < 0 || index >= history.length)) {
    throw Object.assign(new Error('Experience not found'), { status: 404 });
  }
  if (action === 'remove') return removePastEmployment(profile, index, now);
  if (!entry || typeof entry !== 'object' || typeof entry.current !== 'boolean') fail('Invalid experience');
  if (entry.current) {
    if (!isWorking(entry.employmentStatus)) fail('Select Employed or Self-employed for a current role');
    // A past role changed to current replaces that past entry; a change to an
    // existing current company/position preserves the previous career step.
    const source = action === 'edit' && !history[index].current
      ? { ...profile, employmentHistory: history.filter((_, i) => i !== index) }
      : profile;
    return updateEmployment(source, { ...entry, currentCompany: entry.company }, now);
  }
  if (action === 'add') return addPastEmployment(profile, entry, now);
  const validated = addPastEmployment({}, entry, now).employmentHistory[0];
  const updated = history.map((job, i) => i === index
    ? { ...job, ...validated, _id: job._id || validated._id, createdAt: job.createdAt || validated.createdAt, updatedAt: now, period: '' }
    : job);
  const endedCurrent = history[index].current && !updated.some(job => job.current);
  return {
    employmentHistory: updated, employmentUpdatedAt: now,
    ...(endedCurrent && isWorking(state.employmentStatus) ? { employmentStatus: 'Unemployed' } : {}),
  };
}

export function updateEmployment(profile, data, now = new Date()) {
  if (!data || !EMPLOYMENT_STATUSES.includes(data.employmentStatus)) fail('Please select a valid employment status');
  const working = isWorking(data.employmentStatus);
  const company = working ? text(data.currentCompany, 'Current company / business', true) : '';
  const position = working ? text(data.position, 'Position', true) : '';
  const industry = working ? text(data.industry, 'Industry', true) : '';
  const location = working ? text(data.location, 'Location') : '';
  const startDate = working ? month(data.startDate, 'Start month', true) : '';
  const effectiveMonth = now.toISOString().slice(0, 7);
  if (startDate > effectiveMonth) fail('Start month cannot be in the future');
  const history = employmentState(profile).employmentHistory.map(job => ({ ...job }));
  const currentIndex = history.findIndex(job => job.current === true && job.company === company && (job.position || job.role) === position);
  const sameRole = working && currentIndex !== -1;
  // Correcting a start month keeps the same role. New companies or positions create a new step.
  for (let index = 0; index < history.length; index++) {
    if (!history[index].current || (sameRole && index === currentIndex)) continue;
    const endDate = startDate || effectiveMonth;
    if (jobMonth(history[index].startDate) > endDate) fail('New role must start on or after the previous current role');
    history[index] = { ...history[index], current: false, endDate, updatedAt: now };
  }
  if (working) {
    const job = { company, position, industry, location, startDate, endDate: '', current: true, updatedAt: now };
    if (sameRole) history[currentIndex] = { ...history[currentIndex], ...job };
    else history.push({ _id: randomUUID(), ...job, createdAt: now });
  }
  return { employmentStatus: data.employmentStatus, employmentHistory: history, employmentUpdatedAt: now };
}

export function addPastEmployment(profile, data, now = new Date()) {
  const job = {
    _id: randomUUID(), company: text(data.company, 'Company', true), position: text(data.position, 'Position', true),
    industry: text(data.industry, 'Industry'), location: text(data.location, 'Location'),
    startDate: month(data.startDate, 'Start month', true), endDate: month(data.endDate, 'End month', true),
    current: false, createdAt: now,
  };
  if (job.endDate < job.startDate) fail('End month must be on or after start month');
  if (job.endDate > now.toISOString().slice(0, 7)) fail('End month cannot be in the future');
  return { employmentHistory: [...employmentState(profile).employmentHistory, job], employmentUpdatedAt: now };
}

export function employmentReport(profiles, { batch, program } = {}) {
  const filtered = profiles.filter(profile => (!batch || profile.batch === batch) && (!program || profile.program === program));
  const statusDistribution = [...EMPLOYMENT_STATUSES, 'Not reported'].map(status => ({ status, count: 0 }));
  const industries = new Map();
  let employed = 0;
  const alumni = filtered.map(profile => {
    const state = employmentState(profile);
    statusDistribution.find(item => item.status === state.employmentStatus).count++;
    if (isWorking(state.employmentStatus)) {
      employed++;
      const name = state.industry.trim() || 'Not specified';
      const key = name.toLowerCase();
      const group = industries.get(key) || { industry: name, count: 0 };
      group.count++;
      industries.set(key, group);
    }
    const history = [...state.employmentHistory].sort((a, b) => jobMonth(a.startDate).localeCompare(jobMonth(b.startDate)));
    const transitions = history.slice(1).map((job, index) => {
      const previous = history[index];
      return { fromCompany: previous.company || '', fromPosition: previous.position || previous.role || '',
        toCompany: job.company || '', toPosition: job.position || job.role || '', startDate: jobMonth(job.startDate),
        companyChanged: previous.company !== job.company, positionChanged: (previous.position || previous.role) !== (job.position || job.role) };
    });
    return { _id: profile._id, name: profile.name || 'Alumni', email: profile.email || '',
      profilePicture: typeof profile.profilePicture === 'string' ? profile.profilePicture : null,
      batch: profile.batch || '', program: profile.program || '', ...state, employmentHistory: history, transitions };
  });
  const reported = filtered.length - statusDistribution.find(item => item.status === 'Not reported').count;
  const percentage = (count, total) => total ? Math.round(count / total * 1000) / 10 : 0;
  return {
    summary: { totalAlumni: filtered.length, reported, notReported: filtered.length - reported, employed,
      employmentRate: percentage(employed, reported), reportingRate: percentage(reported, filtered.length),
      alumniWithCareerChanges: alumni.filter(person => person.transitions.some(step => step.companyChanged || step.positionChanged)).length },
    statusDistribution,
    industryDistribution: [...industries.values()].map(item => ({ ...item, percentage: percentage(item.count, employed) })).sort((a, b) => b.count - a.count || a.industry.localeCompare(b.industry)),
    alumni,
    filters: { batches: [...new Set(profiles.map(profile => profile.batch).filter(Boolean))].sort().reverse(), programs: [...new Set(profiles.map(profile => profile.program).filter(Boolean))].sort() },
  };
}
