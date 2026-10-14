import express from 'express';
import { protect, authorize } from '../../middlewares/auth.middleware.js';
import { getEmployment, saveEmployment, addExperience, removeExperience, getReport } from './employment.controllers.js';

const router = express.Router();
router.use(protect);
router.get('/reports', authorize('admin'), getReport);
router.use(authorize('alumni', 'admin'));
router.get('/me', getEmployment);
router.put('/me', saveEmployment);
router.post('/history', addExperience);
router.delete('/history/:index', removeExperience);
export default router;
