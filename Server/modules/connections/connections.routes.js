import express from 'express';
import { createConnection, getMyConnections, listRequests, getConnections, updateConnection, deleteConnection } from './connections.controllers.js';
import { protect, authorize } from '../../middlewares/auth.middleware.js';
import Roles from '../../constant/roles.js';
import { adminConnectionHandler } from './connections.admin.js';

const router = express.Router();

router.use(protect);

// Own network: any logged-in role (must come before '/').
router.get('/me', getMyConnections);
router.get('/requests', listRequests);
router.post('/', createConnection);
router.put('/:id', updateConnection);

// Whole network: admin only.
router.get('/members', authorize(Roles.ADMIN), adminConnectionHandler());
router.get('/members/:authId', authorize(Roles.ADMIN), adminConnectionHandler(true));
router.get('/', authorize(Roles.ADMIN), getConnections);
router.delete('/:id', authorize(Roles.ADMIN), deleteConnection);

export default router;
