import AnnouncementModel from './announcements.models.js';
import NotificationModel from '../notifications/notifications.models.js';

const AUDIENCES = ['all', 'alumni', 'students'];

// Any logged-in user sees published announcements.
export const listAnnouncements = async (req, res) => {
  try {
    const activeOnly = req.query.all !== 'true';
    const announcements = await AnnouncementModel.findAll({ activeOnly });
    res.status(200).json({
      success: true,
      data: announcements,
      message: 'Announcements fetched successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getAnnouncement = async (req, res) => {
  try {
    const announcement = await AnnouncementModel.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    res.status(200).json({ success: true, data: announcement });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin-only.
export const createAnnouncement = async (req, res) => {
  try {
    if (!req.body.title) {
      return res.status(400).json({ success: false, message: 'Please provide a title' });
    }
    if (req.body.audience && !AUDIENCES.includes(req.body.audience)) {
      return res.status(400).json({ success: false, message: `Audience must be one of: ${AUDIENCES.join(', ')}` });
    }
    const announcement = await AnnouncementModel.create({ ...req.body, createdBy: req.user._id });
    if (announcement.isActive) {
      void NotificationModel.broadcast({
        title: announcement.title,
        body: (announcement.body || '').slice(0, 140),
        link: '/alumni/message',
        audience: announcement.audience || 'all',
        kind: 'announcements',
        excludeAuthId: req.user._id,
        actorAuthId: req.user._id,
      });
    }
    res.status(201).json({
      success: true,
      data: announcement,
      message: 'Announcement created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin-only.
export const updateAnnouncement = async (req, res) => {
  try {
    if (req.body.audience && !AUDIENCES.includes(req.body.audience)) {
      return res.status(400).json({ success: false, message: `Audience must be one of: ${AUDIENCES.join(', ')}` });
    }
    const announcement = await AnnouncementModel.updateById(req.params.id, req.body);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    res.status(200).json({
      success: true,
      data: announcement,
      message: 'Announcement updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin-only.
export const deleteAnnouncement = async (req, res) => {
  try {
    const deleted = await AnnouncementModel.deleteById(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
