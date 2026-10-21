import { ConversationModel, MessageModel } from './messages.models.js';
import AuthModel from '../auth/auth.models.js';
import UserModel from '../users/users.models.js';
import ConnectionModel from '../connections/connections.models.js';
import { emitToUser } from '../../realtime/socket.js';

const isMember = (convo, authId) =>
  (convo.participants || []).map((p) => String(p.authId)).includes(String(authId));

// LinkedIn-style gate: chat only between ACCEPTED connections.
// Admins bypass (support/moderation).
const canMessage = async (me, otherAuthId) => {
  if (me.role === 'admin') return true;
  const mine = await ConnectionModel.findMine(me._id);
  return mine.some((c) =>
    c.status === 'accepted' &&
    [String(c.requesterAuthId), String(c.recipientAuthId)].includes(String(otherAuthId))
  );
};

const NOT_CONNECTED_MESSAGE = 'You can only message connected Sieles. Send a connect request first.';

const otherParticipant = (convo, authId) =>
  (convo.participants || []).find((p) => String(p.authId) !== String(authId)) || {};

const enrich = async (convo, myAuthId) => {
  if (convo.isGroup) {
    const unread = await MessageModel.unreadCount(convo._id, myAuthId);
    return {
      _id: convo._id,
      isGroup: true,
      name: convo.name || 'Group Chat',
      email: '',
      authId: '',
      profilePicture: null,
      memberCount: (convo.participants || []).length,
      preview: convo.lastMessage?.text || '',
      time: convo.lastMessage?.at || convo.updatedAt,
      unread,
    };
  }
  const other = otherParticipant(convo, myAuthId);
  const profile = (other.authId ? await UserModel.findByAuthId(other.authId) : null) ||
    (other.email ? await UserModel.findByEmail(other.email) : null);
  const unread = await MessageModel.unreadCount(convo._id, myAuthId);
  return {
    _id: convo._id,
    isGroup: false,
    name: profile?.name || other.email || 'Unknown',
    email: other.email || '',
    authId: other.authId || '',
    profileId: profile?._id ? String(profile._id) : null,
    role: profile?.role || null,
    profilePicture: profile?.profilePicture || null,
    preview: convo.lastMessage?.text || '',
    time: convo.lastMessage?.at || convo.updatedAt,
    unread,
  };
};

