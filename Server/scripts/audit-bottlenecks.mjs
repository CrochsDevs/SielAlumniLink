// Read-only diagnostics. Prints query statistics, never account IDs or document data.
import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { performance } from 'node:perf_hooks';

const client = new MongoClient(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, socketTimeoutMS: 5000,
});
const planStages = plan => {
  const stages = new Set();
  const walk = node => {
    if (!node || typeof node !== 'object') return;
    if (node.stage) stages.add(node.stage);
    Object.values(node).forEach(value => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
    });
  };
  walk(plan);
  return [...stages];
};
try {
  await client.connect();
  const db = client.db('SielAlumni');
  const pingMs = [];
  for (let index = 0; index < 3; index++) {
    const started = performance.now();
    await db.command({ ping: 1 });
    pingMs.push(Math.round(performance.now() - started));
  }
  const conversation = await db.collection('conversations').findOne({}, { projection: { _id: 1, participants: 1 } });
  const owner = String(conversation?.participants?.[0]?.authId || 'unmatched-performance-probe');
  const queries = [
    ['conversation-list', 'conversations', { 'participants.authId': owner }, { updatedAt: -1 }, 20],
    ['upcoming-dashboard-events', 'events', { isActive: true, startAt: { $gte: new Date() } }, { startAt: 1 }, 3],
    ['report-login-window', 'activity_logs', { action: 'login', createdAt: { $gte: new Date(`${new Date().getUTCFullYear()}-01-01`) } }, {}, 20],
    ['published-activities', 'events', { isActive: true }, { createdAt: -1, _id: -1 }, 20],
    ['pending-certificates', 'student_event_attendance', { certificateId: { $exists: false } }, { date: -1 }, 20],
  ];
  if (conversation) queries.push(['latest-chat-preview', 'messages', { conversationId: conversation._id, senderAuthId: { $ne: owner } }, { createdAt: -1, _id: -1 }, 1]);
  const results = [];
  for (const [label, collection, filter, sort, limit] of queries) {
    const result = await db.collection(collection).find(filter).sort(sort).limit(limit).maxTimeMS(3000).explain('executionStats');
    results.push({ label, estimatedCollectionSize: await db.collection(collection).estimatedDocumentCount({ maxTimeMS: 3000 }),
      stages: planStages(result.queryPlanner?.winningPlan), returned: result.executionStats?.nReturned,
      docsExamined: result.executionStats?.totalDocsExamined, keysExamined: result.executionStats?.totalKeysExamined,
      executionMs: result.executionStats?.executionTimeMillis });
  }
  console.log(JSON.stringify({ pingMs, results, scope: 'Limited read-only query samples; not a concurrent-user capacity test.' }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ diagnostic: 'unavailable', type: error.name, code: error.code || null }));
  process.exitCode = 1;
} finally {
  await client.close();
}
