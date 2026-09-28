import express from 'express';
import { listConversations, openConversation, listMessages, sendMessage } from './messages.controllers.js';
import { protect } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/', listConversations);
router.post('/', openConversation);
router.get('/:id/messages', listMessages);
router.post('/:id/messages', sendMessage);

export default router;
