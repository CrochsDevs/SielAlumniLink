import express from 'express';
import { client } from '../../config/db.js';
import { protect, authorize } from '../../middlewares/auth.middleware.js';
import { createDevelopmentService } from './development.service.js';
const router = express.Router();
const service = createDevelopmentService(client.db('SielAlumni'));
const action = handler => async (req, res) => {
  try { req.body ??= {}; res.json({ success: true, data: await handler(req) }); }
  catch (error) { res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to save or load your records. Please try again.' }); }
};
router.use(protect, authorize('student', 'alumni', 'admin'));
router.get('/mentees', authorize('alumni'), action(req => service.listMentees(req.user)));
router.get('/mentees/:studentId/competencies', authorize('alumni'), action(req => service.menteeCompetencies(req.user, req.params.studentId)));
router.put('/mentees/:studentId/competencies/:key', authorize('alumni'), action(req => service.evaluateCompetency(req.user, req.params.studentId, req.params.key, req.body)));
router.get('/me', action(req => service.snapshot(req.user)));
router.put('/competencies/:key', action(req => service.saveCompetency(req.user, req.params.key, req.body)));
router.delete('/competencies/:key', action(req => service.resetCompetency(req.user, req.params.key)));
router.put('/academic', action(req => service.saveAcademic(req.user, req.body)));
router.post('/events', action(req => service.addEvent(req.user, req.body)));
router.delete('/events/:id', action(req => service.removeEvent(req.user, req.params.id)));
router.post('/internships', action(req => service.saveInternship(req.user, req.body)));
router.put('/internships/:id', action(req => service.saveInternship(req.user, req.body, req.params.id)));
router.delete('/internships/:id', action(req => service.removeInternship(req.user, req.params.id)));
router.put('/portfolio/:section', action(req => service.savePortfolio(req.user, req.params.section, req.body.entries)));
export default router;
