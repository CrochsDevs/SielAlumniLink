import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import MagicLinkModel from './magic.models.js';
import UserModel from '../users/users.models.js';
import AuthModel from '../auth/auth.models.js';
import ActivityModel from '../activity/activity.models.js';
import { sendMagicLinkEmail } from '../../utils/email.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = '7d';
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
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email'
      });
    }

    const user = await AuthModel.findByEmail(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email.'
      });
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000);

    await MagicLinkModel.deleteByEmail(email);

    await MagicLinkModel.create({
      email,
      token,
      expiresAt,
      usedAt: null
    });

    const loginUrl = `${FRONTEND_URL}/verify-magic-link?token=${token}`;
    const emailResult = await sendMagicLinkEmail(email, loginUrl);

    if (!emailResult.success) {
      console.log('Magic link for development:', loginUrl);
    }

    res.status(200).json({
      success: true,
      message: 'If an account exists, a login link has been sent.'
    });
  } catch (error) {
    console.error('Send magic link error:', error);
    res.status(500).json({
      success: false,
      message: error.message
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

    if (!token) {
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
    if (!user) {
      return invalidMagicLink(res, 'User not found');
    }

    const userProfile = await UserModel.findByAuthId(user._id);
    const publicUser = {
      ...(userProfile || {}),
      role: user.role,
      passwordSetupRequired: !hasUsableLocalPassword(user)
    };

    const jwtToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRE }
    );

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
  } catch (error) {
    console.error('Verify magic link error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};