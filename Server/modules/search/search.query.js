import { ObjectId } from 'mongodb';
import { queryGrams } from './search.names.js';

export const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function parseSearch(input, suggestions = false) {
  if (input.q !== undefined && typeof input.q !== 'string') throw new Error('Search must be text.');
  const q = (input.q || '').trim().replace(/\s+/g, ' ');
  if (q.length > 120) throw new Error('Search must be 120 characters or fewer.');
  const category = suggestions ? 'people' : (input.category || 'all');
  const sort = suggestions ? 'relevant' : (input.sort || 'relevant');
  if (!['all', 'people', 'posts', 'students', 'alumni'].includes(category)) throw new Error('Invalid search category.');
  if (!['relevant', 'active', 'newest'].includes(sort)) throw new Error('Invalid search sort.');
  const page = suggestions ? 1 : Number(input.page ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 1000) throw new Error('Page must be between 1 and 1000.');
  return { q, category, sort, page, limit: suggestions ? 6 : 10 };
}

const text = (field) => ({ $convert: { input: field, to: 'string', onNull: '', onError: '' } });
const matches = (field, regex) => ({ $regexMatch: { input: text(field), regex, options: 'i' } });
const score = (field, q) => ({ $switch: { branches: [
  { case: matches(field, `^${escapeRegex(q)}$`), then: 100 },
  { case: matches(field, `^${escapeRegex(q)}`), then: 80 },
  { case: matches(field, escapeRegex(q)), then: 60 },
], default: 20 } });
const pageFacet = ({ page, limit }, projection) => ({ $facet: {
  count: [{ $count: 'total' }],
  items: [{ $skip: (page - 1) * limit }, { $limit: limit }, { $project: projection }],
} });

// Explicit allowlist: credentials, contact details and private profile fields never leave search.
const personProjection = {
  _id: 1, authId: 1, name: 1, role: 1, program: 1, batch: 1, profilePicture: 1,
  position: '$job.position', company: '$job.company', connectionStatus: 1, canConnect: 1,
};

