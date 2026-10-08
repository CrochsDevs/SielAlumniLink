import { client } from '../../config/db.js';
import { ObjectId } from 'mongodb';
import { enrichConnections } from './connections.directory.js';

const db = client.db('SielAlumni');
const connectionsCollection = db.collection('connections');

const toObjectId = async (id) => {
  const { ObjectId } = await import('mongodb');
  return id instanceof ObjectId ? id : new ObjectId(id);
};

const normalizeId = async (id) => {
  try {
    return await toObjectId(id);
  } catch {
    return id;
  }
};

export const ConnectionModel = {
  async findById(id) {
    if (!ObjectId.isValid(id)) return null;
    return connectionsCollection.findOne({ _id: new ObjectId(id) });
  },
  // A requests to connect with B (by auth id). No duplicates, no self-connect.
  async request(requesterAuthId, requesterEmail, recipientAuthId, recipientEmail) {
    const from = await normalizeId(requesterAuthId);
    const to = await normalizeId(recipientAuthId);

    if (String(from) === String(to)) {
      throw new Error('You cannot connect with yourself');
    }

    const existing = await connectionsCollection.findOne({
      $or: [
        { requesterAuthId: from, recipientAuthId: to },
        { requesterAuthId: to, recipientAuthId: from },
      ],
    });
    if (existing) {
      throw new Error('Connection already exists');
    }

    const now = new Date();
    const doc = {
      requesterAuthId: from,
      requesterEmail,
      recipientAuthId: to,
      recipientEmail,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    const result = await connectionsCollection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  },

  async findMine(authId) {
    const id = await normalizeId(authId);
    return await connectionsCollection
      .find({ $or: [{ requesterAuthId: id }, { recipientAuthId: id }] })
      .sort({ updatedAt: -1 })
      .toArray();
  },

  async findAll() {
    const connections = await connectionsCollection.find({}).sort({ updatedAt: -1 }).toArray();
    if (!connections.length) return [];
    const ids = [...new Set(connections.flatMap(c => [c.requesterAuthId, c.recipientAuthId]).filter(Boolean).map(String))];
    const idValues = ids.flatMap(id => ObjectId.isValid(id) ? [id, new ObjectId(id)] : [id]);
    const emails = [...new Set(connections.flatMap(c => [c.requesterEmail, c.recipientEmail]).filter(Boolean))];
    const accounts = await db.collection('auth').find({
      $or: [{ _id: { $in: idValues } }, { email: { $in: emails } }],
    }, { projection: { _id: 1, email: 1, role: 1, name: 1 } }).toArray();
    const profileIds = [...idValues, ...accounts.flatMap(account => [account._id, String(account._id)])];
    const profileEmails = [...emails, ...accounts.map(account => account.email).filter(Boolean)];
    const profiles = await db.collection('users').find({
      $or: [{ authId: { $in: profileIds } }, { email: { $in: profileEmails } }],
    }, { projection: { _id: 1, authId: 1, name: 1, email: 1, role: 1 } }).sort({ updatedAt: -1, _id: 1 }).toArray();
    return enrichConnections(connections, accounts, profiles);
  },

  async updateStatus(id, status) {
    try {
      const objectId = await toObjectId(id);
      const result = await connectionsCollection.updateOne(
        { _id: objectId },
        { $set: { status, updatedAt: new Date() } }
      );
      if (!result.matchedCount) return null;
      return await connectionsCollection.findOne({ _id: objectId });
    } catch {
      return null;
    }
  },

  async deleteById(id) {
    try {
      const result = await connectionsCollection.deleteOne({ _id: await toObjectId(id) });
      return result.deletedCount > 0;
    } catch {
      return false;
    }
  },
};

export default ConnectionModel;
