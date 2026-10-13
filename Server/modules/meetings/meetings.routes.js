import express from 'express';
import { client } from '../../config/db.js';
import { protect, authorize } from '../../middlewares/auth.middleware.js';
import { createMeetingService } from './meetings.service.js';
import { endMeetingRoom } from './meetings.socket.js';
const router = express.Router();
const service = createMeetingService(client.db('SielAlumni'));
const action = handler => async (req, res) => {
  try { res.json({ success: true, data: await handler(req) }); }
  catch (error) { res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to process the meeting. Please try again.' }); }
};
router.use(protect);
router.get('/config', action(() => ({ iceServers: JSON.parse(process.env.WEBRTC_ICE_SERVERS || '[{"urls":"stun:stun.l.google.com:19302"}]') })));
router.get('/:id', action(req => service.details(req.user, req.params.id)));
router.post('/:id/register', action(req => service.register(req.user, req.params.id)));
router.post('/:id/start', authorize('admin'), action(req => service.start(req.user, req.params.id)));
router.post('/:id/end', authorize('admin'), action(async req => { await endMeetingRoom(req.params.id, req.user); await service.end(req.user, req.params.id); return { ended: true }; }));
router.get('/:id/participants', authorize('admin'), action(req => service.roster(req.user, req.params.id)));
router.post('/:id/participants/:authId/certificate', authorize('admin'), action(req => service.certify(req.user, req.params.id, req.params.authId)));
export default router;