export function buildPeoplePipeline(options, viewer) {
  const { q, category, sort } = options;
  const tokens = [...new Set(q.split(' '))].map(escapeRegex);
  const role = category === 'students' ? 'student' : category === 'alumni' ? 'alumni' : null;
  const viewerIds = [String(viewer._id), new ObjectId(String(viewer._id))];
  return [
    { $match: { searchNameGrams: { $all: queryGrams(q) }, $and: tokens.map(token => ({ name: { $regex: token, $options: 'i' } })) } },
    { $set: { accountId: { $convert: { input: '$authId', to: 'objectId', onError: null, onNull: null } } } },
    { $lookup: { from: 'auth', localField: 'accountId', foreignField: '_id', as: 'account' } },
    { $unwind: '$account' },
    { $match: { 'account.disabledAt': null } },
    { $set: { role: { $toLower: '$account.role' }, authId: { $toString: '$account._id' } } },
    { $match: { role: role || { $in: ['student', 'alumni'] } } },
    { $sort: { updatedAt: -1, _id: 1 } },
    { $group: { _id: '$authId', profile: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$profile' } },
    { $set: { relevance: score('$name', q), job: { $arrayElemAt: [{ $filter: {
      input: { $ifNull: ['$employmentHistory', []] }, as: 'job', cond: { $eq: ['$$job.current', true] },
    } }, 0] } } },
    ...(sort === 'active' ? [
      { $lookup: { from: 'activity_logs', localField: 'authId', foreignField: 'authId', pipeline: [
        { $match: { action: 'login' } }, { $sort: { createdAt: -1 } }, { $limit: 1 }, { $project: { createdAt: 1 } },
      ], as: 'activity' } },
      { $set: { lastActive: { $ifNull: [{ $arrayElemAt: ['$activity.createdAt', 0] }, '$updatedAt'] } } },
    ] : []),
    { $sort: sort === 'active' ? { lastActive: -1, relevance: -1, _id: 1 } : { relevance: -1, name: 1, _id: 1 } },
    { $facet: {
      count: [{ $count: 'total' }],
      items: [
        { $skip: (options.page - 1) * options.limit }, { $limit: options.limit },
        { $lookup: { from: 'connections', let: { target: '$authId' }, pipeline: [
          { $match: { $or: [{ requesterAuthId: { $in: viewerIds } }, { recipientAuthId: { $in: viewerIds } }] } },
          { $match: { $expr: { $or: [
            { $and: [{ $eq: [{ $toString: '$requesterAuthId' }, String(viewer._id)] }, { $eq: [{ $toString: '$recipientAuthId' }, '$$target'] }] },
            { $and: [{ $eq: [{ $toString: '$recipientAuthId' }, String(viewer._id)] }, { $eq: [{ $toString: '$requesterAuthId' }, '$$target'] }] },
          ] } } }, { $sort: { updatedAt: -1 } }, { $limit: 1 }, { $project: { status: 1 } },
        ], as: 'relationship' } },
        { $set: { connectionStatus: { $ifNull: [{ $arrayElemAt: ['$relationship.status', 0] }, 'none'] },
          canConnect: { $and: [
            { $ne: ['$authId', String(viewer._id)] },
            { $not: [{ $and: [{ $eq: [{ $literal: String(viewer.role).toLowerCase() }, 'student'] }, { $eq: ['$role', 'student'] }] }] },
            { $eq: [{ $size: '$relationship' }, 0] },
          ] },
        } }, { $project: personProjection },
      ],
    } },
  ];
}

export function buildPostsPipeline(options) {
  const { q, sort } = options;
  const tokens = [...new Set(q.split(' '))].map(escapeRegex);
  const phrase = escapeRegex(q);
  return [
    // Existing career posts are visible to all authenticated roles, only while active.
    { $match: { isActive: true } },
    { $set: { authorId: { $convert: { input: '$authorAuthId', to: 'objectId', onError: null, onNull: null } } } },
    { $lookup: { from: 'auth', localField: 'authorId', foreignField: '_id', as: 'account' } },
    { $unwind: { path: '$account', preserveNullAndEmptyArrays: true } },
    { $set: { authorKeys: ['$authorId', { $toString: '$authorAuthId' }] } },
    { $lookup: { from: 'users', localField: 'authorKeys', foreignField: 'authId', pipeline: [
      { $sort: { updatedAt: -1, _id: 1 } }, { $limit: 1 },
      { $project: { name: 1, profilePicture: 1, role: 1 } },
    ], as: 'profile' } },
    { $set: { author: { $arrayElemAt: ['$profile', 0] },
      authorName: { $ifNull: [{ $arrayElemAt: ['$profile.name', 0] }, '$authorName'] },
      searchable: { $concat: [text('$title'), ' ', text('$body'), ' ', { $reduce: {
        input: { $ifNull: ['$tags', []] }, initialValue: '', in: { $concat: ['$$value', ' ', text('$$this')] },
      } }] },
    } },
    { $match: { $or: [
      { authorName: { $regex: tokens.join('|'), $options: 'i' } },
      { searchable: { $regex: tokens.join('|'), $options: 'i' } },
    ] } },
    { $set: { relevance: { $add: [
      { $cond: [matches('$authorName', `^${phrase}$`), 1000, { $cond: [matches('$authorName', phrase), 500, 0] }] },
      { $cond: [matches('$searchable', phrase), 200, 0] },
      ...tokens.map(token => ({ $cond: [{ $or: [matches('$authorName', token), matches('$searchable', token)] }, 10, 0] })),
    ] } } },
    { $sort: sort === 'newest' ? { createdAt: -1, relevance: -1, _id: 1 } : { relevance: -1, createdAt: -1, _id: 1 } },
    pageFacet(options, { _id: 1, title: 1, body: 1, tags: 1, createdAt: 1, type: 1,
      authorName: 1, authorProfileId: '$author._id', authorRole: '$account.role', profilePicture: '$author.profilePicture',
      savesCount: { $size: { $ifNull: ['$savedBy', []] } },
    }),
  ];
}
