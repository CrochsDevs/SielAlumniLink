import multer from 'multer';
import JobModel from './jobs.models.js';
import ApplicationModel from './job-applications.models.js';
import AuthModel from '../auth/auth.models.js';
import { createApplicationHandlers, MAX_RESUME_BYTES } from './job-applications.controllers.js';
import express from 'express';
import { listJobs, getJob, createJob, updateJob, deleteJob } from './jobs.controllers.js';
import { protect, authorize } from '../../middlewares/auth.middleware.js';
import Roles from '../../constant/roles.js';

const router = express.Router();

router.use(protect);

const applications = createApplicationHandlers({ jobs: JobModel, applications: ApplicationModel, accounts: AuthModel });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_RESUME_BYTES, files: 2, fields: 4, fieldSize: 20000 } }).fields([{ name: 'resume', maxCount: 1 }, { name: 'coverNote', maxCount: 1 }]);
router.get('/applications/me', applications.mine);
router.get('/applications/:applicationId/resume', applications.resume);
router.get('/applications/:applicationId/cover-note', applications.coverNote);
router.get('/:id/applications', authorize(Roles.ADMIN), applications.list);
router.post('/:id/apply', authorize(Roles.ALUMNI, Roles.STUDENT), (req, res, next) => {
  upload(req, res, error => {
    if (error) return res.status(400).json({ success: false, message: 'Upload one PDF resume and an optional PDF cover note, up to 5 MB each.' });
    next();
  });
}, applications.submit);

// Board: any logged-in role.
router.get('/', listJobs);
router.get('/:id', getJob);

// Management: admin only.
router.post('/', authorize(Roles.ADMIN), createJob);
router.put('/:id', authorize(Roles.ADMIN), updateJob);
router.delete('/:id', authorize(Roles.ADMIN), deleteJob);

export default router;
