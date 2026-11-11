import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import AuthModel from './auth.models.js';
import UserModel from '../users/users.models.js';
import ActivityModel from '../activity/activity.models.js';
import { sendOTPEmail } from '../../utils/email.js';
import { authEmail, isOTP, newPasswordError } from './auth.validation.js';
import { createPasswordReset, resetTokenHash } from './password-reset.js';
import { signSessionToken, verifySessionToken, activeAccount, sessionMatches, sessionVersion } from './session-token.js';
import { requestAccountMatches, rejectChangedAccount } from './request-account.js';
import { sessionCookieOptions } from '../../config/session-cookie.js';

const hasUsableLocalPassword = (user) => (
    user?.passwordSetupRequired === false && typeof user?.password === 'string' && user.password.length > 0
);

const generateOTP = () => {
    return randomInt(100000, 1000000).toString();
};

// Perform the same bcrypt work for unknown, disabled and passwordless accounts.
// This hash is a timing placeholder, never an account credential.
const dummyPasswordHash = bcrypt.hashSync('alumnilink-login-timing-placeholder', 10);
const recoveryResponse = res => res.status(200).json({
    success: true, message: 'If the account is eligible, a reset code has been sent.'
});
const logRecoveryOutcome = (res, outcome) => {
    try {
        console.log(JSON.stringify({ event: 'auth.recovery', operation: 'password_recovery',
            requestId: res.getHeader?.('X-Request-Id'), outcome }));
    } catch { /* Operational diagnostics must not change recovery behavior. */ }
};

// Keep the old endpoint explicitly closed, including for callers bypassing the UI.
export const signup = (_req, res) => res.status(403).json({
    success: false,
    message: 'Public registration is disabled. Use the single-use login link sent to your university-registered email.'
});

export const login = async (req, res) => {
    try {
        const email = authEmail(req.body?.email);
        const password = req.body?.password;

        if (!email || typeof password !== 'string' || !password || password.length > 1024) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        const user = await AuthModel.findByEmail(email);
        const canLogin = activeAccount(user) && hasUsableLocalPassword(user);
        const isPasswordValid = await bcrypt.compare(password, canLogin ? user.password : dummyPasswordHash);
        if (!canLogin || !isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const userProfile = await UserModel.findByAuthId(user._id);

        const token = signSessionToken(user);

        res.cookie('token', token, sessionCookieOptions());

        // Audit trail (fire-and-forget — never blocks login).
        void ActivityModel.log({ authId: user._id, email: user.email, action: 'login', role: user.role, ip: req.ip });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    ...(userProfile || { email: user.email, name: userProfile?.name }),
                    authId: String(user._id),
                    role: user.role,
                    passwordSetupRequired: !hasUsableLocalPassword(user)
                }
            }
        });
    } catch {
        res.status(500).json({
            success: false,
            message: 'Unable to sign in. Please try again later.'
        });
    }
};

