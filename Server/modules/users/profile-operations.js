// API actions are translated to database operators here. Request bodies never
// supply database operators or dotted field paths directly.
export function profileOperations(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => key.startsWith('$') || key.includes('.'))) {
    throw new Error('Use profile fields and supported profile actions only.');
  }
  const operations = {};
  const has = key => Object.hasOwn(body, key);
  if ((has('addSkill') && has('removeSkill')) ||
      (has('skills') && (has('addSkill') || has('removeSkill'))) ||
      (has('education') && has('addEducation'))) {
    throw new Error('Send one action for each profile field at a time.');
  }
  for (const [action, operator] of [['addSkill', '$addToSet'], ['removeSkill', '$pull']]) {
    if (!has(action)) continue;
    const value = body[action];
    if (typeof value !== 'string' || !value.trim() || value.length > 100) {
      throw new Error('Skills must be non-empty text of at most 100 characters.');
    }
    operations[operator] = { skills: value.trim() };
  }
  if (has('addEducation')) {
    const value = body.addEducation;
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).some(key => !['school', 'degree', 'year', 'location'].includes(key))) {
      throw new Error('Provide valid education details.');
    }
    const entry = {};
    for (const field of ['school', 'degree', 'year', 'location']) {
      const text = value[field] ?? '';
      if (typeof text !== 'string' || text.length > 200 ||
          (['school', 'degree'].includes(field) && !text.trim())) {
        throw new Error('School and degree are required; education fields must be text of at most 200 characters.');
      }
      entry[field] = text.trim();
    }
    operations.$push = { education: entry };
  }
  return operations;
}
