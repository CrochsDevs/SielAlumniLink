import express from 'express';
import { listEvents, getEvent, createEvent, updateEvent, deleteEvent } from './events.controllers.js';
import { protect, authorize } from '../../middlewares/auth.middleware.js';
import Roles from '../../constant/roles.js';
import { client } from '../../config/db.js';
import { createActivityService } from './events.registration.js';
import { createMeetingService } from '../meetings/meetings.service.js';

const router = express.Router();
const activities = createActivityService(client.db('SielAlumni'));
const meetings = createMeetingService(client.db('SielAlumni'));
const action = handler => async (req, res) => {
  try { res.json({ success: true, data: await handler(req) }); }
  catch (error) { res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to process the activity. Please try again.' }); }
};

router.use(protect);

// Calendar: any logged-in role.
router.get('/', listEvents);
router.get('/:id', getEvent);
router.post('/:id/register', action(req => activities.register(req.user, req.params.id)));
router.get('/:id/participants', authorize(Roles.ADMIN), action(req => activities.roster(req.user, req.params.id)));
router.post('/:id/participants/:authId/check-in', authorize(Roles.ADMIN), action(req => activities.checkIn(req.user, req.params.id, req.params.authId)));
router.post('/:id/participants/:authId/certificate', authorize(Roles.ADMIN), action(async req => {
  const event = await activities.eventFor(req.user, req.params.id);
  return event.deliveryMode === 'online' ? meetings.certify(req.user, req.params.id, req.params.authId) : activities.certifyOnsite(req.user, req.params.id, req.params.authId);
}));

// Management: admin only.
router.post('/', authorize(Roles.ADMIN), createEvent);
router.put('/:id', authorize(Roles.ADMIN), updateEvent);
router.delete('/:id', authorize(Roles.ADMIN), deleteEvent);

export default router;
