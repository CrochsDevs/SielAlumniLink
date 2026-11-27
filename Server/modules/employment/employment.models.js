import { client } from '../../config/db.js';
import { latestEmploymentTracer, withTracerEmployment } from './employment.tracer.js';
import { employmentState } from './employment.policy.js';

export const createEmploymentModel = db => {
const profiles = db.collection('users');

return {
  async updateProfile(profile, data) {
    // History-only edits must also retain a status supplied by the survey.
    data = { employmentStatus: employmentState(profile).employmentStatus, ...data };
    // A concurrent profile edit must not replace a newer employment history.
    const updatedAt = new Date();
    const result = await profiles.updateOne(
      {
        _id: profile._id,
        updatedAt: profile.updatedAt ?? { $exists: false },
        employmentRevision: profile.employmentRevision ?? { $exists: false },
      },
      { $set: { ...data, updatedAt }, $inc: { employmentRevision: 1 } },
    );
    if (!result.matchedCount) throw Object.assign(new Error('Your profile changed. Refresh and try again.'), { status: 409 });
    return { ...profile, ...data, updatedAt, employmentRevision: (profile.employmentRevision || 0) + 1 };
  },
  async alumniProfiles() {
    // The login account owns the role. Lookup also includes alumni without a directory profile.
    const rows = await db.collection('auth').aggregate([
      { $match: { role: 'alumni' } },
      { $lookup: { from: 'users', let: { authId: { $toString: '$_id' } }, pipeline: [
        { $match: { $expr: { $eq: [{ $convert: { input: '$authId', to: 'string', onError: '', onNull: '' } }, '$$authId'] } } },
        { $sort: { updatedAt: -1 } }, { $limit: 1 },
        { $project: { name: 1, email: 1, profilePicture: 1, batch: 1, program: 1, employmentStatus: 1, employmentHistory: 1, employmentUpdatedAt: 1 } },
      ], as: 'profile' } },
      { $replaceRoot: { newRoot: { $mergeObjects: [{ _id: '$_id', authId: '$_id', name: '$name', email: '$email' }, { $arrayElemAt: ['$profile', 0] }] } } },
      ...latestEmploymentTracer,
      { $sort: { name: 1, _id: 1 } },
    ]).toArray();
    return rows.map(({ _employmentTracer, ...profile }) => withTracerEmployment(profile, _employmentTracer?.[0]));
  },
};
};

export const EmploymentModel = createEmploymentModel(client.db('SielAlumni'));
