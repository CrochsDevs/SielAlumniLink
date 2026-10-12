import JobModel from './jobs.models.js';
import NotificationModel from '../notifications/notifications.models.js';

// Any logged-in user sees active postings (alumni job board).
export const listJobs = async (req, res) => {
  try {
    const activeOnly = req.query.all !== 'true';
    const jobs = await JobModel.findAll({ activeOnly });
    res.status(200).json({
      success: true,
      data: jobs,
      message: 'Job posts fetched successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getJob = async (req, res) => {
  try {
    const job = await JobModel.findById(req.params.id);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job post not found'
      });
    }
    res.status(200).json({ success: true, data: job });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const validateJob = ({ title, company }) => {
  if (!title || !company) {
    return 'Please provide job title and company';
  }
  return null;
};

// Admin-only.
export const createJob = async (req, res) => {
  try {
    const error = validateJob(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }
    const job = await JobModel.create({ ...req.body, createdBy: req.user._id });
    if (job.isActive) {
      void NotificationModel.broadcast({
        title: `New job: ${job.title}`,
        body: `${job.company}${job.location ? ` • ${job.location}` : ''}`,
        link: '/alumni/career',
        audience: 'all',
        kind: 'jobs',
        excludeAuthId: req.user._id,
        actorAuthId: req.user._id,
      });
    }
    res.status(201).json({
      success: true,
      data: job,
      message: 'Job post created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin-only.
export const updateJob = async (req, res) => {
  try {
    const job = await JobModel.updateById(req.params.id, req.body);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job post not found'
      });
    }
    res.status(200).json({
      success: true,
      data: job,
      message: 'Job post updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin-only.
export const deleteJob = async (req, res) => {
  try {
    const deleted = await JobModel.deleteById(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Job post not found'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Job post deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
