import { client } from '../../config/db.js';

const db = client.db('SielAlumni');
const announcementsCollection = db.collection('announcements');

const toObjectId = async (id) => {
  const { ObjectId } = await import('mongodb');
  return id instanceof ObjectId ? id : new ObjectId(id);
};

export const AnnouncementModel = {
  async findAll({ activeOnly = false } = {}) {
    const filter = activeOnly ? { isActive: true } : {};
    return await announcementsCollection.find(filter).sort({ createdAt: -1 }).toArray();
  },

  async findById(id) {
    try {
      return await announcementsCollection.findOne({ _id: await toObjectId(id) });
    } catch {
      return null;
    }
  },

  async create(data) {
    const now = new Date();
    const doc = {
      title: data.title,
      body: data.body || '',
      audience: data.audience || 'all',
      isActive: data.isActive !== false,
      createdBy: data.createdBy ? String(data.createdBy) : null,
      createdAt: now,
      updatedAt: now,
    };
    const result = await announcementsCollection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  },

  async updateById(id, data) {
    try {
      const objectId = await toObjectId(id);
      const update = {};
      ['title', 'body', 'audience', 'isActive'].forEach((key) => {
        if (data[key] !== undefined) update[key] = data[key];
      });
      const result = await announcementsCollection.updateOne(
        { _id: objectId },
        { $set: { ...update, updatedAt: new Date() } }
      );
      if (!result.matchedCount) return null;
      return await announcementsCollection.findOne({ _id: objectId });
    } catch {
      return null;
    }
  },

  async deleteById(id) {
    try {
      const result = await announcementsCollection.deleteOne({ _id: await toObjectId(id) });
      return result.deletedCount > 0;
    } catch {
      return false;
    }
  },
};

export default AnnouncementModel;
