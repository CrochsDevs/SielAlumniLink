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
import { createAuthLimiter } from './auth-limits.js';

const router = express.Router();

router.post('/magic-link/send', createAuthLimiter('send'), sendMagicLink);
router.get('/magic-link/verify', createAuthLimiter('verify'), verifyMagicLink);

router.post('/signup', signup);
router.post('/login', createAuthLimiter('login'), login);
router.post('/logout', logout);
router.post('/forgot-password', createAuthLimiter('send'), forgotPassword);
router.post('/verify-otp', createAuthLimiter('verify'), verifyOTP);
router.post('/reset-password', createAuthLimiter('reset'), resetPassword);
router.post('/password/setup', protect, createAuthLimiter('change'), setupPassword);
router.post('/password/change', protect, createAuthLimiter('change'), changePassword);
router.get('/me', optionalProtect, getMe);

export default router;
