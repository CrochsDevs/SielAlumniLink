import express from 'express';
import {
    signup,
    login,
    logout,
    forgotPassword,
    verifyOTP,
    resetPassword,
    setupPassword,
    changePassword,
    getMe
} from './auth.controllers.js';
import {
    sendMagicLink,
    verifyMagicLink
} from '../magic/magic.controllers.js';
import { optionalProtect, protect } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/magic-link/send', sendMagicLink);
router.get('/magic-link/verify', verifyMagicLink);

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOTP);
router.post('/reset-password', resetPassword);
router.post('/password/setup', protect, setupPassword);
router.post('/password/change', protect, changePassword);
router.get('/me', optionalProtect, getMe);

export default router;
