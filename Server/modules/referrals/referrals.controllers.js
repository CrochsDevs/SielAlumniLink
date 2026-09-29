import { ReferralModel, ReferralApplicationModel, REFERRAL_TYPES, APPLICATION_STATUSES } from './referrals.models.js';
import UserModel from '../users/users.models.js';

// Any logged-in user browses active referrals.
export const listReferrals = async (req, res) => {
  try {
    const referrals = await ReferralModel.findAll({ type: req.query.type });
    res.status(200).json({
      success: true,
      data: referrals,
      message: 'Referrals fetched successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getReferral = async (req, res) => {
  try {
    const referral = await ReferralModel.findById(req.params.id);
    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'Referral not found'
      });
    }
    res.status(200).json({ success: true, data: referral });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Alumni + admin post opportunities. Students browse and apply only.
export const createReferral = async (req, res) => {
  try {
    if (!['admin', 'alumni'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only alumni can post referrals'
      });
    }
    const { title, description, type, organization, link } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: 'Please provide a title' });
    }
    if (type && !REFERRAL_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: `Type must be one of: ${REFERRAL_TYPES.join(', ')}` });
    }

    const profile = await UserModel.findByAuthId(req.user._id);
    const referral = await ReferralModel.create({
      title,
      description,
      type,
      organization,
      link,
      authorAuthId: req.user._id,
      authorName: profile?.name || '',
      authorEmail: req.user.email,
    });

    res.status(201).json({
      success: true,
      data: referral,
      message: 'Referral posted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Author or admin edits.
export const updateReferral = async (req, res) => {
  try {
    const referral = await ReferralModel.findById(req.params.id);
    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'Referral not found'
      });
    }
    const isAuthor = String(referral.authorAuthId) === String(req.user._id);
    if (req.user.role !== 'admin' && !isAuthor) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: only the author can edit this referral'
      });
    }
    const updated = await ReferralModel.updateById(req.params.id, req.body);
    res.status(200).json({
      success: true,
      data: updated,
      message: 'Referral updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Author or admin deletes.
export const deleteReferral = async (req, res) => {
  try {
    const referral = await ReferralModel.findById(req.params.id);
    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'Referral not found'
      });
    }
    const isAuthor = String(referral.authorAuthId) === String(req.user._id);
    if (req.user.role !== 'admin' && !isAuthor) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: only the author can delete this referral'
      });
    }
    await ReferralModel.deleteById(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Referral deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Students (and alumni) apply directly.
export const applyToReferral = async (req, res) => {
  try {
    const referral = await ReferralModel.findById(req.params.id);
    if (!referral || !referral.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Referral not found or no longer active'
      });
    }
    if (String(referral.authorAuthId) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot apply to your own referral'
      });
    }

    const profile = await UserModel.findByAuthId(req.user._id);
    const application = await ReferralApplicationModel.apply({
      referralId: req.params.id,
      applicantAuthId: req.user._id,
      email: req.user.email,
      name: profile?.name || '',
      note: req.body.note,
    });

    res.status(201).json({
      success: true,
      data: application,
      message: 'Application submitted successfully'
    });
  } catch (error) {
    const status = error.message === 'You already applied to this opportunity' ? 409 : 500;
    res.status(status).json({
      success: false,
      message: error.message
    });
  }
};

// Author or admin sees applicants.
export const listApplications = async (req, res) => {
  try {
    const referral = await ReferralModel.findById(req.params.id);
    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'Referral not found'
      });
    }
    const isAuthor = String(referral.authorAuthId) === String(req.user._id);
    if (req.user.role !== 'admin' && !isAuthor) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: only the author can view applicants'
      });
    }
    const applications = await ReferralApplicationModel.findByReferral(req.params.id);
    res.status(200).json({ success: true, data: applications });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Own applications (for the student "Applied" view).
export const listMyApplications = async (req, res) => {
  try {
    const applications = await ReferralApplicationModel.findMine(req.user._id);
    res.status(200).json({ success: true, data: applications });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Author or admin updates an application status.
export const updateApplication = async (req, res) => {
  try {
    const { status } = req.body;
    if (!APPLICATION_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${APPLICATION_STATUSES.join(', ')}`
      });
    }
    const application = await ReferralApplicationModel.findById(req.params.appId);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }
    const referral = await ReferralModel.findById(application.referralId);
    const isAuthor = referral && String(referral.authorAuthId) === String(req.user._id);
    if (req.user.role !== 'admin' && !isAuthor) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden'
      });
    }
    const updated = await ReferralApplicationModel.updateStatus(req.params.appId, status);
    res.status(200).json({
      success: true,
      data: updated,
      message: `Application ${status}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
