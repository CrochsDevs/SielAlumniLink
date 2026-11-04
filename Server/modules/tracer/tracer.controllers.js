import TracerModel from './tracer.models.js';
import { tracerQuarterStatus } from './tracer.quarter.js';
import { buildAlignmentReport, validateTracerResponse } from './tracer.alignment.js';

// Any authenticated user can open the tracer form.
export const checkAccess = async (req, res) => {
  try {
    const response = await TracerModel.findByAuthId(req.user._id);
    res.status(200).json({ success: true, data: { hasAccess: true, ...tracerQuarterStatus(response) } });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

// Any logged-in user submits/updates their OWN tracer response.
export const submitResponse = async (req, res) => {
  try {
    const validated = validateTracerResponse(req.body);
    const existing = await TracerModel.findByAuthId(req.user._id);
    if (existing?.batch && String(existing.batch) !== String(validated.batch)) {
      return res.status(409).json({
        success: false,
        message: 'Your graduation year is already saved and cannot be changed. Reload your response before updating other details.',
      });
    }
    if (existing?.program && existing.program !== validated.program) {
      return res.status(409).json({
        success: false,
        message: 'Your program is already saved and cannot be changed. Reload your response before updating other details.',
      });
    }
    const saved = await TracerModel.upsertByAuthId(req.user._id, {
      ...validated,
      email: req.user.email,
    });

    res.status(200).json({
      success: true,
      message: 'Tracer response saved successfully',
      data: saved
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message
    });
  }
};

export const getAlignmentReport = async (req, res) => {
  try {
    const responses = await TracerModel.findAlumniResponses();
    res.status(200).json({ success: true, data: buildAlignmentReport(responses, req.query) });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
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
    res.status(error.status || 500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin-only: all responses for the dashboard.
export const getResponses = async (req, res) => {
  try {
    const { responses, periods } = await TracerModel.findPeriodReport(req.query);
    res.status(200).json({
      success: true,
      data: responses,
      periods,
      message: 'Tracer responses fetched successfully'
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message
    });
  }
};
