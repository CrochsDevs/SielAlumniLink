import EventModel from './events.models.js';

// Any logged-in user sees active events.
export const listEvents = async (req, res) => {
  try {
    const activeOnly = req.query.all !== 'true';
    const events = await EventModel.findAll({ activeOnly });
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
    const event = await EventModel.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    res.status(200).json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({
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
    const event = await EventModel.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({
      success: true,
      data: event,
      message: 'Event created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin-only.
export const updateEvent = async (req, res) => {
  try {
    const event = await EventModel.updateById(req.params.id, req.body);
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
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin-only.
export const deleteEvent = async (req, res) => {
  try {
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
