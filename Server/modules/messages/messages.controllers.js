import { ConversationModel, MessageModel, conversationPreference } from './messages.models.js';
import AuthModel from '../auth/auth.models.js';
import UserModel from '../users/users.models.js';
import ConnectionModel from '../connections/connections.models.js';
import { emitToUser, removeGroupCallMember, endDirectCalls } from '../../realtime/socket.js';
import { ConversationControls } from './conversation-controls.js';
import { createGroupMembersService, MAX_GROUP_MEMBERS } from './group-members.js';
import { createGroupMemberActivityRecorder, createGroupMemberRemovalRecorder, createGroupRenameRecorder } from './group-member-activity.js';
import { groupRoles } from './group-admin.js';
import { messageWasRead } from './read-receipts.js';
import { messageSenders } from './message-senders.js';
import cloudUpload, { cloudinary } from '../../config/cloudinary.js';
import { uploadMessageAttachment, messageAttachmentDto } from './message-attachments.js';

const groupMembers = createGroupMembersService({ conversations: ConversationModel, connections: ConnectionModel, accounts: AuthModel, profiles: UserModel,
  onMembersAdded: createGroupMemberActivityRecorder({ conversations: ConversationModel, messages: MessageModel, emit: emitToUser }),
});
const groupAction = handler => async (req, res) => {
  try { res.status(200).json({ success: true, data: await handler(req) }); }
  catch (error) { res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to update this conversation. Please try again.' }); }
};
export const listGroupMembers = groupAction(req => groupMembers.list(req.params.id, req.user._id));
export const groupCandidates = groupAction(req => groupMembers.candidates(req.params.id, req.user._id));
export const addGroupMembers = groupAction(async req => {
  const data = await groupMembers.add(req.params.id, req.user._id, req.body?.authIds);
  for (const member of data.members) emitToUser(member.authId, 'conversation:members', data);
  return data;
});
export const promoteGroupAdmin = groupAction(async req => {
  await ConversationModel.promoteAdmin(req.params.id, req.user._id, req.body?.authId);
  const data = await groupMembers.list(req.params.id, req.user._id);
  for (const member of data.members) emitToUser(member.authId, 'conversation:members', data);
  return data;
});
const recordMemberRemoval = createGroupMemberRemovalRecorder({ conversations: ConversationModel, messages: MessageModel, profiles: UserModel, emit: emitToUser });
const exitGroup = async (req, targetId) => {
  const group = await ConversationModel.exitGroup(req.params.id, req.user._id, targetId, recordMemberRemoval);
  await removeGroupCallMember(String(group._id), targetId);
  const data = { conversationId: String(group._id), removedAuthId: targetId, memberCount: group.participants.length, ...groupRoles(group) };
  emitToUser(targetId, 'conversation:removed', { conversationId: data.conversationId });
  for (const member of group.participants) emitToUser(member.authId, 'conversation:members', data);
  return data;
};
export const leaveGroup = groupAction(req => exitGroup(req, String(req.user._id)));
export const removeGroupMember = groupAction(req => exitGroup(req, req.params.authId));

const isMember = (convo, authId) =>
  (convo.participants || []).map((p) => String(p.authId)).includes(String(authId));

// LinkedIn-style gate: chat only between ACCEPTED connections.
// Admins bypass (support/moderation).
const canMessage = async (me, otherAuthId) => {
  if (await ConversationControls.isBlocked(me._id, otherAuthId)) return false;
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
  const preference = Object.hasOwn(convo, conversationPreference) ? convo[conversationPreference] : await ConversationControls.preference(convo._id, myAuthId);
  const clearedAt = preference?.clearedAt;
  const incoming = await MessageModel.latestIncoming(convo._id, myAuthId, clearedAt);
  const preview = { preview: incoming ? incoming.unsent ? 'Message deleted' : incoming.text ||
    (incoming.attachment?.kind === 'image' ? '📷 Photo' : incoming.attachment?.kind === 'file' ? '📎 File' : '') : '',
    previewMessageId: incoming ? String(incoming._id) : null, previewAt: incoming?.createdAt || null };
  if (convo.isGroup) {
    const unread = await MessageModel.unreadCount(convo._id, myAuthId, clearedAt);
    return {
      _id: convo._id,
      isGroup: true,
      ...groupRoles(convo),
      name: convo.name || 'Group Chat',
      email: '',
      authId: '',
      profilePicture: null,
      memberCount: (convo.participants || []).length,
      ...preview,
      time: convo.lastMessage?.at || convo.updatedAt,
      unread,
    };
  }
  const other = otherParticipant(convo, myAuthId);
  const profile = (other.authId ? await UserModel.findByAuthId(other.authId) : null) ||
    (other.email ? await UserModel.findByEmail(other.email) : null);
  const unread = await MessageModel.unreadCount(convo._id, myAuthId, clearedAt);
  const blockStatus = await ConversationControls.blockStatus(myAuthId, other.authId);
  return {
    _id: convo._id,
    isGroup: false,
    ...blockStatus,
    name: profile?.name || other.email || 'Unknown',
    email: other.email || '',
    authId: other.authId || '',
    profileId: profile?._id ? String(profile._id) : null,
    role: profile?.role || null,
    profilePicture: profile?.profilePicture || null,
    ...preview,
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
    const { email, recipientAuthId } = req.body;
    if ((email !== undefined && typeof email !== 'string') ||
        (recipientAuthId !== undefined && (typeof recipientAuthId !== 'string' || !/^[a-f\d]{24}$/i.test(recipientAuthId)))) {
      return res.status(400).json({ success: false, message: 'Invalid conversation recipient' });
    }
    if (!email && !recipientAuthId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide the recipient email'
      });
    }
    if (email && email.toLowerCase() === String(req.user.email).toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot message yourself'
      });
    }

    const recipient = recipientAuthId ? await AuthModel.findById(recipientAuthId) : await AuthModel.findByEmail(email);
    if (!recipient || recipient.disabledAt) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (String(recipient._id) === String(req.user._id)) return res.status(400).json({ success: false, message: 'You cannot message yourself' });
    if (!(await canMessage(req.user, recipient._id))) {
      return res.status(403).json({
        success: false,
        message: NOT_CONNECTED_MESSAGE
      });
    }

    const convo = await ConversationModel.getOrCreate(
      req.user._id, req.user.email, recipient._id, recipient.email
    );
    await ConversationControls.show(convo._id, req.user._id);
    const data = await enrich(convo, req.user._id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Loading/caching history alone does not imply that it was viewed.
export const listMessages = async (req, res) => {
  try {
    const convo = await ConversationModel.findById(req.params.id);
    if (!convo || !isMember(convo, req.user._id)) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }
    const preference = await ConversationControls.preference(convo._id, req.user._id);
    const messages = await MessageModel.listByConversation(req.params.id, 100, preference?.clearedAt);
    const senders = await messageSenders(messages);
    res.status(200).json({
      success: true,
      data: messages.map((m) => ({
        _id: m._id,
        clientMessageId: m.clientMessageId,
        from: String(m.senderAuthId) === String(req.user._id) ? 'me' : 'them',
        text: m.text,
        at: m.createdAt,
        edited: !!m.edited,
        unsent: !!m.unsent,
        read: messageWasRead(m, convo.isGroup),
        readByMe: (m.readBy || []).includes(String(req.user._id)),
        senderEmail: m.senderEmail,
        ...senders.get(String(m.senderAuthId)),
        attachment: messageAttachmentDto(m),
        call: m.call || null,
        activity: m.activity || null,
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const markMessagesRead = groupAction(async req => {
  const ids = req.body?.messageIds;
  if (!Array.isArray(ids) || ids.length > 100 || !ids.length || ids.some(id => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))) {
    throw Object.assign(new Error('Provide up to 100 valid message IDs.'), { status: 400 });
  }
  const conversation = await ConversationModel.findById(req.params.id);
  if (!conversation || !isMember(conversation, req.user._id)) throw Object.assign(new Error('Conversation not found'), { status: 404 });
  const preference = await ConversationControls.preference(conversation._id, req.user._id);
  const messages = await MessageModel.markRead(conversation._id, req.user._id, ids, preference?.clearedAt);
  const unread = await MessageModel.unreadCount(conversation._id, req.user._id, preference?.clearedAt);
  const data = { conversationId: String(conversation._id), readerAuthId: String(req.user._id), messageIds: messages.map(message => String(message._id)), unread };
  for (const participant of conversation.participants) emitToUser(participant.authId, 'message:read', data);
  return data;
});

// Send + push live to both sides.
export const sendMessage = async (req, res) => {
  try {
    const { text } = req.body;
    const clientMessageId = typeof req.body.clientMessageId === 'string' && /^[\w-]{1,100}$/.test(req.body.clientMessageId) ? req.body.clientMessageId : undefined;
    if (text !== undefined && typeof text !== 'string') return res.status(400).json({ success: false, message: 'Invalid message text' });
    if ((!text || !text.trim()) && !req.file) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty'
      });
    }
    if (req.body.attachment) return res.status(400).json({ success: false, message: 'Upload the attachment as a file.' });

    const convo = await ConversationModel.findById(req.params.id);
    if (!convo || !isMember(convo, req.user._id)) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    const other = (convo.participants || []).find((p) => String(p.authId) !== String(req.user._id));
    if (!convo.isGroup && other && !(await canMessage(req.user, other.authId))) {
      return res.status(403).json({
        success: false,
        message: await ConversationControls.isBlocked(req.user._id, other.authId) ? 'This conversation is blocked.' : NOT_CONNECTED_MESSAGE
      });
    }

    const attachment = await uploadMessageAttachment(req.file, req.user, req.params.id, cloudUpload);
    let message;
    try { message = await MessageModel.create({
      conversationId: req.params.id,
      senderAuthId: req.user._id,
      senderEmail: req.user.email,
      clientMessageId,
      text: (text || '').trim(),
      attachment,
    }); } catch (error) {
      if (attachment?.publicId) await cloudinary.uploader.destroy(attachment.publicId, { resource_type: attachment.resourceType, type: 'authenticated' }).catch(() => {});
      throw error;
    }

    const lastMessage = {
      text: message.text || (message.attachment ? (message.attachment.kind === 'image' ? '📷 Photo' : '📎 File') : ''),
      at: message.createdAt,
      by: String(req.user._id),
    };
    await ConversationModel.touch(req.params.id, lastMessage);

    const sender = (await messageSenders([message])).get(String(req.user._id));
    const payload = {
      conversationId: String(convo._id),
      message: {
        _id: message._id,
        clientMessageId,
        text: message.text,
        at: message.createdAt,
        senderAuthId: String(req.user._id),
        senderEmail: req.user.email,
        ...sender,
        attachment: messageAttachmentDto(message),
      },
      lastMessage,
    };

    // Live push to every socket of both participants.
    (convo.participants || []).forEach((p) => emitToUser(p.authId, 'message:new', payload));

    res.status(201).json({
      success: true,
      data: { _id: message._id, clientMessageId, from: 'me', text: message.text, attachment: messageAttachmentDto(message), at: message.createdAt, read: false, ...sender }
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message
    });
  }
};

// Push an event to all members of a conversation (groups included).
export const deleteConversation = groupAction(async req => {
  const conversation = await ConversationModel.findById(req.params.id);
  if (!conversation || !isMember(conversation, req.user._id)) throw Object.assign(new Error('Conversation not found'), { status: 404 });
  const data = await ConversationControls.clear(conversation._id, req.user._id);
  // Personal deletion never removes another participant's messages or group membership.
  emitToUser(req.user._id, 'conversation:deleted', data);
  return data;
});

const changeBlock = blocked => groupAction(async req => {
  const conversation = await ConversationModel.findById(req.params.id);
  if (!conversation || !isMember(conversation, req.user._id)) throw Object.assign(new Error('Conversation not found'), { status: 404 });
  if (conversation.isGroup) throw Object.assign(new Error('Blocking applies to individual accounts, not group chats.'), { status: 400 });
  const other = otherParticipant(conversation, req.user._id);
  if (!other.authId) throw Object.assign(new Error('Account not found'), { status: 404 });
  await ConversationControls.setBlocked(req.user._id, other.authId, blocked);
  if (blocked) await endDirectCalls(req.user._id, other.authId);
  const data = await enrich(conversation, req.user._id);
  for (const participant of conversation.participants) {
    const updated = String(participant.authId) === String(req.user._id) ? data : await enrich(conversation, participant.authId);
    emitToUser(participant.authId, 'conversation:updated', updated);
  }
  return data;
});
export const blockConversation = changeBlock(true);
export const unblockConversation = changeBlock(false);

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
    if (invited.length + 1 > MAX_GROUP_MEMBERS) {
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
      data: { _id: convo._id, name: convo.name, ...groupRoles(convo) },
      message: 'Group chat created'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const recordGroupRename = createGroupRenameRecorder({ conversations: ConversationModel, messages: MessageModel, profiles: UserModel, emit: emitToUser });
export const renameGroup = async (req, res) => {
  try {
    const group = await ConversationModel.renameGroup(req.params.id, req.user._id, req.body?.name, recordGroupRename);
    const data = { conversationId: String(group._id), name: group.name };
    for (const member of group.participants) emitToUser(member.authId, 'conversation:renamed', data);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to rename the group. Please try again.' });
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
