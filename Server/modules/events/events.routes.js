import express from 'express';
import { listEvents, getEvent, createEvent, updateEvent, deleteEvent } from './events.controllers.js';
import { protect, authorize } from '../../middlewares/auth.middleware.js';
import Roles from '../../constant/roles.js';

const router = express.Router();

router.use(protect);

// Calendar: any logged-in role.
router.get('/', listEvents);
router.get('/:id', getEvent);

// Management: admin only.
router.post('/', authorize(Roles.ADMIN), createEvent);
router.put('/:id', authorize(Roles.ADMIN), updateEvent);
router.delete('/:id', authorize(Roles.ADMIN), deleteEvent);

export default router;
