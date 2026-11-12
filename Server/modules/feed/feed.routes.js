import express from 'express';
import { client } from '../../config/db.js';
import { protect } from '../../middlewares/auth.middleware.js';
import { getIO, emitToUser } from '../../realtime/socket.js';
import { ConversationModel, MessageModel } from '../messages/messages.models.js';
import { createFeedService } from './feed.service.js';
import { createFeedMessaging } from './feed-messaging.js';
import { messageSenders } from '../messages/message-senders.js';
import { createFeedImageDownload } from './feed.images.js';
import NotificationModel from '../notifications/notifications.models.js';
import { createFeedNotifier } from './feed-notifications.js';

const router = express.Router();
// Invalidation carries no private content or IDs. Every client reloads using
// current server permissions; this also handles lost events on reconnect.
const feed = createFeedService(client.db('SielAlumni'), () => getIO()?.emit('feed:changed'),
  createFeedNotifier({ notifications: NotificationModel, emit: emitToUser }));
const messaging = createFeedMessaging({ feed, conversations: ConversationModel, messages: MessageModel,
  senders: messageSenders, emit: emitToUser, origin: process.env.FRONTEND_URL || 'http://localhost:5173' });
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
router.get('/stories', action(req => feed.listStories(req.user, req.query)));
router.get('/restrictions', action(req => feed.listRestrictions(req.user)));
router.put('/restrictions/:authId', action(req => feed.restrictAuthor(req.user, req.params.authId, req.body)));
router.get('/', action(req => feed.list(req.user, req.query)));
router.post('/', action(req => feed.create(req.user, req.body), 201));
router.get('/:id', action(req => feed.get(req.user, req.params.id)));
router.put('/:id', action(req => feed.updateStory(req.user, req.params.id, req.body)));
router.get('/:id/images/:imageId', createFeedImageDownload(feed));
router.delete('/:id', action(req => feed.remove(req.user, req.params.id)));
router.put('/:id/moderation', action(req => feed.moderate(req.user, req.params.id, req.body)));
router.put('/:id/like', action(req => feed.setMembership(req.user, req.params.id, 'likedBy', req.body.liked)));
router.get('/:id/likes', action(req => feed.listLikes(req.user, req.params.id, req.query.before)));
router.put('/:id/rsvp', action(req => feed.setMembership(req.user, req.params.id, 'attending', req.body.attending)));
router.get('/:id/comments', action(req => feed.listComments(req.user, req.params.id, req.query.before, req.query.parentCommentId)));
router.post('/:id/comments', action(req => feed.comment(req.user, req.params.id, req.body.body, req.body.parentCommentId), 201));
router.delete('/:id/comments/:commentId', action(req => feed.removeComment(req.user, req.params.id, req.params.commentId)));
router.post('/:id/share', action(req => feed.share(req.user, req.params.id, req.body), 201));
router.get('/:id/recipients', action(req => messaging.recipients(req.user, req.params.id)));
router.post('/:id/send', action(req => messaging.send(req.user, req.params.id, req.body), 201));

export default router;
