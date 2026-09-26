import { client } from '../../config/db.js';

const db = client.db('SielAlumni');
const usersCollection = db.collection('users');

export const UserModel = {
  async create(userData) {
    const newUser = {
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await usersCollection.insertOne(newUser);
    return { ...newUser, _id: result.insertedId };
  },

  async findByEmail(email) {
    return await usersCollection.findOne({ email });
  },

  async findByAuthId(authId) {
    return await usersCollection.findOne({ authId: authId });
  },

  async findById(id) {
    const { ObjectId } = await import('mongodb');
    return await usersCollection.findOne({ _id: new ObjectId(id) });
  },

  async findAll() {
    return await usersCollection.find({}).toArray();
  },

  async updateById(id, updateData) {
    const { ObjectId } = await import('mongodb');
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...updateData, updatedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  },

  async deleteById(id) {
    const { ObjectId } = await import('mongodb');
    const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  },

  async createUserProfile(authUserId, profileData) {
    const userProfile = {
      authId: authUserId,
      ...profileData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await usersCollection.insertOne(userProfile);
    return { ...userProfile, _id: result.insertedId };
  }
};

export default UserModel;