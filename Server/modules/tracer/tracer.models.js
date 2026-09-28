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
      return await tracerCollection.findOne({ authId: id });
    } catch {
      return await tracerCollection.findOne({ authId });
    }
  },

  async upsertByAuthId(authId, data) {
    try {
      const { ObjectId } = await import('mongodb');
      const id = authId instanceof ObjectId ? authId : new ObjectId(authId);
      const now = new Date();
      await tracerCollection.updateOne(
        { authId: id },
        {
          $set: { ...data, authId: id, updatedAt: now },
          $setOnInsert: { respondedAt: now },
        },
        { upsert: true }
      );
      return await tracerCollection.findOne({ authId: id });
    } catch {
      const now = new Date();
      await tracerCollection.updateOne(
        { authId },
        {
          $set: { ...data, authId, updatedAt: now },
          $setOnInsert: { respondedAt: now },
        },
        { upsert: true }
      );
      return await tracerCollection.findOne({ authId });
    }
  },

  async findAll() {
    return await tracerCollection.find({}).sort({ updatedAt: -1 }).toArray();
  },
};

export default TracerModel;
