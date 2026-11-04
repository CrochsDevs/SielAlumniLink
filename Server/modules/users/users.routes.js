import express from 'express';
import { 
  getUsers, 
  getUserById, 
  getMyProfile,
  createUser, 
  updateUser, 
  updateUserRole,
  updateMyProfile,
  updateMyExperience,
  graduateUser,
  syncUsers,
  deleteUser,
  trackProfileView 
} from './users.controllers.js';
import { protect, authorize } from '../../middlewares/auth.middleware.js';
import Roles from '../../constant/roles.js';
import { client } from '../../config/db.js';
import { createFeedService } from '../feed/feed.service.js';
import { createMemberActivityService } from '../activity/member-activity.service.js';

const router = express.Router();

// All user endpoints require login
router.use(protect);

const db = client.db('SielAlumni');
const memberActivity = createMemberActivityService(db, createFeedService(db));
router.get('/:id/activity', async (req, res) => {
  try {
    res.json({ success: true, data: await memberActivity(req.user, req.params.id, req.query) });
  } catch (error) {
    res.status(error.status || 500).json({ success: false,
      message: error.status ? error.message : 'Unable to load activity. Please try again.' });
  }
});

// Directory: any authenticated role (student / alumni / admin)
router.get('/', getUsers);

// Own profile: any authenticated user (must come before '/:id' routes)
router.put('/me', updateMyProfile);
router.put('/me/experience', updateMyExperience);
router.get('/me', getMyProfile);

router.get('/:id', getUserById);

// Track profile view (any authenticated user viewing another's profile)
router.post('/:id/view', trackProfileView);

// Graduation (Student -> Alumni): admin only.
router.post('/graduate', authorize(Roles.ADMIN), graduateUser);

// CAIS bulk sync: admin only (must come before '/:id' routes).
router.post('/sync', authorize(Roles.ADMIN), syncUsers);

// Management: admin only
router.post('/', authorize(Roles.ADMIN), createUser);
router.put('/:id', authorize(Roles.ADMIN), updateUser);
router.put('/:id/role', authorize(Roles.ADMIN), updateUserRole);
router.delete('/:id', authorize(Roles.ADMIN), deleteUser);

export default router;
