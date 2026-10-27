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

const router = express.Router();

// All user endpoints require login
router.use(protect);

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
