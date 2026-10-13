import { createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { client } from '../../config/db.js';

const applications = client.db('SielAlumni').collection('job_applications');
const summary = { resumeData: 0 };
export default {
  async create(data) {
    const _id = new ObjectId(createHash('sha256').update(`${data.jobId}:${data.applicantAuthId}`).digest('hex').slice(0, 24));
    const doc = { ...data, _id, status: 'submitted', createdAt: new Date() };
    await applications.insertOne(doc);
    const { resumeData, ...result } = doc;
    return result;
  },
  findMine(authId) { return applications.find({ applicantAuthId: String(authId) }, { projection: summary }).sort({ createdAt: -1 }).toArray(); },
  findByJob(jobId) { return applications.find({ jobId: String(jobId) }, { projection: summary }).sort({ createdAt: -1 }).toArray(); },
  findById(id) { return ObjectId.isValid(id) ? applications.findOne({ _id: new ObjectId(id) }) : null; },
};
