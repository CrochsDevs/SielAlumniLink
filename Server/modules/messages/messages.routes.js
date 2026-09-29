import express from 'express';
import { listConversations, openConversation, listMessages, sendMessage, createGroup, editMessage, unsendMessage } from './messages.controllers.js';
import { protect } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/', listConversations);
router.post('/', openConversation);
router.post('/group', createGroup);
router.get('/:id/messages', listMessages);
router.post('/:id/messages', sendMessage);
router.put('/messages/:msgId', editMessage);
router.delete('/messages/:msgId', unsendMessage);

export default router;
