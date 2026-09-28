import express from 'express';
import { listPosts, getSavedPosts, createPost, updatePost, deletePost, toggleSavePost } from './career-posts.controllers.js';
import { protect } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

// Read + save: any logged-in role (order matters — '/saved/me' before '/:id').
router.get('/saved/me', getSavedPosts);
router.get('/', listPosts);
router.post('/', createPost);
router.put('/:id', updatePost);
router.delete('/:id', deletePost);
router.post('/:id/save', toggleSavePost);

export default router;
