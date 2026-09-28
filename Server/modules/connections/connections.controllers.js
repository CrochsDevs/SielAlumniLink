import ConnectionModel from './connections.models.js';
import AuthModel from '../auth/auth.models.js';

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
