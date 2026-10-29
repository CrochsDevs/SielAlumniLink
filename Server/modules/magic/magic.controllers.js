import crypto from 'crypto';
import MagicLinkModel from './magic.models.js';
import UserModel from '../users/users.models.js';
import AuthModel from '../auth/auth.models.js';
import ActivityModel from '../activity/activity.models.js';
import Roles from '../../constant/roles.js';
import { sendMagicLinkEmail } from '../../utils/email.js';
import { authEmail } from '../auth/auth.validation.js';
import { signSessionToken, activeAccount, sessionVersion } from '../auth/session-token.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const MAGIC_LINK_EXPIRY_MINUTES = 15;

const hasUsableLocalPassword = (user) => (
  user?.passwordSetupRequired === false && typeof user?.password === 'string' && user.password.length > 0
);

const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

export const sendMagicLink = async (req, res) => {
  try {
    const email = authEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    let user = await AuthModel.findByEmail(email);
    if (!user) {
      // Email-only records (CAIS users collection, no login yet):
      // auto-create the login record on first magic-link request.
      // Preserve the authoritative imported role; never guess elevated access.
      const profile = await UserModel.findByEmail(email);
      const role = String(profile?.role || '').toLowerCase();
      if (!profile || ![Roles.STUDENT, Roles.ALUMNI].includes(role)) {
        return res.status(200).json({ success: true, message: 'If an account exists, a login link has been sent.' });
      }
      const newAuth = await AuthModel.createSyncedUser({ email, role });
      // Link the existing profile to the new login record.
      await UserModel.updateById(String(profile._id), { authId: newAuth._id });
      user = newAuth;
    }
    if (!activeAccount(user)) return res.status(200).json({ success: true, message: 'If an account exists, a login link has been sent.' });

    const token = generateToken();
    const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000);

    await MagicLinkModel.deleteByEmail(email);

    await MagicLinkModel.create({
      email,
      token,
      expiresAt,
      usedAt: null,
      authId: user._id,
      sessionVersion: sessionVersion(user)
    });

    const loginUrl = `${FRONTEND_URL}/verify-magic-link?token=${token}`;
    const emailResult = await sendMagicLinkEmail(email, loginUrl);

    if (!emailResult.success) {
      await MagicLinkModel.deleteToken(token);
      return res.status(200).json({
        success: true,
        message: 'If an account exists, a login link has been sent.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'If an account exists, a login link has been sent.'
    });
  } catch {
    console.error('Login link request failed');
    res.status(500).json({
      success: false,
      message: 'Unable to process the login link request. Please try again later.'
    });
  }
};

const invalidMagicLink = (res, message) => res.status(200).json({
    success: false,
    message
  });

export const verifyMagicLink = async (req, res) => {
  try {
    const { token } = req.query;

    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
      return invalidMagicLink(res, 'Invalid or missing token');
    }

    const magicLink = await MagicLinkModel.claimToken(token);
    if (!magicLink) {
      return invalidMagicLink(res, 'This login link has already been used');
    }

    if (new Date(magicLink.expiresAt) < new Date()) {
      return invalidMagicLink(res, 'This login link has expired');
    }

    const user = await AuthModel.findByEmail(magicLink.email);
    if (!activeAccount(user) || String(magicLink.authId) !== String(user._id) || magicLink.sessionVersion !== sessionVersion(user)) {
      return invalidMagicLink(res, 'User not found');
    }

    const userProfile = await UserModel.findByAuthId(user._id);
    const publicUser = {
      ...(userProfile || {}),
      authId: String(user._id),
      role: user.role,
      passwordSetupRequired: !hasUsableLocalPassword(user)
    };

    const jwtToken = signSessionToken(user);

    res.cookie('token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // Audit trail (fire-and-forget).
    void ActivityModel.log({ authId: user._id, email: user.email, action: 'login', ip: req.ip });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: publicUser
      }
    });
  } catch {
    console.error('Login link verification failed');
    res.status(500).json({
      success: false,
      message: 'Unable to verify the login link. Please try again later.'
    });
  }
};
