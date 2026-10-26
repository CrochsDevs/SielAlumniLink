import express from 'express';
import { listConversations, openConversation, listMessages, sendMessage, createGroup, renameGroup, editMessage, unsendMessage } from './messages.controllers.js';
import { protect } from '../../middlewares/auth.middleware.js';
import { listGroupMembers, groupCandidates, addGroupMembers, promoteGroupAdmin, leaveGroup, removeGroupMember } from './messages.controllers.js';

const router = express.Router();

router.use(protect);

router.get('/', listConversations);
router.post('/', openConversation);
router.post('/group', createGroup);
router.patch('/:id/name', renameGroup);
router.get('/:id/members', listGroupMembers);
router.get('/:id/candidates', groupCandidates);
router.post('/:id/members', addGroupMembers);
router.post('/:id/admins', promoteGroupAdmin);
router.post('/:id/leave', leaveGroup);
router.delete('/:id/members/:authId', removeGroupMember);
router.get('/:id/messages', listMessages);
router.post('/:id/messages', sendMessage);
router.put('/messages/:msgId', editMessage);
router.delete('/messages/:msgId', unsendMessage);

export default router;
