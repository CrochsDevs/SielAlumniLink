export const TRACER_STATUS_DETAILS = {
  Employed: { company: 'Company', position: 'Job Title', salaryRange: 'Salary Range', employmentDate: 'Employment Start Date', location: 'Work Location' },
  'Self-employed': { company: 'Business / Freelance Name', position: 'Business Type / Line of Work', salaryRange: 'Monthly Income Range', employmentDate: 'Business / Freelance Start Date', location: 'Business / Work Location' },
  Studying: { company: 'School / University', position: 'Current Course / Degree', location: 'School Location' },
  Unemployed: {},
};

export const normalizeTracerDetails = response => ({
  ...response,
  ...Object.fromEntries(
    ['company', 'position', 'salaryRange', 'employmentDate', 'location']
      .filter(key => !TRACER_STATUS_DETAILS[response.status]?.[key]).map(key => [key, '']),
  ),
});

export const formatTracerStartMonth = value => {
  if (!value) return '';
  const match = String(value).match(/^(\d{4})-(\d{2})(?:$|-|T)/);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return '';
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1))
    .toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
};
