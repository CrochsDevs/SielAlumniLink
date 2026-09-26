import express from 'express';
import { 
  getUsers, 
  getUserById, 
  createUser, 
  updateUser, 
  updateUserRole,
  updateMyProfile,
  deleteUser 
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

router.get('/:id', getUserById);

// Management: admin only
router.post('/', authorize(Roles.ADMIN), createUser);
router.put('/:id', authorize(Roles.ADMIN), updateUser);
router.put('/:id/role', authorize(Roles.ADMIN), updateUserRole);
router.delete('/:id', authorize(Roles.ADMIN), deleteUser);

export default router;