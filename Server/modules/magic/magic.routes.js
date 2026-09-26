import express from 'express';
import {
    sendMagicLink,
    verifyMagicLink
} from './magic.controllers.js';

const router = express.Router();

router.post('/magic-link/send', sendMagicLink);
router.get('/magic-link/verify', verifyMagicLink);

export default router;
