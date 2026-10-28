const memberFields = ['_id', 'authId', 'name', 'role', 'program', 'batch', 'profilePicture', 'bannerImage',
    'location', 'bio', 'skills', 'interests'];
const publicDetails = ['contactEmail', 'profileLinks', 'projects', 'research', 'certifications', 'seminars', 'awards'];
const privateFields = ['email', 'studentId', 'yearLevel', 'section', 'academicStatus', 'graduatedAt',
    'contactNumber', 'createdAt', 'updatedAt', 'profileViews', 'profilePicturePublicId', 'bannerImagePublicId',
    'employmentStatus', 'employmentUpdatedAt', 'employmentRevision', 'historyRevision'];
const pick = (value, fields) => Object.fromEntries(fields.filter(key => value && Object.hasOwn(value, key)).map(key => [key, value[key]]));
export const profileProjection = Object.fromEntries([...memberFields, ...publicDetails, ...privateFields, 'education', 'employmentHistory'].map(key => [key, 1]));

export function visibleProfile(profile, viewer, { detail = false } = {}) {
    const privileged = viewer?.role === 'admin' || (profile.authId && String(profile.authId) === String(viewer?._id));
    const fields = [...memberFields, ...(detail ? publicDetails : []), ...(privileged ? [...privateFields, ...publicDetails] : [])];
    const result = pick(profile, fields);
    for (const key of ['skills', 'interests', 'certifications', 'seminars', 'awards']) {
        if (Object.hasOwn(result, key)) result[key] = (Array.isArray(result[key]) ? result[key] : []).filter(value => typeof value === 'string');
    }
    for (const [key, allowed] of [['profileLinks', ['type', 'url']], ['projects', ['title', 'desc']], ['research', ['title', 'desc']]]) {
        if (Object.hasOwn(result, key)) result[key] = (Array.isArray(result[key]) ? result[key] : []).map(entry => pick(entry, allowed));
    }
    if (detail || privileged) {
        result.education = (Array.isArray(profile.education) ? profile.education : []).map(entry => pick(entry, ['school', 'degree', 'year', 'location']));
        result.employmentHistory = (Array.isArray(profile.employmentHistory) ? profile.employmentHistory : []).map(entry => pick(entry,
            ['position', 'company', 'industry', 'location', 'startDate', 'endDate', 'start', 'end', 'current', 'description']));
    }
    return result;
}
