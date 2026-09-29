import express from 'express';
import { listNotifications, getUnreadCount, markRead, markAllRead } from './notifications.controllers.js';
import { protect } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/', listNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/read-all', markAllRead);
router.put('/:id/read', markRead);

export default router;
