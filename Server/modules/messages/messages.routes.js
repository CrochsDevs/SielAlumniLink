import express from 'express';
import multer from 'multer';
import { client } from '../../config/db.js';
import { cloudinary } from '../../config/cloudinary.js';
import { createMessageAttachmentDownload, MAX_CHAT_FILE_BYTES } from './message-attachments.js';
import { listConversations, openConversation, listMessages, sendMessage, createGroup, renameGroup, editMessage, unsendMessage } from './messages.controllers.js';
import { protect } from '../../middlewares/auth.middleware.js';
import { listGroupMembers, groupCandidates, addGroupMembers, promoteGroupAdmin, leaveGroup, removeGroupMember } from './messages.controllers.js';
import { deleteConversation, blockConversation, unblockConversation } from './messages.controllers.js';
import { markMessagesRead } from './messages.controllers.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_CHAT_FILE_BYTES, files: 1, fields: 3, fieldSize: 8000 } }).single('file');
const uploadAttachment = (req, res, next) => upload(req, res, error => {
  if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ success: false,
    message: error.code === 'LIMIT_FILE_SIZE' ? 'Choose a file up to 10 MB.' : 'Unable to upload this attachment.' });
  next();
});

router.use(protect);

router.get('/', listConversations);
router.post('/', openConversation);
router.post('/group', createGroup);
router.delete('/:id', deleteConversation);
router.post('/:id/block', blockConversation);
router.delete('/:id/block', unblockConversation);
router.patch('/:id/name', renameGroup);
router.get('/:id/members', listGroupMembers);
router.get('/:id/candidates', groupCandidates);
router.post('/:id/members', addGroupMembers);
router.post('/:id/admins', promoteGroupAdmin);
router.post('/:id/leave', leaveGroup);
router.delete('/:id/members/:authId', removeGroupMember);
router.get('/:id/messages', listMessages);
router.post('/:id/read', markMessagesRead);
router.post('/:id/messages', uploadAttachment, sendMessage);
router.get('/:id/messages/:messageId/attachment', createMessageAttachmentDownload(client.db('SielAlumni'), attachment => cloudinary.url(attachment.publicId,
  { resource_type: attachment.resourceType, type: 'authenticated', ...(attachment.format ? { format: attachment.format } : {}), secure: true, sign_url: true })));
router.put('/messages/:msgId', editMessage);
router.delete('/messages/:msgId', unsendMessage);

export default router;
