import EventModel from './events.models.js';
import NotificationModel from '../notifications/notifications.models.js';
import { validateEvent, validateRegistrationWindow } from './events.policy.js';
import { createActivityService } from './events.registration.js';
import { client } from '../../config/db.js';
import { endMeetingRoom } from '../meetings/meetings.socket.js';
const activities = createActivityService(client.db('SielAlumni'));

// Any logged-in user sees active events.
export const listEvents = async (req, res) => {
  try {
    const events = await activities.list(req.user, { all: req.query.all === 'true' });
    res.status(200).json({
      success: true,
      data: events,
      message: 'Events fetched successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getEvent = async (req, res) => {
  try {
    const event = await activities.details(req.user, req.params.id);
    if (!event || (!event.isActive && req.user.role !== 'admin')) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    res.status(200).json({ success: true, data: event });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin-only.
export const createEvent = async (req, res) => {
  try {
    if (!req.body.title) {
      return res.status(400).json({ success: false, message: 'Please provide an event title' });
    }
    const event = await EventModel.create({ ...validateEvent(req.body), createdBy: req.user._id });
    if (event.isActive) {
      void NotificationModel.broadcast({
        title: `New event: ${event.title}`,
        body: event.location || '',
        link: '/activities',
        audience: 'all',
        kind: 'events',
        excludeAuthId: req.user._id,
        actorAuthId: req.user._id,
      });
    }
    res.status(201).json({
      success: true,
      data: event,
      message: 'Event created successfully'
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin-only.
export const updateEvent = async (req, res) => {
  try {
    const existing = await EventModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Event not found' });
    const update = validateEvent(req.body, true);
    validateRegistrationWindow({ ...existing, ...update });
    const meeting = await client.db('SielAlumni').collection('event_meetings').findOne({ _id: String(req.params.id), state: 'active' });
    if (meeting && ['title', 'activityType', 'deliveryMode', 'startAt', 'endAt'].some(key => update[key] !== undefined && (key.endsWith('At') ? new Date(update[key]).getTime() !== new Date(existing[key]).getTime() : update[key] !== existing[key]))) return res.status(409).json({ success: false, message: 'End the active meeting before changing its activity details' });
    if ((update.deliveryMode || existing.deliveryMode) === 'online' && !(update.endAt === undefined ? existing.endAt : update.endAt)) return res.status(400).json({ success: false, message: 'Online activities require an end time' });
    if (new Date(update.endAt === undefined ? existing.endAt : update.endAt).getTime() > 0 && new Date(update.endAt === undefined ? existing.endAt : update.endAt) <= new Date(update.startAt || existing.startAt)) return res.status(400).json({ success: false, message: 'The end time must be after the start time' });
    const event = await EventModel.updateById(req.params.id, update);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    res.status(200).json({
      success: true,
      data: event,
      message: 'Event updated successfully'
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin-only.
export const deleteEvent = async (req, res) => {
  try {
    await endMeetingRoom(req.params.id, req.user);
    const deleted = await EventModel.deleteById(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
