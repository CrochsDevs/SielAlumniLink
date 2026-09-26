import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import AuthModel from './auth.models.js';
import UserModel from '../users/users.models.js';
import ActivityModel from '../activity/activity.models.js';
import Roles from '../../constant/roles.js';
import { sendOTPEmail } from '../../utils/email.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = '7d';

const hasUsableLocalPassword = (user) => (
    user?.passwordSetupRequired === false && typeof user?.password === 'string' && user.password.length > 0
);

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export const signup = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide name, email and password'
            });
        }

        // Public signup can only create student/alumni.
        // Admins are promoted from existing DB accounts (promote-admin script).
        if (role && ![Roles.STUDENT, Roles.ALUMNI].includes(role)) {
            return res.status(403).json({
                success: false,
                message: 'Not allowed to assign this role'
            });
        }

        const existingUser = await AuthModel.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newAuth = await AuthModel.createUser({
            email,
            password: hashedPassword,
            role
        });

        const newUserProfile = await UserModel.createUserProfile(newAuth._id, {
            name,
            email
        });

        const token = jwt.sign(
            { id: newAuth._id, email: newAuth.email, role: newAuth.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRE }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: {
                user: {
                    _id: newUserProfile._id,
                    name: newUserProfile.name,
                    email: newUserProfile.email,
                    role: newAuth.role
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        const user = await AuthModel.findByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        if (!hasUsableLocalPassword(user)) {
            return res.status(403).json({
                success: false,
                message: 'Password is not set yet. Use the magic link to set a new password.'
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const userProfile = await UserModel.findByAuthId(user._id);

        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRE }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // Audit trail (fire-and-forget — never blocks login).
        void ActivityModel.log({ authId: user._id, email: user.email, action: 'login', ip: req.ip });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    ...(userProfile || { email: user.email, name: userProfile?.name }),
                    role: user.role,
                    passwordSetupRequired: !hasUsableLocalPassword(user)
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const setupPassword = async (req, res) => {
    try {
        const { newPassword, confirmPassword } = req.body;

        if (!newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide your new password and confirmation'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        if (hasUsableLocalPassword(req.user)) {
            return res.status(409).json({
                success: false,
                message: 'Password is already set. You can log in normally.'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        const result = await AuthModel.updatePasswordById(req.user._id, hashedPassword);

        if (!result.modifiedCount) {
            return res.status(409).json({
                success: false,
                message: 'Unable to update your password. Please try again.'
            });
        }

        const jwtToken = jwt.sign(
            { id: req.user._id, email: req.user.email, role: req.user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRE }
        );

        res.cookie('token', jwtToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 1000
        });

        const userProfile = await UserModel.findByAuthId(req.user._id);
        res.status(200).json({
            success: true,
            message: 'Password set successfully. Redirecting to your account...',
            data: {
                user: {
                    ...(userProfile || { email: req.user.email, name: userProfile?.name }),
                    role: req.user.role,
                    passwordSetupRequired: false
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Logged-in user changes their own password (Security tab).
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide current password, new password and confirmation'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'New passwords do not match'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        const user = await AuthModel.findByEmail(req.user.email);
        if (!user?.password) {
            return res.status(400).json({
                success: false,
                message: 'No password set yet. Use the setup flow first.'
            });
        }

        const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        await AuthModel.updatePasswordById(user._id, hashedPassword);

        res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const forgotPassword = async (req, res) => {    try {
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
                message: 'User not found with this email'
            });
        }

        if (!hasUsableLocalPassword(user)) {
            return res.status(403).json({
                success: false,
                message: 'Password is not set yet. Use the magic link to set a new password.'
            });
        }

        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        await AuthModel.updateOTP(email, otp, otpExpires);

        const emailResult = await sendOTPEmail(email, otp);

        if (emailResult.success) {
            res.status(200).json({
                success: true,
                message: 'OTP sent to your email. Valid for 10 minutes.'
            });
        } else {
            console.log('⚠️ OTP for development:', otp);
            res.status(200).json({
                success: true,
                message: 'OTP generated. Check terminal for OTP (development mode).',
                devOTP: otp
            });
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and OTP'
            });
        }

        const user = await AuthModel.findByOTP(email, otp);
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP'
            });
        }

        if (!hasUsableLocalPassword(user)) {
            return res.status(403).json({
                success: false,
                message: 'Password is not set yet. Use the magic link to set a new password.'
            });
        }

        const resetToken = jwt.sign(
            { email: user.email },
            JWT_SECRET,
            { expiresIn: '10m' }
        );

        res.status(200).json({
            success: true,
            message: 'OTP verified successfully',
            data: { resetToken }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide token and new password'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        const user = await AuthModel.findByEmail(decoded.email);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!hasUsableLocalPassword(user)) {
            return res.status(403).json({
                success: false,
                message: 'Password is not set yet. Use the magic link to set a new password.'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await AuthModel.updatePassword(user.email, hashedPassword);

        res.status(200).json({
            success: true,
            message: 'Password reset successful. You can now login with your new password.'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const logout = async (req, res) => {
    try {
        // Audit trail: best-effort decode of who is logging out.
        try {
            const token = req.cookies?.token;
            if (token) {
                const decoded = jwt.verify(token, JWT_SECRET);
                void ActivityModel.log({ authId: decoded.id, email: decoded.email, action: 'logout', ip: req.ip });
            }
        } catch {
            // ignore — logout must always succeed
        }

        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });
        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const getMe = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(200).json({
                success: true,
                data: null
            });
        }

        const userProfile = await UserModel.findByAuthId(req.user._id);
        res.status(200).json({
            success: true,
            data: {
                ...(userProfile || { email: req.user.email }),
                role: req.user.role,
                passwordSetupRequired: !hasUsableLocalPassword(req.user)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};