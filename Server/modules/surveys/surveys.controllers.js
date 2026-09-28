import SurveyModel from './surveys.models.js';
import SurveyResponseModel from './survey-responses.models.js';

// Any logged-in user sees active surveys.
export const listSurveys = async (req, res) => {
  try {
    const activeOnly = req.query.all !== 'true';
    const surveys = await SurveyModel.findAll({ activeOnly });
    res.status(200).json({
      success: true,
      data: surveys,
      message: 'Surveys fetched successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getSurvey = async (req, res) => {
  try {
    const survey = await SurveyModel.findById(req.params.id);
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }
    res.status(200).json({ success: true, data: survey });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin-only.
export const createSurvey = async (req, res) => {
  try {
    if (!req.body.title) {
      return res.status(400).json({ success: false, message: 'Please provide a survey title' });
    }
    const survey = await SurveyModel.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({
      success: true,
      data: survey,
      message: 'Survey created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin-only.
export const updateSurvey = async (req, res) => {
  try {
    const survey = await SurveyModel.updateById(req.params.id, req.body);
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }
    res.status(200).json({
      success: true,
      data: survey,
      message: 'Survey updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin-only.
export const deleteSurvey = async (req, res) => {
  try {
    const deleted = await SurveyModel.deleteById(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Survey deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Any logged-in user answers an ACTIVE survey (one response each).
export const submitAnswers = async (req, res) => {
  try {
    const survey = await SurveyModel.findById(req.params.id);
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }
    if (!survey.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This survey is no longer accepting responses'
      });
    }

    const { answers } = req.body;
    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide answers'
      });
    }

    const saved = await SurveyResponseModel.submit({
      surveyId: req.params.id,
      authId: req.user._id,
      email: req.user.email,
      answers: answers.map((a) => String(a ?? '')).slice(0, 100),
    });

    res.status(200).json({
      success: true,
      data: saved,
      message: 'Response submitted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Own response (for prefill).
export const getMyAnswers = async (req, res) => {
  try {
    const response = await SurveyResponseModel.findMine(req.params.id, req.user._id);
    res.status(200).json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin-only: all responses to a survey (kalagayan ng alumni per survey).
export const getSurveyResults = async (req, res) => {
  try {
    const survey = await SurveyModel.findById(req.params.id);
    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found'
      });
    }
    const responses = await SurveyResponseModel.findBySurvey(req.params.id);
    res.status(200).json({
      success: true,
      data: { survey, responses },
      message: 'Survey results fetched successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
