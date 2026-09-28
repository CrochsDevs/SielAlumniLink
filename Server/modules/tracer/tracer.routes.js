import express from 'express';
import { submitResponse, getMyResponse, getResponses } from './tracer.controllers.js';
import { protect, authorize } from '../../middlewares/auth.middleware.js';
import Roles from '../../constant/roles.js';

const router = express.Router();

router.use(protect);

// Own response: any logged-in role (must come before '/').
router.get('/me', getMyResponse);
router.post('/', submitResponse);

// Dashboard: admin only.
router.get('/', authorize(Roles.ADMIN), getResponses);

export default router;
