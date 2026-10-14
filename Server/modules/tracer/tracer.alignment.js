export const JOB_ALIGNMENTS = ['directly_related', 'partly_related', 'unrelated', 'unsure'];
export const ALIGNMENT_LABELS = { directly_related: 'Directly related', partly_related: 'Partly related', unrelated: 'Unrelated', unsure: 'Not sure', not_reported: 'Not reported', not_applicable: 'Not applicable' };
const working = status => ['Employed', 'Self-employed'].includes(status);
const bad = message => { throw Object.assign(new Error(message), { status: 400 }); };
const yearAt = value => {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Manila' }).format(date)) : null;
};

export function validateTracerResponse(body, now = new Date()) {
  if (!body || typeof body !== 'object') bad('Please provide your tracer response');
  const read = (key, max = 200, required = false) => {
    const value = body[key] ?? '';
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) bad(`Please provide a valid ${key} (maximum ${max} characters)`);
    return value.trim();
  };
  const batch = read('batch', 4, true);
  if (!/^\d{4}$/.test(batch) || Number(batch) < 1900 || Number(batch) > yearAt(now)) bad('Graduation year must be a valid past or current year');
  const program = read('program', 200, true);
  const status = read('status', 30, true);
  if (!['Employed', 'Self-employed', 'Unemployed', 'Studying'].includes(status)) bad('Invalid employment status');
  const hasWork = working(status);
  const hasDetails = hasWork || status === 'Studying';
  const data = { batch, program, status, company: hasDetails ? read('company', 200, hasWork) : '', position: hasDetails ? read('position', 200, hasWork) : '', location: hasDetails ? read('location') : '', salaryRange: hasWork ? read('salaryRange') : '', employmentDate: null, jobAlignment: '', alignmentExplanation: '' };
  if (hasWork) {
    data.jobAlignment = read('jobAlignment', 30, true);
    if (!JOB_ALIGNMENTS.includes(data.jobAlignment)) bad('Please choose how your current work relates to your graduation program');
    data.alignmentExplanation = read('alignmentExplanation', 1000, true);
    const month = read('employmentDate', 7);
    if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) bad('Employment start month must be YYYY-MM');
    if (month) {
      data.employmentDate = new Date(`${month}-01T00:00:00Z`);
      if (data.employmentDate > now) bad('Employment start month cannot be in the future');
    }
  }
  return data;
}

export function buildAlignmentReport(documents, filters = {}) {
  const followUp = filters.followUp || '3-5';
  if (!['all', '0-2', '3-5', '6+'].includes(followUp)) bad('Invalid follow-up period');
  for (const key of ['program', 'batch', 'alignment', 'query']) {
    if (filters[key] !== undefined && (typeof filters[key] !== 'string' || filters[key].length > 200)) bad(`Invalid ${key} filter`);
  }
  if (filters.alignment && !Object.hasOwn(ALIGNMENT_LABELS, filters.alignment)) bad('Invalid alignment filter');
  const observations = documents.flatMap(document => {
    // Legacy responses remain unknown until alumni explicitly answer the new question.
    const snapshots = Array.isArray(document.responseHistory) && document.responseHistory.length ? document.responseHistory : [{ ...document, recordedAt: document.updatedAt || document.respondedAt }];
    return snapshots.map(snapshot => {
      const recordedAt = snapshot.recordedAt || snapshot.updatedAt || snapshot.respondedAt;
      const surveyYear = yearAt(recordedAt);
      const graduationYear = /^\d{4}$/.test(String(snapshot.batch)) ? Number(snapshot.batch) : null;
      const years = surveyYear !== null && graduationYear !== null && surveyYear >= graduationYear ? surveyYear - graduationYear : null;
      const alignment = working(snapshot.status) ? JOB_ALIGNMENTS.includes(snapshot.jobAlignment) ? snapshot.jobAlignment : 'not_reported' : 'not_applicable';
      return { authId: String(document.authId || document._id), email: document.email || '', name: document.alumniName || '', program: snapshot.program || '', batch: String(snapshot.batch || ''), status: snapshot.status || '', company: snapshot.company || '', position: snapshot.position || '', alignment, alignmentLabel: ALIGNMENT_LABELS[alignment], explanation: snapshot.alignmentExplanation || '', recordedAt: recordedAt || null, yearsAfterGraduation: years };
    });
  });
  const inWindow = years => followUp === 'all' || (years !== null && (followUp === '3-5' ? years >= 3 && years <= 5 : followUp === '0-2' ? years <= 2 : years >= 6));
  const latest = new Map();
  for (const row of observations) {
    if (!inWindow(row.yearsAfterGraduation) || (filters.program && row.program !== filters.program) || (filters.batch && row.batch !== filters.batch)) continue;
    const key = JSON.stringify([row.authId, row.program, row.batch]);
    const previous = latest.get(key);
    if (!previous || (new Date(row.recordedAt).getTime() || 0) >= (new Date(previous.recordedAt).getTime() || 0)) latest.set(key, row);
  }
  const rows = [...latest.values()].filter(row => (!filters.alignment || row.alignment === filters.alignment) && (!filters.query || [row.name, row.email, row.company, row.position, row.program].some(value => value.toLowerCase().includes(filters.query.toLowerCase().trim()))));
  const summarize = members => {
    const count = key => members.filter(row => row.alignment === key).length;
    const directlyRelated = count('directly_related'), partlyRelated = count('partly_related'), unrelated = count('unrelated');
    const assessed = directlyRelated + partlyRelated + unrelated;
    return { respondents: members.length, working: members.filter(row => working(row.status)).length, directlyRelated, partlyRelated, unrelated, unsure: count('unsure'), notReported: count('not_reported'), notWorking: count('not_applicable'), assessed,
      directAlignmentRate: assessed ? Math.round(directlyRelated / assessed * 1000) / 10 : null,
      relatedWorkRate: assessed ? Math.round((directlyRelated + partlyRelated) / assessed * 1000) / 10 : null };
  };
  const programs = [...new Set(rows.map(row => row.program))].sort().map(program => ({ program, ...summarize(rows.filter(row => row.program === program)) }));
  const options = { programs: [...new Set(observations.map(row => row.program).filter(Boolean))].sort(), batches: [...new Set(observations.map(row => row.batch).filter(Boolean))].sort().reverse() };
  return { summary: summarize(rows), programs, rows: rows.sort((a, b) => a.program.localeCompare(b.program) || a.email.localeCompare(b.email)), options, followUp };
}
