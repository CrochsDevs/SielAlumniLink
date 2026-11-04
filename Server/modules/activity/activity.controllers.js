import ActivityModel from './activity.models.js';

// Admin-only, read-only: student and alumni access history (admin actors excluded).
export const getActivity = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const logs = await ActivityModel.listRecent(limit);

    res.status(200).json({
      success: true,
      data: logs,
      message: 'Activity logs fetched successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
