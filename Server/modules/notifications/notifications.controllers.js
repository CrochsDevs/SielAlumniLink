import NotificationModel from './notifications.models.js';

// Own notifications (newest first).
export const listNotifications = async (req, res) => {
  try {
    const notifications = await NotificationModel.findMine(req.user._id, parseInt(req.query.limit, 10) || 20);
    res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const count = await NotificationModel.unreadCount(req.user._id);
    res.status(200).json({ success: true, data: { count } });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const markRead = async (req, res) => {
  try {
    await NotificationModel.markRead(req.user._id, req.params.id);
    res.status(200).json({ success: true, message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const markAllRead = async (req, res) => {
  try {
    await NotificationModel.markAllRead(req.user._id);
    res.status(200).json({ success: true, message: 'All marked as read' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
