import { client } from '../../config/db.js';

const db = client.db('SielAlumni');
const surveysCollection = db.collection('surveys');

const toObjectId = async (id) => {
  const { ObjectId } = await import('mongodb');
  return id instanceof ObjectId ? id : new ObjectId(id);
};

export const SurveyModel = {
  async findAll({ activeOnly = false } = {}) {
    const filter = activeOnly ? { isActive: true } : {};
    return await surveysCollection.find(filter).sort({ createdAt: -1 }).toArray();
  },

  async findById(id) {
    try {
      return await surveysCollection.findOne({ _id: await toObjectId(id) });
    } catch {
      return null;
    }
  },

  async create(data) {
    const now = new Date();
    const questions = Array.isArray(data.questions)
      ? data.questions.filter((q) => q && q.text && String(q.text).trim()).map((q) => ({
          text: String(q.text).trim(),
          type: q.type === 'choice' ? 'choice' : 'text',
          options: Array.isArray(q.options) ? q.options.filter(Boolean) : [],
        }))
      : [];
    const doc = {
      title: data.title,
      description: data.description || '',
      questions,
      isActive: data.isActive !== false,
      createdBy: data.createdBy ? String(data.createdBy) : null,
      createdAt: now,
      updatedAt: now,
    };
    const result = await surveysCollection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  },

  async updateById(id, data) {
    try {
      const objectId = await toObjectId(id);
      const update = {};
      ['title', 'description', 'isActive'].forEach((key) => {
        if (data[key] !== undefined) update[key] = data[key];
      });
      if (data.questions !== undefined) {
        update.questions = Array.isArray(data.questions)
          ? data.questions.filter((q) => q && q.text && String(q.text).trim()).map((q) => ({
              text: String(q.text).trim(),
              type: q.type === 'choice' ? 'choice' : 'text',
              options: Array.isArray(q.options) ? q.options.filter(Boolean) : [],
            }))
          : [];
      }
      const result = await surveysCollection.updateOne(
        { _id: objectId },
        { $set: { ...update, updatedAt: new Date() } }
      );
      if (!result.matchedCount) return null;
      return await surveysCollection.findOne({ _id: objectId });
    } catch {
      return null;
    }
  },

  async deleteById(id) {
    try {
      const result = await surveysCollection.deleteOne({ _id: await toObjectId(id) });
      return result.deletedCount > 0;
    } catch {
      return false;
    }
  },
};

export default SurveyModel;
