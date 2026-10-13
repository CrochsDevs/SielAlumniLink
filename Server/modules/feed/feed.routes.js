import express from 'express';
import { client } from '../../config/db.js';
import { protect } from '../../middlewares/auth.middleware.js';
import { getIO, emitToUser } from '../../realtime/socket.js';
import { ConversationModel, MessageModel } from '../messages/messages.models.js';
import { createFeedService } from './feed.service.js';
import { fail } from './feed.policy.js';
import { createFeedImageDownload } from './feed.images.js';

const router = express.Router();
// Invalidation carries no private content or IDs. Every client reloads using
// current server permissions; this also handles lost events on reconnect.
const feed = createFeedService(client.db('SielAlumni'), () => getIO()?.emit('feed:changed'));
const action = (handler, status = 200) => async (req, res) => {
  try {
    req.body ??= {};
    res.status(status).json({ success: true, data: await handler(req) });
  }
  catch (error) { res.status(error.status || 500).json({ success: false,
    message: error.status ? error.message : 'Unable to complete the feed action. Please try again.' }); }
};

router.use(protect);
router.get('/status', action(req => feed.status(req.user)));
router.get('/restrictions', action(req => feed.listRestrictions(req.user)));
router.put('/restrictions/:authId', action(req => feed.restrictAuthor(req.user, req.params.authId, req.body)));
router.get('/', action(req => feed.list(req.user, req.query)));
router.post('/', action(req => feed.create(req.user, req.body), 201));
router.get('/:id', action(req => feed.get(req.user, req.params.id)));
router.get('/:id/images/:imageId', createFeedImageDownload(feed));
router.delete('/:id', action(req => feed.remove(req.user, req.params.id)));
router.put('/:id/moderation', action(req => feed.moderate(req.user, req.params.id, req.body)));
router.put('/:id/like', action(req => feed.setMembership(req.user, req.params.id, 'likedBy', req.body.liked)));
router.put('/:id/rsvp', action(req => feed.setMembership(req.user, req.params.id, 'attending', req.body.attending)));
router.get('/:id/comments', action(req => feed.listComments(req.user, req.params.id, req.query.before)));
router.post('/:id/comments', action(req => feed.comment(req.user, req.params.id, req.body.body), 201));
router.delete('/:id/comments/:commentId', action(req => feed.removeComment(req.user, req.params.id, req.params.commentId)));
router.post('/:id/share', action(req => feed.share(req.user, req.params.id, req.body), 201));
router.get('/:id/recipients', action(req => feed.recipients(req.user, req.params.id)));
router.post('/:id/send', action(async req => {
  const recipients = await feed.recipients(req.user, req.params.id);
  const recipient = recipients.find(p => p.authId === req.body.recipientAuthId);
  if (!recipient) fail(403, 'Choose a connected alumni who can view this post');
  const post = await feed.get(req.user, req.params.id);
  const convo = await ConversationModel.getOrCreate(req.user._id, req.user.email, recipient.authId, recipient.email);
  // Share a link instead of copying protected post content into a message.
  const origin = process.env.FRONTEND_URL || 'http://localhost:5173';
  const text = `Shared a post: ${origin}/feed?post=${post._id}`;
  const message = await MessageModel.create({ conversationId: convo._id, senderAuthId: req.user._id,
    senderEmail: req.user.email, text });
  const lastMessage = { text, at: message.createdAt, by: String(req.user._id) };
  await ConversationModel.touch(convo._id, lastMessage);
  convo.participants.forEach(p => emitToUser(p.authId, 'message:new', {
    conversationId: String(convo._id), message: { _id: message._id, text, at: message.createdAt,
      senderAuthId: String(req.user._id), senderEmail: req.user.email, attachment: null }, lastMessage,
  }));
  return { conversationId: convo._id, recipientEmail: recipient.email };
}, 201));

export default router;
