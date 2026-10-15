import express from 'express';
import { client } from '../../config/db.js';
import { protect, authorize } from '../../middlewares/auth.middleware.js';
import { createReportService } from './reports.service.js';

const router = express.Router();
const service = createReportService(client.db('SielAlumni'));
router.get('/dashboard', protect, authorize('admin'), async (req, res) => {
  try { res.json({ success: true, data: await service.dashboard(req.user, req.query) }); }
  catch (error) { res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to load dashboard reports. Please try again.' }); }
});
export default router;
