import express from 'express';
import { createSearchHandler } from './search.controllers.js';
import { protect, authorize } from '../../middlewares/auth.middleware.js';

const router = express.Router();
router.use(protect, authorize('student', 'alumni', 'admin'));
router.get('/suggestions', createSearchHandler(undefined, true));
router.get('/all', createSearchHandler());
export default router;
