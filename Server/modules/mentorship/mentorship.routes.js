import express from 'express';
import { client } from '../../config/db.js';
import { protect, authorize } from '../../middlewares/auth.middleware.js';
import { createMentorshipService } from './mentorship.service.js';
import { createMatchingService } from './matching.service.js';

const service = createMentorshipService(client.db('SielAlumni'));
export function createMentorshipRouter(progressService = service, matchingService = createMatchingService(client.db('SielAlumni'))) {
  const router = express.Router();
  router.use(protect, authorize('student', 'alumni'));
  const action = task => async (req, res) => {
    try { res.status(200).json({ success: true, data: await task(req) }); }
    catch (error) { res.status(error.status || 500).json({ success: false, message: error.message }); }
  };
  router.get('/me', action(req => progressService.list(req.user)));
  router.get('/matches', authorize('student'), action(req => matchingService.get(req.user)));
  router.put('/matches/preferences', authorize('student'), action(req => matchingService.save(req.user, req.body)));
  router.get('/:connectionId', action(req => progressService.get(req.user, req.params.connectionId)));
  router.put('/:connectionId/goals/:key', action(req => progressService.update(req.user, req.params.connectionId, req.params.key, req.body)));
  return router;
}
export default createMentorshipRouter();
