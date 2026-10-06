import TracerModel, { TRACER_STATUSES } from './tracer.models.js';
import ConnectionModel from '../connections/connections.models.js';
import AuthModel from '../auth/auth.models.js';

// Check if current user has tracer access — any authenticated user.
export const checkAccess = async (req, res) => {
  try {
    res.status(200).json({ success: true, data: { hasAccess: true } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Any logged-in user submits/updates their OWN tracer response.
export const submitResponse = async (req, res) => {
  try {
    const { batch, program, status, company, position, salaryRange, employmentDate, location } = req.body;

    if (!batch || !program || !status) {
      return res.status(400).json({
        success: false,
        message: 'Please provide batch, program and employment status'
      });
    }

    if (!TRACER_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed: ${TRACER_STATUSES.join(', ')}`
      });
    }

    const saved = await TracerModel.upsertByAuthId(req.user._id, {
      email: req.user.email,
      batch: String(batch).trim(),
      program: String(program).trim(),
      status,
      company: (company || '').trim(),
      position: (position || '').trim(),
      salaryRange: (salaryRange || '').trim(),
      employmentDate: employmentDate ? new Date(employmentDate) : null,
      location: (location || '').trim(),
    });

    res.status(200).json({
      success: true,
      message: 'Tracer response saved successfully',
      data: saved
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Own response (for form prefill).
export const getMyResponse = async (req, res) => {
  try {
    const response = await TracerModel.findByAuthId(req.user._id);
    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin-only: all responses for the dashboard.
export const getResponses = async (req, res) => {
  try {
    const responses = await TracerModel.findAll();
    res.status(200).json({
      success: true,
      data: responses,
      message: 'Tracer responses fetched successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
