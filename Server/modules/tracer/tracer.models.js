import { ObjectId } from 'mongodb';
import { client } from '../../config/db.js';

// One response per account (upsert by authId). Status values must match
// the labels used in the admin dashboard filters.
export const TRACER_STATUSES = ['Employed', 'Self-employed', 'Unemployed', 'Studying'];

export const createTracerModel = db => {
const tracerCollection = db.collection('tracer_responses');
const activeResponses = (alumniOnly = false) => [
  { $lookup: { from: 'auth', let: { id: { $convert: { input: '$authId', to: 'string', onError: null, onNull: null } } }, pipeline: [
    { $match: { disabledAt: null, ...(alumniOnly ? { role: 'alumni' } : {}),
      $expr: { $eq: [{ $toString: '$_id' }, '$$id'] } } },
    { $project: { _id: 1 } },
  ], as: '_tracerAccount' } },
  { $match: { '_tracerAccount.0': { $exists: true } } },
  { $project: { _tracerAccount: 0 } },
];
return {
  async findByAuthId(authId) {
    try {
      const { ObjectId } = await import('mongodb');
      const id = authId instanceof ObjectId ? authId : new ObjectId(authId);
      return await tracerCollection.findOne({ authId: { $in: [id, String(id)] } }, {
        projection: { responseHistory: 0 }, sort: { updatedAt: -1, respondedAt: -1, _id: -1 },
      });
    } catch {
      return await tracerCollection.findOne({ authId }, {
        projection: { responseHistory: 0 }, sort: { updatedAt: -1, respondedAt: -1, _id: -1 },
      });
    }
  },

  async upsertByAuthId(authId, data) {
    const id = authId instanceof ObjectId ? authId : ObjectId.isValid(authId) ? new ObjectId(authId) : authId;
    const now = new Date();
    const snapshot = { ...data, recordedAt: now };
    // Preserve the first saved year even when updates arrive concurrently.
    const savedBatch = { $cond: [
      { $in: [{ $ifNull: ['$batch', ''] }, ['', null]] },
      { $literal: data.batch },
      '$batch',
    ] };
    const savedProgram = { $cond: [
      { $eq: [{ $ifNull: ['$program', ''] }, ''] },
      { $literal: data.program },
      '$program',
    ] };
    const legacySnapshot = Object.fromEntries(['batch', 'program', 'status', 'company', 'position', 'location', 'jobAlignment', 'alignmentExplanation'].map(key => [key, `$${key}`]));
    legacySnapshot.recordedAt = { $ifNull: ['$updatedAt', '$respondedAt'] };
    // Append a dated observation atomically while keeping the latest response for the existing form.
    await tracerCollection.updateOne(
      { authId: { $in: [id, String(id)] } },
      [{ $set: {
        ...Object.fromEntries(Object.entries(data).map(([key, value]) => [key, { $literal: value }])),
        batch: savedBatch,
        program: savedProgram,
        authId: { $literal: id }, updatedAt: now,
        respondedAt: { $ifNull: ['$respondedAt', now] },
        responseHistory: { $concatArrays: [
          { $cond: [{ $isArray: '$responseHistory' }, '$responseHistory', { $cond: [{ $ne: [{ $ifNull: ['$program', null] }, null] }, [legacySnapshot], []] }] },
          [{ $mergeObjects: [{ $literal: snapshot }, { batch: savedBatch, program: savedProgram }] }],
        ] },
      } }],
      { upsert: true },
    );
    return await tracerCollection.findOne({ authId: id }, { projection: { responseHistory: 0 } });
  },

  async findAlumniResponses() {
    // Alignment still needs every dated observation, including historical ones.
    return await tracerCollection.aggregate(activeResponses(true)).toArray();
  },

  async findAll() {
    return await tracerCollection.aggregate([
      ...activeResponses(),
      // Legacy string/ObjectId references identify the same account. Keep its
      // latest response in the list without deleting any historical documents.
      { $sort: { updatedAt: -1, respondedAt: -1, _id: -1 } },
      { $group: { _id: { $toString: '$authId' }, response: { $first: '$$ROOT' } } },
      { $replaceWith: '$response' },
      { $project: { responseHistory: 0 } },
      { $sort: { updatedAt: -1, respondedAt: -1, _id: -1 } },
    ]).toArray();
  },
};
};

export const TracerModel = createTracerModel(client.db('SielAlumni'));

export default TracerModel;
