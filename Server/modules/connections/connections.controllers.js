import ConnectionModel from './connections.models.js';
import AuthModel from '../auth/auth.models.js';
import UserModel from '../users/users.models.js';
import NotificationModel from '../notifications/notifications.models.js';
import { emitToUser } from '../../realtime/socket.js';

const STATUSES = ['pending', 'accepted', 'declined'];

// Any logged-in user requests a connection (by recipient email).
export const createConnection = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide the recipient email'
      });
    }

    const recipient = await AuthModel.findByEmail(email);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const connection = await ConnectionModel.request(
      req.user._id,
      req.user.email,
      recipient._id,
      recipient.email
    );

    const requesterProfile = await UserModel.findByEmail(req.user.email);
    const requesterName = requesterProfile?.name || req.user.email;

    const recipientRole = recipient.role || 'alumni';
    const reqLink = recipientRole === 'student' ? '/student/requests' : '/alumni/requests';

    await NotificationModel.notify({
      recipientAuthId: recipient._id,
      recipientEmail: recipient.email,
      title: 'New Connection Request',
      body: `${requesterName} wants to connect with you.`,
      link: reqLink,
      kind: 'connection_request',
    });

    emitToUser(recipient._id, 'notification:new', {
      title: 'New Connection Request',
      body: `${requesterName} wants to connect with you.`,
      link: reqLink,
      kind: 'connection_request',
    });

    res.status(201).json({
      success: true,
      data: connection,
      message: 'Connection request sent'
    });
  } catch (error) {
    const status = error.message === 'Connection already exists' ? 409 : 400;
    res.status(status).json({
      success: false,
      message: error.message
    });
  }
};

// Pending requests where I am the recipient (accept/decline inbox).
export const listRequests = async (req, res) => {
  try {
    const connections = await ConnectionModel.findMine(req.user._id);
    const pending = connections.filter(
      (c) => c.status === 'pending' && String(c.recipientAuthId) === String(req.user._id)
    );
    const enriched = await Promise.all(pending.map(async (c) => {
      const profile = await UserModel.findByEmail(c.requesterEmail);
      return {
        _id: c._id,
        name: profile?.name || c.requesterEmail,
        email: c.requesterEmail,
        program: profile?.program || '',
        createdAt: c.createdAt,
      };
    }));
    res.status(200).json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Own connections.
export const getMyConnections = async (req, res) => {
  try {
    const connections = await ConnectionModel.findMine(req.user._id);
    res.status(200).json({
      success: true,
      data: connections
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin-only: whole network.
export const getConnections = async (req, res) => {
  try {
    const connections = await ConnectionModel.findAll();
    res.status(200).json({
      success: true,
      data: connections,
      message: 'Connections fetched successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Participant accepts/declines, or admin sets any status.
export const updateConnection = async (req, res) => {
  try {
    const { status } = req.body;
    if (!STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed: ${STATUSES.join(', ')}`
      });
    }

    const updated = await ConnectionModel.updateStatus(req.params.id, status);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found'
      });
    }

    const isParticipant =
      String(updated.requesterAuthId) === String(req.user._id) ||
      String(updated.recipientAuthId) === String(req.user._id);
    if (req.user.role !== 'admin' && !isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: not part of this connection'
      });
    }

    if (status === 'accepted' || status === 'declined') {
      const targetAuthId = String(updated.requesterAuthId) === String(req.user._id)
        ? updated.recipientAuthId
        : updated.requesterAuthId;
      const targetEmail = String(updated.requesterAuthId) === String(req.user._id)
        ? updated.recipientEmail
        : updated.requesterEmail;

      const accepterProfile = await UserModel.findByEmail(req.user.email);
      const accepterName = accepterProfile?.name || req.user.email;

      const notifTitle = status === 'accepted' ? 'Connection Accepted' : 'Connection Declined';
      const notifBody = status === 'accepted'
        ? `${accepterName} accepted your connection request.`
        : `${accepterName} declined your connection request.`;

      await NotificationModel.notify({
        recipientAuthId: targetAuthId,
        recipientEmail: targetEmail,
        title: notifTitle,
        body: notifBody,
        link: '/message',
        kind: 'connection_response',
      });

      emitToUser(targetAuthId, 'notification:new', {
        title: notifTitle,
        body: notifBody,
        link: '/message',
        kind: 'connection_response',
      });
    }

    res.status(200).json({
      success: true,
      data: updated,
      message: `Connection ${status}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin-only: remove a connection.
export const deleteConnection = async (req, res) => {
  try {
    const deleted = await ConnectionModel.deleteById(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Connection removed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
