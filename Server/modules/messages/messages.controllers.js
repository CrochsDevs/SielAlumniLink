import { ConversationModel, MessageModel } from './messages.models.js';
import AuthModel from '../auth/auth.models.js';
import UserModel from '../users/users.models.js';
import { emitToUser } from '../../realtime/socket.js';

const isMember = (convo, authId) =>
  (convo.participants || []).map((p) => String(p.authId)).includes(String(authId));

const otherParticipant = (convo, authId) =>
  (convo.participants || []).find((p) => String(p.authId) !== String(authId)) || {};

const enrich = async (convo, myAuthId) => {
  const other = otherParticipant(convo, myAuthId);
  const profile = other.email ? await UserModel.findByEmail(other.email) : null;
  const unread = await MessageModel.unreadCount(convo._id, myAuthId);
  return {
    _id: convo._id,
    name: profile?.name || other.email || 'Unknown',
    email: other.email || '',
    authId: other.authId || '',
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
    const { text } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty'
      });
    }

    const convo = await ConversationModel.findById(req.params.id);
    if (!convo || !isMember(convo, req.user._id)) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    const message = await MessageModel.create({
      conversationId: req.params.id,
      senderAuthId: req.user._id,
      senderEmail: req.user.email,
      text: text.trim(),
    });

    const lastMessage = { text: message.text, at: message.createdAt, by: String(req.user._id) };
    await ConversationModel.touch(req.params.id, lastMessage);

    const payload = {
      conversationId: String(convo._id),
      message: {
        _id: message._id,
        text: message.text,
        at: message.createdAt,
        senderAuthId: String(req.user._id),
        senderEmail: req.user.email,
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
