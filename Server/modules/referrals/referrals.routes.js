import express from 'express';
import {
  listReferrals, getReferral, createReferral, updateReferral, deleteReferral,
  applyToReferral, listApplications, listMyApplications, updateApplication,
} from './referrals.controllers.js';
import { protect } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

// Browse + apply: any logged-in role (order matters — static paths first).
router.get('/applications/me', listMyApplications);
router.get('/', listReferrals);
router.get('/:id', getReferral);
router.post('/', createReferral);
router.put('/:id', updateReferral);
router.delete('/:id', deleteReferral);
router.post('/:id/apply', applyToReferral);
router.get('/:id/applications', listApplications);
router.put('/applications/:appId', updateApplication);

export default router;
