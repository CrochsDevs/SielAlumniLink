import { client } from '../../config/db.js';
import { createHash } from 'node:crypto';


const toObjectId = async (id) => {
  const { ObjectId } = await import('mongodb');
  return id instanceof ObjectId ? id : new ObjectId(id);
};

export const REFERRAL_TYPES = ['job', 'internship', 'scholarship'];
export const APPLICATION_STATUSES = ['pending', 'reviewed', 'accepted', 'declined'];

export const createReferralModels = db => {
const referralsCollection = db.collection('referrals');
const applicationsCollection = db.collection('referral_applications');
const ReferralModel = {
  async findAll({ type, activeOnly = true } = {}) {
    const filter = {};
    if (activeOnly) filter.isActive = true;
    if (type && REFERRAL_TYPES.includes(type)) filter.type = type;
    return await referralsCollection.find(filter).sort({ createdAt: -1 }).toArray();
  },

  async findById(id) {
    try {
      return await referralsCollection.findOne({ _id: await toObjectId(id) });
    } catch {
      return null;
    }
  },

  async create({ title, description, type, organization, link, authorAuthId, authorName, authorEmail }) {
    const now = new Date();
    const doc = {
      title,
      description: description || '',
      type: REFERRAL_TYPES.includes(type) ? type : 'job',
      organization: organization || '',
      link: link || '',
      authorAuthId: authorAuthId ? String(authorAuthId) : null,
      authorName: authorName || '',
      authorEmail: authorEmail || '',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    const result = await referralsCollection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  },

  async updateById(id, data) {
    try {
      const objectId = await toObjectId(id);
      const update = {};
      ['title', 'description', 'organization', 'link', 'isActive'].forEach((key) => {
        if (data[key] !== undefined) update[key] = data[key];
      });
      if (data.type !== undefined && REFERRAL_TYPES.includes(data.type)) update.type = data.type;
      const result = await referralsCollection.updateOne(
        { _id: objectId },
        { $set: { ...update, updatedAt: new Date() } }
      );
      if (!result.matchedCount) return null;
      return await referralsCollection.findOne({ _id: objectId });
    } catch {
      return null;
    }
  },

  async deleteById(id) {
    try {
      const objectId = await toObjectId(id);
      await applicationsCollection.deleteMany({ referralId: objectId });
      const result = await referralsCollection.deleteOne({ _id: objectId });
      return result.deletedCount > 0;
    } catch {
      return false;
    }
  },
};

const ReferralApplicationModel = {
  async apply({ referralId, applicantAuthId, email, name, note }) {
    const rid = await toObjectId(referralId);
    const aid = String(applicantAuthId);
    const existing = await applicationsCollection.findOne({ referralId: rid, applicantAuthId: aid });
    if (existing) {
      throw new Error('You already applied to this opportunity');
    }
    const now = new Date();
    const applicationId = createHash('sha256').update(JSON.stringify([String(rid), aid])).digest('hex').slice(0, 24);
    const { ObjectId } = await import('mongodb');
    const doc = {
      _id: new ObjectId(applicationId),
      referralId: rid,
      applicantAuthId: aid,
      email,
      name: name || '',
      note: String(note || '').slice(0, 1000),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    try { const result = await applicationsCollection.insertOne(doc); return { ...doc, _id: result.insertedId }; }
    catch (error) { if (error.code === 11000) throw new Error('You already applied to this opportunity'); throw error; }
  },

  async findByReferral(referralId) {
    try {
      return await applicationsCollection
        .find({ referralId: await toObjectId(referralId) })
        .sort({ createdAt: -1 })
        .toArray();
    } catch {
      return [];
    }
  },

  async findMine(authId) {
    return await applicationsCollection
      .find({ applicantAuthId: String(authId) })
      .sort({ createdAt: -1 })
      .toArray();
  },

  async findById(id) {
    try {
      return await applicationsCollection.findOne({ _id: await toObjectId(id) });
    } catch {
      return null;
    }
  },

  async updateStatus(id, status) {
    try {
      const objectId = await toObjectId(id);
      const result = await applicationsCollection.updateOne(
        { _id: objectId },
        { $set: { status, updatedAt: new Date() } }
      );
      if (!result.matchedCount) return null;
      return await applicationsCollection.findOne({ _id: objectId });
    } catch {
      return null;
    }
  },
};

return { ReferralModel, ReferralApplicationModel };
};
const { ReferralModel, ReferralApplicationModel } = createReferralModels(client.db('SielAlumni'));
export { ReferralModel, ReferralApplicationModel };
export default { ReferralModel, ReferralApplicationModel, REFERRAL_TYPES, APPLICATION_STATUSES };
