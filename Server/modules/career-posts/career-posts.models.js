import { client } from '../../config/db.js';

const db = client.db('SielAlumni');
const postsCollection = db.collection('career_posts');

const toObjectId = async (id) => {
  const { ObjectId } = await import('mongodb');
  return id instanceof ObjectId ? id : new ObjectId(id);
};

export const POST_TYPES = ['advice', 'insight', 'roadmap'];

export const CareerPostModel = {
  async findAll({ type } = {}) {
    const filter = { isActive: true };
    if (type && POST_TYPES.includes(type)) filter.type = type;
    return await postsCollection.find(filter).sort({ createdAt: -1 }).toArray();
  },

  async findById(id) {
    try {
      return await postsCollection.findOne({ _id: await toObjectId(id) });
    } catch {
      return null;
    }
  },

  async create({ title, body, type, tags, authorAuthId, authorName, authorEmail }) {
    const now = new Date();
    const doc = {
      title,
      body: body || '',
      type: POST_TYPES.includes(type) ? type : 'advice',
      tags: Array.isArray(tags) ? tags : [],
      authorAuthId: authorAuthId ? String(authorAuthId) : null,
      authorName: authorName || '',
      authorEmail: authorEmail || '',
      savedBy: [],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    const result = await postsCollection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  },

  async updateById(id, data) {
    try {
      const objectId = await toObjectId(id);
      const update = {};
      if (data.title !== undefined) update.title = data.title;
      if (data.body !== undefined) update.body = data.body;
      if (data.type !== undefined && POST_TYPES.includes(data.type)) update.type = data.type;
      if (data.tags !== undefined) update.tags = Array.isArray(data.tags) ? data.tags : [];
      if (data.isActive !== undefined) update.isActive = data.isActive;
      const result = await postsCollection.updateOne(
        { _id: objectId },
        { $set: { ...update, updatedAt: new Date() } }
      );
      if (!result.matchedCount) return null;
      return await postsCollection.findOne({ _id: objectId });
    } catch {
      return null;
    }
  },

  async deleteById(id) {
    try {
      const result = await postsCollection.deleteOne({ _id: await toObjectId(id) });
      return result.deletedCount > 0;
    } catch {
      return false;
    }
  },

  async toggleSave(id, authId) {
    try {
      const objectId = await toObjectId(id);
      const post = await postsCollection.findOne({ _id: objectId });
      if (!post) return null;
      const key = String(authId);
      const saved = (post.savedBy || []).map(String).includes(key);
      const update = saved
        ? { $pull: { savedBy: key } }
        : { $addToSet: { savedBy: key } };
      await postsCollection.updateOne({ _id: objectId }, update);
      return { saved: !saved };
    } catch {
      return null;
    }
  },

  async findSavedBy(authId) {
    return await postsCollection
      .find({ savedBy: String(authId), isActive: true })
      .sort({ createdAt: -1 })
      .toArray();
  },
};

export default CareerPostModel;
