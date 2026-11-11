import { client } from '../../config/db.js';
import { resetTokenHash } from '../auth/password-reset.js';

const db = client.db('SielAlumni');
const magicLinkCollection = db.collection('magic_links');

export async function ensureMagicLinkIndexes(database) {
  await database.collection('magic_links').createIndex({ tokenHash: 1 }, { unique: true, sparse: true });
  await database.collection('magic_links').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}

export const MagicLinkModel = {
  async create(magicLinkData) {
    const { token, ...data } = magicLinkData;
    const tokenHash = resetTokenHash(token);
    if (!tokenHash) throw new TypeError('Invalid login credential');
    const newMagicLink = {
      ...data,
      tokenHash,
      createdAt: new Date(),
    };
    const result = await magicLinkCollection.insertOne(newMagicLink);
    return { ...newMagicLink, _id: result.insertedId };
  },

  async findByToken(token) {
    const tokenHash = resetTokenHash(token);
    return tokenHash ? await magicLinkCollection.findOne({ tokenHash }) : null;
  },

  async findByEmail(email) {
    return await magicLinkCollection.findOne({ email });
  },

  async deleteByEmail(email) {
    return await magicLinkCollection.deleteMany({ email });
  },

  async deleteToken(token) {
    const tokenHash = resetTokenHash(token);
    return tokenHash ? await magicLinkCollection.deleteOne({ tokenHash }) : { deletedCount: 0 };
  },

  async claimToken(token) {
    const tokenHash = resetTokenHash(token);
    if (!tokenHash) return null;
    return await magicLinkCollection.findOneAndUpdate(
      { tokenHash, usedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { usedAt: new Date(), updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
  },

  async markAsUsed(token) {
    const tokenHash = resetTokenHash(token);
    if (!tokenHash) return { modifiedCount: 0 };
    return await magicLinkCollection.updateOne(
      { tokenHash },
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