// Own conversation list (with names + unread counts).
export const listConversations = async (req, res) => {
  try {
    const convos = await ConversationModel.findMine(req.user._id);
    const data = await Promise.all(convos.map((c) => enrich(c, req.user._id)));
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get or create a conversation with someone (by their email).
export const openConversation = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide the recipient email'
      });
    }
    if (email.toLowerCase() === String(req.user.email).toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot message yourself'
      });
    }

    const recipient = await AuthModel.findByEmail(email);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!(await canMessage(req.user, recipient._id))) {
      return res.status(403).json({
        success: false,
        message: NOT_CONNECTED_MESSAGE
      });
    }

    const convo = await ConversationModel.getOrCreate(
      req.user._id, req.user.email, recipient._id, recipient.email
    );
    const data = await enrich(convo, req.user._id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Thread (marks incoming as read).
export const listMessages = async (req, res) => {
  try {
    const convo = await ConversationModel.findById(req.params.id);
    if (!convo || !isMember(convo, req.user._id)) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }
    const messages = await MessageModel.listByConversation(req.params.id);
    await MessageModel.markRead(req.params.id, req.user._id);
    res.status(200).json({
      success: true,
      data: messages.map((m) => ({
        _id: m._id,
        from: String(m.senderAuthId) === String(req.user._id) ? 'me' : 'them',
        text: m.text,
        at: m.createdAt,
        edited: !!m.edited,
        unsent: !!m.unsent,
        senderEmail: m.senderEmail,
        attachment: m.attachment || null,
        call: m.call || null,
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Send + push live to both sides.
export const sendMessage = async (req, res) => {
  try {
    const { text, attachment } = req.body;
    if ((!text || !String(text).trim()) && !attachment?.url) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty'
      });
    }
    if (attachment?.url && String(attachment.url).length > 2_000_000) {
      return res.status(413).json({
        success: false,
        message: 'File too large (max ~1.5MB until Cloudinary lands)'
      });
    }

    const convo = await ConversationModel.findById(req.params.id);
    if (!convo || !isMember(convo, req.user._id)) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    const other = (convo.participants || []).find((p) => String(p.authId) !== String(req.user._id));
    if (other && !(await canMessage(req.user, other.authId))) {
      return res.status(403).json({
        success: false,
        message: NOT_CONNECTED_MESSAGE
      });
    }

    const message = await MessageModel.create({
      conversationId: req.params.id,
      senderAuthId: req.user._id,
      senderEmail: req.user.email,
      text: (text || '').trim(),
      attachment: req.body.attachment,
    });

    const lastMessage = {
      text: message.text || (message.attachment ? (message.attachment.kind === 'image' ? '📷 Photo' : '📎 File') : ''),
      at: message.createdAt,
      by: String(req.user._id),
    };
    await ConversationModel.touch(req.params.id, lastMessage);

    const payload = {
      conversationId: String(convo._id),
      message: {
        _id: message._id,
        text: message.text,
        at: message.createdAt,
        senderAuthId: String(req.user._id),
        senderEmail: req.user.email,
        attachment: message.attachment || null,
      },
      lastMessage,
    };

    // Live push to every socket of both participants.
    (convo.participants || []).forEach((p) => emitToUser(p.authId, 'message:new', payload));

    res.status(201).json({
      success: true,
      data: { _id: message._id, from: 'me', text: message.text, at: message.createdAt }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Push an event to all members of a conversation (groups included).
const emitToMembers = async (conversationId, event, payload) => {
  try {
    const convo = await ConversationModel.findById(conversationId);
    (convo?.participants || []).forEach((p) => emitToUser(p.authId, event, payload));
  } catch {
    // ignore
  }
};

// Create a group chat from 2+ connects (3+ people total).
// Body: { name, emails: [invited emails] } — all must be connected
// with the creator (LinkedIn-style: groups grow from your network).
export const createGroup = async (req, res) => {
  try {
    const { name, emails } = req.body;
    const invited = [...new Set((emails || []).map((e) => String(e).toLowerCase()))]
      .filter((e) => e && e !== String(req.user.email).toLowerCase());

    if (invited.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Invite at least 2 people to start a group chat'
      });
    }
    if (invited.length > 20) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 20 members per group'
      });
    }

    // Every invitee must exist and be connected with the creator.
    const mine = await ConnectionModel.findMine(req.user._id);
    const connectedEmails = new Set();
    mine.forEach((c) => {
      if (c.status === 'accepted') {
        connectedEmails.add(String(c.requesterEmail).toLowerCase());
        connectedEmails.add(String(c.recipientEmail).toLowerCase());
      }
    });

    const members = [{ authId: req.user._id, email: req.user.email }];
    for (const email of invited) {
      if (!connectedEmails.has(email)) {
        return res.status(403).json({
          success: false,
          message: `${email} is not connected with you yet`
        });
      }
      const account = await AuthModel.findByEmail(email);
      if (!account) {
        return res.status(404).json({
          success: false,
          message: `User not found: ${email}`
        });
      }
      members.push({ authId: account._id, email: account.email });
    }

    const convo = await ConversationModel.createGroup({ name, members });
    res.status(201).json({
      success: true,
      data: { _id: convo._id, name: convo.name },
      message: 'Group chat created'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Sender-only edit.
export const editMessage = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty'
      });
    }
    const message = await MessageModel.editMessage(req.params.msgId, req.user._id, text.trim());
    if (!message) {
      return res.status(403).json({
        success: false,
        message: 'Cannot edit this message'
      });
    }
    emitToMembers(message.conversationId, 'message:edited', {
      conversationId: String(message.conversationId),
      message: { _id: message._id, text: message.text, edited: true },
    });
    res.status(200).json({ success: true, data: message });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Sender-only unsend.
export const unsendMessage = async (req, res) => {
  try {
    const message = await MessageModel.unsendMessage(req.params.msgId, req.user._id);
    if (!message) {
      return res.status(403).json({
        success: false,
        message: 'Cannot unsend this message'
      });
    }
    emitToMembers(message.conversationId, 'message:unsent', {
      conversationId: String(message.conversationId),
      messageId: String(message._id),
    });
    res.status(200).json({ success: true, message: 'Message unsent' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
