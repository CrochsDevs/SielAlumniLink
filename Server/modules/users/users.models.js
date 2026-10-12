import { client } from '../../config/db.js';
import { nameGrams } from '../search/search.names.js';

const db = client.db('SielAlumni');
const usersCollection = db.collection('users');

export const UserModel = {
  async create(userData) {
    const newUser = {
      ...userData,
      searchNameGrams: nameGrams(userData.name),
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
    const { ObjectId } = await import('mongodb');
    const query = { authId };
    if (typeof authId === 'string' && /^[0-9a-fA-F]{24}$/.test(authId)) {
      query.$or = [
        { authId: authId },
        { authId: new ObjectId(authId) },
      ];
    }
    return await usersCollection.findOne(query);
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
    const hasOperators = Object.keys(updateData).some((k) => k.startsWith('$'));
    let updateDoc;
    if (hasOperators) {
      const ops = {};
      const setFields = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (key.startsWith('$')) ops[key] = value;
        else setFields[key] = value;
      }
      setFields.updatedAt = new Date();
      updateDoc = { ...ops, $set: setFields };
    } else {
      updateDoc = { $set: { ...updateData, updatedAt: new Date() } };
    }
    if (updateDoc.$set.name !== undefined) {
      updateDoc.$set.searchNameGrams = nameGrams(updateDoc.$set.name);
    }
      const filter = { _id: new ObjectId(id) };
      const skillLimitError = () => Object.assign(new Error('You can add up to 10 skills only'), { code: 'SKILL_LIMIT_EXCEEDED' });
      if (Array.isArray(updateDoc.$set.skills) && updateDoc.$set.skills.length > 10) throw skillLimitError();
      const skillAddition = updateDoc.$addToSet?.skills ?? updateDoc.$push?.skills;
      if (skillAddition !== undefined) {
        const additions = typeof skillAddition === 'string' ? [skillAddition] : skillAddition.$each;
        // Check the resulting array in the same database write, including concurrent requests.
        const operation = updateDoc.$addToSet?.skills !== undefined ? '$setUnion' : '$concatArrays';
        filter.$expr = { $lte: [{ $size: { [operation]: [{ $ifNull: ['$skills', []] }, { $literal: additions }] } }, 10] };
      }
      const result = await usersCollection.updateOne(
        filter,
      updateDoc
    );
      if (skillAddition !== undefined && result.matchedCount === 0) throw skillLimitError();
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
      searchNameGrams: nameGrams(profileData.name),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await usersCollection.insertOne(userProfile);
    return { ...userProfile, _id: result.insertedId };
  }
};

export default UserModel;
