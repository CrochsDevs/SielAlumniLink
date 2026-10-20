import { SOURCES, TIMEZONE, requireAdmin, reportPeriod, summarizeEngagement, summarizeMentorship } from './reports.policy.js';
import { dashboardOverview } from './reports.overview.js';

export function createReportService(db, { now = () => new Date() } = {}) {
  return {
    async dashboard(user, query = {}) {
      requireAdmin(user);
      const generatedAt = new Date(now());
      const period = reportPeriod(query.date, generatedAt);
      const accounts = await db.collection('auth').find({ role: { $in: ['student', 'alumni', 'Student', 'Alumni', 'STUDENT', 'ALUMNI'] } }, { projection: { _id: 1, role: 1 } }).toArray();
      const memberIds = accounts.map(account => String(account._id));
      const students = accounts.filter(account => account.role.toLowerCase() === 'student').map(account => String(account._id));
      const alumni = accounts.filter(account => account.role.toLowerCase() === 'alumni').map(account => String(account._id));
      const asString = field => ({ $convert: { input: `$${field}`, to: 'string', onError: '', onNull: '' } });
      const [sourceRows, mentorshipRows, overview] = await Promise.all([
        Promise.all(SOURCES.map(async source => {
          const rows = await db.collection(source.collection).aggregate([
            { $match: { ...source.filter, [source.date]: { $gte: period.start, $lt: period.end } } },
            { $project: { actor: asString(source.actor), at: `$${source.date}` } },
            { $match: { actor: { $in: memberIds } } },
            { $group: { _id: { $dateToString: { date: '$at', format: '%Y-%m-%dT%H', timezone: TIMEZONE } }, count: { $sum: 1 }, actors: { $addToSet: '$actor' } } },
          ]).toArray();
          return rows.map(row => ({ source: source.key, hour: row._id, count: row.count, actors: row.actors }));
        })),
        db.collection('connections').aggregate([
          { $match: { status: { $in: ['accepted', 'pending', 'declined'] }, $expr: { $or: [
            { $and: [{ $in: [asString('requesterAuthId'), students] }, { $in: [asString('recipientAuthId'), alumni] }] },
            { $and: [{ $in: [asString('requesterAuthId'), alumni] }, { $in: [asString('recipientAuthId'), students] }] },
          ] } } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]).toArray(),
        dashboardOverview(db, user, generatedAt, alumni),
      ]);
      return { date: period.date, timezone: TIMEZONE, generatedAt: generatedAt.toISOString(),
        members: { students: students.length, alumni: alumni.length, total: memberIds.length },
        overview, engagement: summarizeEngagement(sourceRows.flat(), period), mentorship: summarizeMentorship(mentorshipRows) };
    },
  };
}
