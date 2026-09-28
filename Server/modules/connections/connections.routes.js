import express from 'express';
import { createConnection, getMyConnections, getConnections, updateConnection, deleteConnection } from './connections.controllers.js';
import { protect, authorize } from '../../middlewares/auth.middleware.js';
import Roles from '../../constant/roles.js';

const router = express.Router();

router.use(protect);

// Own network: any logged-in role (must come before '/').
router.get('/me', getMyConnections);
router.post('/', createConnection);
router.put('/:id', updateConnection);

// Whole network: admin only.
router.get('/', authorize(Roles.ADMIN), getConnections);
router.delete('/:id', authorize(Roles.ADMIN), deleteConnection);

export default router;
