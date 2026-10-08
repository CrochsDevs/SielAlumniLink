export const profilePath = (person) => `/${person.role === 'student' ? 'student' : 'alumni'}/profile/${person._id}`;
