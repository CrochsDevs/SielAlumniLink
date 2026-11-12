import { client } from '../../config/db.js';
import { buildPeoplePipeline, buildPostsPipeline, parseSearch } from './search.query.js';
import { createFeedService } from '../feed/feed.service.js';

const db = client.db('SielAlumni');
export function createSearchHandler(database = db, suggestions = false) {
  const feed = createFeedService(database);
  return async (req, res) => {
    let options;
    try { options = parseSearch(req.query, suggestions); }
    catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    try {
      const empty = { items: [], total: 0, page: options.page, pages: 0 };
      const run = async (collection, pipeline) => {
        const [result] = await database.collection(collection).aggregate(pipeline, { maxTimeMS: 5000 }).toArray();
        const total = result?.count[0]?.total || 0;
        return { items: result?.items || [], total, page: options.page, pages: Math.ceil(total / options.limit) };
      };
      const [people, posts] = options.q ? await Promise.all([
        options.category !== 'posts' ? run('users', buildPeoplePipeline(options, req.user)) : empty,
        !suggestions && ['all', 'posts'].includes(options.category)
          ? feed.connectedIds(req.user).then(network => run('career_posts', buildPostsPipeline(options, req.user, network))) : empty,
      ]) : [empty, empty];
      res.json({ success: true, data: { query: options.q, people, posts } });
    } catch (error) {
      console.error('Search failed:', error.message);
      res.status(503).json({ success: false, message: 'Search is temporarily unavailable. Please try again.' });
    }
  };
}
