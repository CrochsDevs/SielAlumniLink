import { client } from '../../config/db.js';

const db = client.db('SielAlumni');
const eventsCollection = db.collection('events');

const toObjectId = async (id) => {
  const { ObjectId } = await import('mongodb');
  return id instanceof ObjectId ? id : new ObjectId(id);
};

export const EventModel = {
  async findAll({ activeOnly = false } = {}) {
    const filter = activeOnly ? { isActive: true } : {};
    return await eventsCollection.find(filter).sort({ startAt: 1 }).toArray();
  },

  async findById(id) {
    try {
      return await eventsCollection.findOne({ _id: await toObjectId(id) });
    } catch {
      return null;
    }
  },

  async create(data) {
    const now = new Date();
    const doc = {
      title: data.title,
      description: data.description || '',
      location: data.location || '',
      startAt: data.startAt ? new Date(data.startAt) : now,
      endAt: data.endAt ? new Date(data.endAt) : null,
      isActive: data.isActive !== false,
      createdBy: data.createdBy ? String(data.createdBy) : null,
      createdAt: now,
      updatedAt: now,
    };
    const result = await eventsCollection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  },

  async updateById(id, data) {
    try {
      const objectId = await toObjectId(id);
      const update = {};
      ['title', 'description', 'location', 'isActive'].forEach((key) => {
        if (data[key] !== undefined) update[key] = data[key];
      });
      if (data.startAt !== undefined) update.startAt = data.startAt ? new Date(data.startAt) : null;
      if (data.endAt !== undefined) update.endAt = data.endAt ? new Date(data.endAt) : null;
      const result = await eventsCollection.updateOne(
        { _id: objectId },
        { $set: { ...update, updatedAt: new Date() } }
      );
      if (!result.matchedCount) return null;
      return await eventsCollection.findOne({ _id: objectId });
    } catch {
      return null;
    }
  },

  async deleteById(id) {
    try {
      const result = await eventsCollection.deleteOne({ _id: await toObjectId(id) });
      return result.deletedCount > 0;
    } catch {
      return false;
    }
  },
};

export default EventModel;
