import { ObjectId } from 'mongodb';
import { rankMentors, validateMatchPreferences } from './matching.policy.js';

const ids = value => ObjectId.isValid(String(value)) ? [String(value), new ObjectId(String(value))] : [String(value)];
const requireStudent = user => {
  if (String(user?.role).toLowerCase() !== 'student') throw Object.assign(new Error('Mentor matching is available to students.'), { status: 403 });
};

export function createMatchingService(db) {
  const settings = db.collection('mentor_match_preferences');
  const profiles = db.collection('users');
  const get = async user => {
    requireStudent(user);
    const [profile, portfolio, saved, accounts] = await Promise.all([
      profiles.findOne({ authId: { $in: ids(user._id) } }),
      db.collection('student_portfolios').findOne({ _id: String(user._id) }),
      settings.findOne({ _id: String(user._id) }),
      db.collection('auth').find({ role: { $in: ['alumni', 'Alumni', 'ALUMNI'] } }, { projection: { _id: 1, email: 1 } }).toArray(),
    ]);
    const alumni = accounts.filter(account => String(account._id) !== String(user._id) && account.email);
    const candidates = alumni.length ? await profiles.find({ authId: { $in: alumni.flatMap(account => ids(account._id)) } }).toArray() : [];
    const accountById = new Map(alumni.map(account => [String(account._id), account]));
    const seen = new Set();
    const mentors = candidates.sort((a, b) => String(b._id).localeCompare(String(a._id))).filter(mentor => {
      const key = String(mentor.authId);
      if (seen.has(key) || !accountById.has(key)) return false;
      seen.add(key); return true;
    }).map(mentor => ({
      _id: String(mentor._id), name: mentor.name || 'Alumni',
      email: accountById.get(String(mentor.authId)).email,
      program: mentor.program || '', profilePicture: mentor.profilePicture || null, bannerImage: mentor.bannerImage || null,
      skills: mentor.skills, interests: mentor.interests, bio: mentor.bio,
      employmentHistory: mentor.employmentHistory,
    }));
    const preferences = { interests: saved?.interests ?? (Array.isArray(profile?.interests) ? profile.interests : []), careerGoals: saved?.careerGoals ?? '' };
    const student = { ...profile, skills: portfolio?.skills ?? profile?.skills };
    const matches = rankMentors(student, mentors, preferences).map(({ mentor, ...match }) => ({
      ...match, mentor: { _id: mentor._id, name: mentor.name, email: mentor.email, program: mentor.program, profilePicture: mentor.profilePicture, bannerImage: mentor.bannerImage,
        headline: (Array.isArray(mentor.employmentHistory) ? mentor.employmentHistory : []).find(job => job?.current)?.position || mentor.program || 'CLSU alumni' },
    }));
    return { preferences, matches, profile: { skills: Array.isArray(student.skills) ? student.skills : [], program: profile?.program || '' }, candidateCount: mentors.length, method: 'content-based-tfidf-v1' };
  };
  return {
    get,
    async save(user, input) {
      requireStudent(user);
      const preferences = validateMatchPreferences(input);
      await settings.updateOne({ _id: String(user._id) }, { $set: { ...preferences, updatedAt: new Date() } }, { upsert: true });
      return get(user);
    },
  };
}
