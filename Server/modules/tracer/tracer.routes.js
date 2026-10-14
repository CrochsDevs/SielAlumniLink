import express from 'express';
import { submitResponse, getMyResponse, getResponses, checkAccess, getAlignmentReport } from './tracer.controllers.js';
import { protect, authorize } from '../../middlewares/auth.middleware.js';
import Roles from '../../constant/roles.js';

const router = express.Router();

router.use(protect);

// Own response: any logged-in role (must come before '/').
router.get('/me', getMyResponse);
router.post('/', submitResponse);
router.get('/access', checkAccess);

// Dashboard: admin only.
router.get('/alignment', authorize(Roles.ADMIN), getAlignmentReport);
router.get('/', authorize(Roles.ADMIN), getResponses);

export default router;
