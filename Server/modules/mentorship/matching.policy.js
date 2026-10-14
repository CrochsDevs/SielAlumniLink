const clean = value => typeof value === 'string' ? value.trim().slice(0, 4000) : '';
const normalize = value => clean(value).toLowerCase().replace(/\s+/g, ' ');
const list = value => Array.isArray(value) ? [...new Map(value.filter(item => clean(item)).map(item => [normalize(item), clean(item)])).values()].slice(0, 20) : [];
const stop = new Set('a an the and or of in to for with at on my i want become work career interested interests experience skills'.split(' '));
const tokens = value => [...new Set((normalize(value).match(/[\p{L}\p{N}][\p{L}\p{N}+#.]*/gu) || []).filter(word => !stop.has(word)))];

export function validateMatchPreferences(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      typeof input.careerGoals !== 'string' || input.careerGoals.length > 1000 ||
      !Array.isArray(input.interests) || input.interests.length > 20 ||
      input.interests.some(item => typeof item !== 'string' || item.length > 80)) {
    throw Object.assign(new Error('Provide career goals up to 1,000 characters and up to 20 interests of 80 characters each.'), { status: 400 });
  }
  return { careerGoals: input.careerGoals.trim(), interests: list(input.interests) };
}

// Content-based recommendation: exact skill overlap plus TF-IDF cosine similarity.
// Only career-related fields enter the model; identity and demographic fields do not.
export function rankMentors(student, mentors, preferences) {
  const skills = list(student.skills);
  const interests = list(preferences.interests);
  const goals = clean(preferences.careerGoals);
  const documents = mentors.map(mentor => tokens([
    ...list(mentor.skills), ...list(mentor.interests), clean(mentor.bio),
    ...(Array.isArray(mentor.employmentHistory) ? mentor.employmentHistory : []).flatMap(job => [clean(job?.position), clean(job?.description)]),
  ].join(' ')));
  const frequency = new Map();
  for (const document of documents) for (const term of document) frequency.set(term, (frequency.get(term) || 0) + 1);
  const weight = term => 1 + Math.log((documents.length + 1) / ((frequency.get(term) || 0) + 1));
  const similarity = (query, document) => {
    if (!query.length || !document.length) return 0;
    const shared = query.filter(term => document.includes(term));
    const magnitude = terms => Math.sqrt(terms.reduce((sum, term) => sum + weight(term) ** 2, 0));
    return shared.reduce((sum, term) => sum + weight(term) ** 2, 0) / (magnitude(query) * magnitude(document));
  };
  const interestTokens = tokens(interests.join(' '));
  const goalTokens = tokens(goals);
  const availableWeight = (skills.length ? 45 : 0) + (interestTokens.length ? 30 : 0) + (goalTokens.length ? 20 : 0) + (clean(student.program) ? 5 : 0);
  return mentors.map((mentor, index) => {
    const mentorSkills = new Set(list(mentor.skills).map(normalize));
    const sharedSkills = skills.filter(skill => mentorSkills.has(normalize(skill)));
    const sharedInterests = interestTokens.filter(term => documents[index].includes(term));
    const sharedGoals = goalTokens.filter(term => documents[index].includes(term));
    const sameProgram = !!clean(student.program) && normalize(student.program) === normalize(mentor.program);
    const raw = (skills.length ? 45 * sharedSkills.length / skills.length : 0) +
      30 * similarity(interestTokens, documents[index]) + 20 * similarity(goalTokens, documents[index]) + (sameProgram ? 5 : 0);
    const reasons = [];
    if (sharedSkills.length) reasons.push(`Shared skills: ${sharedSkills.join(', ')}`);
    if (sharedInterests.length) reasons.push(`Interests reflected in their profile: ${sharedInterests.slice(0, 5).join(', ')}`);
    if (sharedGoals.length) reasons.push(`Career goal keywords in their experience or profile: ${sharedGoals.slice(0, 5).join(', ')}`);
    if (sameProgram) reasons.push(`Same program: ${clean(student.program)}`);
    return { mentor, score: availableWeight ? Math.min(100, Math.round(100 * raw / availableWeight)) : 0, reasons };
  }).filter(match => match.score > 0).sort((a, b) => b.score - a.score || String(a.mentor._id).localeCompare(String(b.mentor._id))).slice(0, 12);
}

