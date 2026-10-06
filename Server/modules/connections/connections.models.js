import { client } from '../../config/db.js';

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
    const usersCollection = db.collection('users');
    
    const enriched = await Promise.all(connections.map(async (conn) => {
      const [requester, recipient] = await Promise.all([
        usersCollection.findOne({ email: conn.requesterEmail }),
        usersCollection.findOne({ email: conn.recipientEmail }),
      ]);
      return {
        ...conn,
        requesterRole: requester?.role || null,
        recipientRole: recipient?.role || null,
        requesterName: requester?.name || null,
        recipientName: recipient?.name || null,
        requesterAuthId: requester?.authId || null,
        recipientAuthId: recipient?.authId || null,
        requesterProfileId: requester?._id ? String(requester._id) : null,
        recipientProfileId: recipient?._id ? String(recipient._id) : null,
      };
    }));
    
    return enriched;
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
