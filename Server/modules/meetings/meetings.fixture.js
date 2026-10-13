// In-memory persistence for automated checks. Never connects to a real database.
import { ObjectId } from 'mongodb';
export const host = { _id: new ObjectId('cccccccccccccccccccccccc'), authId: 'cccccccccccccccccccccccc', name: 'Admin Host', email: 'host@example.test', role: 'admin', passwordSetupRequired: false };
export const student = { _id: new ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa'), authId: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Alex Santos', email: 'student@example.test', role: 'student', passwordSetupRequired: false };
export const stranger = { _id: new ObjectId('bbbbbbbbbbbbbbbbbbbbbbbb'), authId: 'bbbbbbbbbbbbbbbbbbbbbbbb', name: 'Jamie Cruz', email: 'jamie@example.test', role: 'student', passwordSetupRequired: false };
export const event = { _id: new ObjectId('eeeeeeeeeeeeeeeeeeeeeeee'), title: 'Web Accessibility Workshop', description: 'A practical online session on building accessible websites.', activityType: 'training', deliveryMode: 'online', organizer: 'CLSU Career Development', location: '', startAt: new Date(Date.now() - 3600000), endAt: new Date(Date.now() + 3600000), isActive: true };
const equal = (left, right) => String(left) === String(right);
export function createMemoryDb() {
  const buckets = new Map();
  const bucket = name => { if (!buckets.has(name)) buckets.set(name, new Map()); return buckets.get(name); };
  const matches = (doc, query) => Object.entries(query).every(([key, value]) => key === '$or' ? value.some(part => matches(doc, part)) : value?.$in ? value.$in.some(item => equal(doc[key], item)) : value && Object.hasOwn(value, '$exists') ? Object.hasOwn(doc, key) === value.$exists : value && Object.hasOwn(value, '$ne') ? !equal(doc[key], value.$ne) : equal(doc[key], value));
  const db = { collection(name) {
    const records = bucket(name);
    return {
      findOne: async query => [...records.values()].find(doc => matches(doc, query)) || null,
      find(query) {
        let result = [...records.values()].filter(doc => matches(doc, query));
        const cursor = { sort(order) { const [key, direction] = Object.entries(order)[0]; result.sort((a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * direction); return cursor; }, limit(count) { result = result.slice(0, count); return cursor; }, toArray: async () => result };
        return cursor;
      },
      async insertOne(doc) { if (records.has(String(doc._id))) throw Object.assign(new Error('duplicate'), { code: 11000 }); records.set(String(doc._id), { ...doc }); return { insertedId: doc._id }; },
      async updateOne(query, update, options = {}) {
        let doc = [...records.values()].find(item => matches(item, query));
        if (!doc && !options.upsert) return { matchedCount: 0 };
        if (!doc) {
          if (records.has(String(query._id))) throw Object.assign(new Error('duplicate'), { code: 11000 });
          doc = { _id: query._id, ...update.$setOnInsert }; records.set(String(doc._id), doc);
        }
        Object.assign(doc, update.$set);
        for (const [key, value] of Object.entries(update.$inc || {})) doc[key] = (doc[key] || 0) + value;
        for (const [key, value] of Object.entries(update.$addToSet || {})) { if (!doc[key]) doc[key] = []; if (!doc[key].includes(value)) doc[key].push(value); }
        return { matchedCount: 1 };
      },
    };
  } };
  const seed = (name, doc) => bucket(name).set(String(doc._id), { ...doc });
  for (const user of [host, student, stranger]) { seed('auth', user); seed('users', { ...user, authId: String(user._id) }); }
  seed('events', event);
  return { db, seed, bucket };
}
