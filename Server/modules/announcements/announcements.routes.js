import express from 'express';
import { listAnnouncements, getAnnouncement, createAnnouncement, updateAnnouncement, deleteAnnouncement } from './announcements.controllers.js';
import { protect, authorize } from '../../middlewares/auth.middleware.js';
import Roles from '../../constant/roles.js';

const router = express.Router();

router.use(protect);

// Board: any logged-in role.
router.get('/', listAnnouncements);
router.get('/:id', getAnnouncement);

// Management: admin only.
router.post('/', authorize(Roles.ADMIN), createAnnouncement);
router.put('/:id', authorize(Roles.ADMIN), updateAnnouncement);
router.delete('/:id', authorize(Roles.ADMIN), deleteAnnouncement);

export default router;
