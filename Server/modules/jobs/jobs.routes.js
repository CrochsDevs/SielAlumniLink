import express from 'express';
import { listJobs, getJob, createJob, updateJob, deleteJob } from './jobs.controllers.js';
import { protect, authorize } from '../../middlewares/auth.middleware.js';
import Roles from '../../constant/roles.js';

const router = express.Router();

router.use(protect);

// Board: any logged-in role.
router.get('/', listJobs);
router.get('/:id', getJob);

// Management: admin only.
router.post('/', authorize(Roles.ADMIN), createJob);
router.put('/:id', authorize(Roles.ADMIN), updateJob);
router.delete('/:id', authorize(Roles.ADMIN), deleteJob);

export default router;