export const setupPassword = async (req, res) => {
    try {
        const { newPassword, confirmPassword } = req.body;

        if (typeof newPassword !== 'string' || typeof confirmPassword !== 'string' || !newPassword || !confirmPassword) {
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

        const passwordError = newPasswordError(newPassword);
        if (passwordError) {
            return res.status(400).json({
                success: false,
                message: passwordError
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
        const result = await AuthModel.updatePasswordById(req.user._id, hashedPassword, req.user);

        if (!result.modifiedCount) {
            return res.status(409).json({
                success: false,
                message: 'Unable to update your password. Please try again.'
            });
        }

        // Sign only the version produced by this write, never a later concurrent
        // password change/revocation observed by a subsequent database read.
        const updatedAuth = { ...req.user, sessionVersion: sessionVersion(req.user) + 1 };
        const jwtToken = signSessionToken(updatedAuth);

        res.cookie('token', jwtToken, sessionCookieOptions());

        const userProfile = await UserModel.findByAuthId(req.user._id);
        res.status(200).json({
            success: true,
            message: 'Password set successfully. Redirecting to your account...',
            data: {
                user: {
                    ...(userProfile || { email: req.user.email, name: userProfile?.name }),
                    authId: String(req.user._id),
                    role: req.user.role,
                    passwordSetupRequired: false
                }
            }
        });
    } catch {
        res.status(500).json({
            success: false,
            message: 'Unable to set your password. Please try again later.'
        });
    }
};

// Logged-in user changes their own password (Security tab).
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (typeof currentPassword !== 'string' || currentPassword.length > 1024 ||
            typeof newPassword !== 'string' || typeof confirmPassword !== 'string' ||
            !currentPassword || !newPassword || !confirmPassword) {
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

        const passwordError = newPasswordError(newPassword);
        if (passwordError) {
            return res.status(400).json({
                success: false,
                message: passwordError
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
        const result = await AuthModel.updatePasswordById(user._id, hashedPassword, req.user);
        if (!result.modifiedCount) {
            return res.status(409).json({ success: false, message: 'Your account changed. Please sign in again before changing your password.' });
        }
        if (['student', 'alumni', 'admin'].includes(user.role)) {
            await ActivityModel.logPasswordChange({ authId: user._id });
        }
        res.clearCookie('token', sessionCookieOptions({ persistent: false }));

        res.status(200).json({
            success: true,
            message: 'Password changed successfully. Please sign in again.',
            reauthenticationRequired: true
        });
    } catch {
        res.status(500).json({
            success: false,
            message: 'Unable to change your password. Please try again later.'
        });
    }
};

export const forgotPassword = async (req, res) => {
    try {
        const email = authEmail(req.body?.email);

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address'
            });
        }

        const user = await AuthModel.findByEmail(email);
        if (!activeAccount(user) || !hasUsableLocalPassword(user)) {
            logRecoveryOutcome(res, 'not_eligible');
            return recoveryResponse(res);
        }

        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        await AuthModel.updateOTP(email, otp, otpExpires);

        const emailResult = await sendOTPEmail(email, otp);
        if (!emailResult.success) {
            // Match this request's code so a failed send cannot clear a newer resend.
            await AuthModel.clearOTP(email, otp);
            logRecoveryOutcome(res, 'delivery_failed');
            // Delivery status must not disclose that this account exists.
            return recoveryResponse(res);
        }

        logRecoveryOutcome(res, 'accepted_for_delivery');
        return recoveryResponse(res);
    } catch {
        console.error('Password recovery request failed');
        res.status(500).json({
            success: false,
            message: 'Unable to process password recovery. Please try again later.'
        });
    }
};

export const verifyOTP = async (req, res) => {
    try {
        const email = authEmail(req.body?.email);
        const otp = req.body?.otp;

        if (!email || !isOTP(otp)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address and 6-digit OTP'
            });
        }

        const reset = createPasswordReset();
        const user = await AuthModel.exchangeOTPForResetToken(email, otp, reset.tokenHash, reset.expiresAt);
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

        res.status(200).json({
            success: true,
            message: 'OTP verified successfully',
            data: { resetToken: reset.token }
        });
    } catch {
        res.status(500).json({
            success: false,
            message: 'Unable to verify the reset code. Please try again later.'
        });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const tokenHash = resetTokenHash(req.body?.token);
        const newPassword = req.body?.newPassword;

        if (typeof newPassword !== 'string' || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a new password'
            });
        }

        const passwordError = newPasswordError(newPassword);
        if (passwordError) {
            return res.status(400).json({
                success: false,
                message: passwordError
            });
        }

        if (!tokenHash) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        const user = await AuthModel.findByResetToken(tokenHash);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired reset token'
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

        const result = await AuthModel.resetPasswordWithToken(user._id, tokenHash, hashedPassword);
        if (!result.modifiedCount) {
            return res.status(401).json({ success: false, message: 'Invalid or expired reset token' });
        }
        if (['student', 'alumni', 'admin'].includes(user.role)) {
            await ActivityModel.logPasswordChange({ authId: user._id, action: 'password_reset' });
        }

        res.status(200).json({
            success: true,
            message: 'Password reset successful. You can now login with your new password.'
        });
    } catch {
        res.status(500).json({
            success: false,
            message: 'Unable to reset your password. Please try again later.'
        });
    }
};

export const logout = async (req, res) => {
    let decoded;
    try { if (req.cookies?.token) decoded = verifySessionToken(req.cookies.token); }
    catch { /* An invalid/expired cookie grants no session to revoke. */ }
    try {
        if (decoded) {
            const user = await AuthModel.findById(decoded.sub);
            if (sessionMatches(decoded, user)) {
                if (!requestAccountMatches(req, user)) return rejectChangedAccount(res);
                const result = await AuthModel.revokeSessionsById(user._id);
                if (!result.modifiedCount) throw new Error('Session revocation did not complete');
                // Audit logging is optional; session revocation above is mandatory.
                void ActivityModel.log({ authId: user._id, email: user.email, action: 'logout', role: user.role, ip: req.ip }).catch(() => {});
            }
        }

        res.clearCookie('token', sessionCookieOptions({ persistent: false }));
        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch {
        // Retain the cookie so the client can retry server-side revocation.
        res.status(503).json({
            success: false,
            message: 'Unable to complete logout. Please try again.'
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
                authId: String(req.user._id),
                role: req.user.role,
                passwordSetupRequired: !hasUsableLocalPassword(req.user)
            }
        });
    } catch {
        res.status(500).json({
            success: false,
            message: 'Unable to load your session. Please try again later.'
        });
    }
};
