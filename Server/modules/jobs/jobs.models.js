import { client } from '../../config/db.js';

const db = client.db('SielAlumni');
const jobsCollection = db.collection('job_posts');

const toObjectId = async (id) => {
  const { ObjectId } = await import('mongodb');
  return id instanceof ObjectId ? id : new ObjectId(id);
};

export const JobModel = {
  async findAll({ activeOnly = false } = {}) {
    const filter = activeOnly ? { isActive: true } : {};
    return await jobsCollection.find(filter).sort({ createdAt: -1 }).toArray();
  },

  async findById(id) {
    try {
      return await jobsCollection.findOne({ _id: await toObjectId(id) });
    } catch {
      return null;
    }
  },

  async create(data) {
    const now = new Date();
    const doc = {
      title: data.title,
      company: data.company,
      location: data.location || '',
      type: data.type || 'Full-time',
      mode: data.mode || 'On-site',
      description: data.description || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      isActive: data.isActive !== false,
      createdBy: data.createdBy ? String(data.createdBy) : null,
      createdAt: now,
      updatedAt: now,
    };
    const result = await jobsCollection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  },

  async updateById(id, data) {
    try {
      const objectId = await toObjectId(id);
      const allowed = ['title', 'company', 'location', 'type', 'mode', 'description', 'tags', 'isActive'];
      const update = {};
      allowed.forEach((key) => {
        if (data[key] !== undefined) update[key] = data[key];
      });
      const result = await jobsCollection.updateOne(
        { _id: objectId },
        { $set: { ...update, updatedAt: new Date() } }
      );
      if (!result.matchedCount) return null;
      return await jobsCollection.findOne({ _id: objectId });
    } catch {
      return null;
    }
  },

  async deleteById(id) {
    try {
      const result = await jobsCollection.deleteOne({ _id: await toObjectId(id) });
      return result.deletedCount > 0;
    } catch {
      return false;
    }
  },
};

export default JobModel;
