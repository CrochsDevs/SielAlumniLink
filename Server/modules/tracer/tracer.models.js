import { ObjectId } from 'mongodb';
import { client } from '../../config/db.js';

const db = client.db('SielAlumni');
const tracerCollection = db.collection('tracer_responses');

// One response per account (upsert by authId). Status values must match
// the labels used in the admin dashboard filters.
export const TRACER_STATUSES = ['Employed', 'Self-employed', 'Unemployed', 'Studying'];

export const TracerModel = {
  async findByAuthId(authId) {
    try {
      const { ObjectId } = await import('mongodb');
      const id = authId instanceof ObjectId ? authId : new ObjectId(authId);
      return await tracerCollection.findOne({ authId: { $in: [id, String(id)] } }, { projection: { responseHistory: 0 } });
    } catch {
      return await tracerCollection.findOne({ authId }, { projection: { responseHistory: 0 } });
    }
  },

  async upsertByAuthId(authId, data) {
    const id = authId instanceof ObjectId ? authId : ObjectId.isValid(authId) ? new ObjectId(authId) : authId;
    const now = new Date();
    const snapshot = { ...data, recordedAt: now };
    const legacySnapshot = Object.fromEntries(['batch', 'program', 'status', 'company', 'position', 'location', 'jobAlignment', 'alignmentExplanation'].map(key => [key, `$${key}`]));
    legacySnapshot.recordedAt = { $ifNull: ['$updatedAt', '$respondedAt'] };
    // Append a dated observation atomically while keeping the latest response for the existing form.
    await tracerCollection.updateOne(
      { authId: { $in: [id, String(id)] } },
      [{ $set: {
        ...Object.fromEntries(Object.entries(data).map(([key, value]) => [key, { $literal: value }])),
        authId: { $literal: id }, updatedAt: now,
        respondedAt: { $ifNull: ['$respondedAt', now] },
        responseHistory: { $concatArrays: [
          { $cond: [{ $isArray: '$responseHistory' }, '$responseHistory', { $cond: [{ $ne: [{ $ifNull: ['$program', null] }, null] }, [legacySnapshot], []] }] },
          { $literal: [snapshot] },
        ] },
      } }],
      { upsert: true },
    );
    return await tracerCollection.findOne({ authId: id }, { projection: { responseHistory: 0 } });
  },

  async findAlumniResponses() {
    return await tracerCollection.aggregate([
      { $lookup: { from: 'auth', let: { id: { $toString: '$authId' } }, pipeline: [
        { $match: { role: 'alumni', $expr: { $eq: [{ $toString: '$_id' }, '$$id'] } } },
        { $project: { _id: 1 } },
      ], as: 'account' } },
      { $match: { 'account.0': { $exists: true } } },
      { $project: { account: 0 } },
    ]).toArray();
  },

  async findAll() {
    return await tracerCollection.find({}, { projection: { responseHistory: 0 } }).sort({ updatedAt: -1 }).toArray();
  },
};

export default TracerModel;
