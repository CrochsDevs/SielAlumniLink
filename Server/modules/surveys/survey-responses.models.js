import { client } from '../../config/db.js';

const db = client.db('SielAlumni');
const responsesCollection = db.collection('survey_responses');

const toObjectId = async (id) => {
  const { ObjectId } = await import('mongodb');
  return id instanceof ObjectId ? id : new ObjectId(id);
};

// One response per account per survey (upsert — resubmitting updates).
export const SurveyResponseModel = {
  async submit({ surveyId, authId, email, answers }) {
    const sid = await toObjectId(surveyId);
    let aid = authId;
    try {
      aid = await toObjectId(authId);
    } catch {
      // keep raw value
    }
    const now = new Date();
    await responsesCollection.updateOne(
      { surveyId: sid, authId: aid },
      {
        $set: { answers, email, updatedAt: now },
        $setOnInsert: { surveyId: sid, authId: aid, createdAt: now },
      },
      { upsert: true }
    );
    return await responsesCollection.findOne({ surveyId: sid, authId: aid });
  },

  async findBySurvey(surveyId) {
    try {
      return await responsesCollection
        .find({ surveyId: await toObjectId(surveyId) })
        .sort({ updatedAt: -1 })
        .toArray();
    } catch {
      return [];
    }
  },

  async findMine(surveyId, authId) {
    try {
      const sid = await toObjectId(surveyId);
      let aid = authId;
      try {
        aid = await toObjectId(authId);
      } catch {
        // keep raw value
      }
      return await responsesCollection.findOne({ surveyId: sid, authId: aid });
    } catch {
      return null;
    }
  },
};

export default SurveyResponseModel;
