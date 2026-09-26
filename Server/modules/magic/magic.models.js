import { client } from '../../config/db.js';

const db = client.db('SielAlumni');
const magicLinkCollection = db.collection('magic_links');

export const MagicLinkModel = {
  async create(magicLinkData) {
    const newMagicLink = {
      ...magicLinkData,
      createdAt: new Date(),
    };
    const result = await magicLinkCollection.insertOne(newMagicLink);
    return { ...newMagicLink, _id: result.insertedId };
  },

  async findByToken(token) {
    return await magicLinkCollection.findOne({ token });
  },

  async findByEmail(email) {
    return await magicLinkCollection.findOne({ email });
  },

  async deleteByEmail(email) {
    return await magicLinkCollection.deleteMany({ email });
  },

  async claimToken(token) {
    return await magicLinkCollection.findOneAndUpdate(
      { token, usedAt: null },
      { $set: { usedAt: new Date(), updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
  },

  async markAsUsed(token) {
    return await magicLinkCollection.updateOne(
      { token },
      { $set: { usedAt: new Date(), updatedAt: new Date() } }
    );
  },

  async deleteExpired() {
    return await magicLinkCollection.deleteMany({
      expiresAt: { $lt: new Date() }
    });
  }
};

export default MagicLinkModel;