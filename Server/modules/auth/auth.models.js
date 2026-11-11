import { client } from '../../config/db.js';
import Roles from '../../constant/roles.js';
import { authEmail, isOTP } from './auth.validation.js';
import { isResetToken, otpHash } from './password-reset.js';
import { ObjectId } from 'mongodb';
import { sessionsRevoked } from './session-events.js';
import { sessionVersion } from './session-token.js';

const db = client.db('SielAlumni');
const authCollection = db.collection('auth');
const accountId = value => ObjectId.isValid(String(value)) ? new ObjectId(String(value)) : value;
const notifyChange = async (authId, operation) => {
    const result = await operation;
    if (result.modifiedCount) sessionsRevoked(authId);
    return result;
};

// Roles that can be assigned at creation (never ADMIN — admins are
// promoted from existing DB accounts via the promote-admin script).
const CREATABLE_ROLES = [Roles.STUDENT, Roles.ALUMNI];

export const AuthModel = {
    async setPresenceStatus(authId, status) {
        if (!['active', 'busy'].includes(status)) throw new TypeError('Invalid presence status');
        const result = await authCollection.updateOne(
            { _id: accountId(authId), disabledAt: null },
            { $set: { presenceStatus: status } }
        );
        if (!result.matchedCount) throw new Error('Account is unavailable');
    },
    async findByEmail(email) {
        email = authEmail(email);
        if (!email) return null;
        return await authCollection.findOne({ email });
    },

    async findById(id) {
        try {
            const { ObjectId } = await import('mongodb');
            const objectId = id instanceof ObjectId ? id : new ObjectId(id);
            return await authCollection.findOne({ _id: objectId });
        } catch {
            return await authCollection.findOne({ _id: id });
        }
    },

    async createUser(userData) {
        const { role, ...rest } = userData;
        const newUser = {
            ...rest,
            role: CREATABLE_ROLES.includes(role) ? role : Roles.ALUMNI,
            isVerified: true,
            passwordSetupRequired: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const result = await authCollection.insertOne(newUser);
        return { ...newUser, _id: result.insertedId };
    },

    async updateOTP(email, otp, otpExpires) {
        email = authEmail(email);
        if (!email || !isOTP(otp)) throw new TypeError('Invalid recovery input');
        return await authCollection.updateOne(
            { email },
            {
                $set: {
                    resetOTPHash: otpHash(email, otp),
                    resetOTPExpires: otpExpires,
                    resetOTPAttempts: 0,
                    updatedAt: new Date()
                },
                $unset: { resetOTP: '', passwordResetTokenHash: '', passwordResetTokenExpires: '' }
            }
        );
    },

    async findByOTP(email, otp) {
        email = authEmail(email);
        if (!email || !isOTP(otp)) return null;
        return await authCollection.findOne({
            email: email,
            resetOTPHash: otpHash(email, otp),
            resetOTPExpires: { $gt: new Date() }
        });
    },

    async clearOTP(email, otp) {
        email = authEmail(email);
        if (!email || !isOTP(otp)) throw new TypeError('Invalid recovery input');
        return await authCollection.updateOne(
            { email, resetOTPHash: otpHash(email, otp) },
            { $set: { resetOTPHash: null, resetOTPExpires: null, updatedAt: new Date() }, $unset: { resetOTP: '' } }
        );
    },

    async exchangeOTPForResetToken(email, otp, tokenHash, expiresAt) {
        email = authEmail(email);
        if (!email || !isOTP(otp) || !isResetToken(tokenHash) || !(expiresAt instanceof Date) || !Number.isFinite(expiresAt.getTime())) {
            throw new TypeError('Invalid recovery input');
        }
        // Charge every guess atomically against the current challenge, across IPs.
        const attempt = await authCollection.findOneAndUpdate(
            { email, disabledAt: null, resetOTPExpires: { $gt: new Date() }, resetOTPHash: { $type: 'string' },
                $or: [{ resetOTPAttempts: { $exists: false } }, { resetOTPAttempts: { $lt: 5 } }] },
            { $inc: { resetOTPAttempts: 1 } }, { returnDocument: 'after' }
        );
        if (!attempt || attempt.resetOTPHash !== otpHash(email, otp)) return null;
        // Only one concurrent verifier can replace this OTP with a reset credential.
        return await authCollection.findOneAndUpdate(
            { email, disabledAt: null, resetOTPHash: otpHash(email, otp), resetOTPExpires: attempt.resetOTPExpires,
                passwordSetupRequired: false, password: { $type: 'string', $ne: '' } },
            { $set: { passwordResetTokenHash: tokenHash, passwordResetTokenExpires: expiresAt, updatedAt: new Date() },
                $unset: { resetOTP: '', resetOTPHash: '', resetOTPExpires: '', resetOTPAttempts: '' } },
            { returnDocument: 'after' }
        );
    },

    async findByResetToken(tokenHash) {
        if (!isResetToken(tokenHash)) return null;
        return await authCollection.findOne({ passwordResetTokenHash: tokenHash, disabledAt: null,
            passwordResetTokenExpires: { $gt: new Date() }, passwordSetupRequired: false,
            password: { $type: 'string', $ne: '' } });
    },

    async resetPasswordWithToken(authId, tokenHash, hashedPassword) {
        if (!isResetToken(tokenHash)) throw new TypeError('Invalid recovery input');
        // Password update and token consumption happen in the same atomic write.
        return await notifyChange(authId, authCollection.updateOne(
            { _id: accountId(authId), disabledAt: null, passwordResetTokenHash: tokenHash, passwordResetTokenExpires: { $gt: new Date() },
                passwordSetupRequired: false, password: { $type: 'string', $ne: '' } },
            { $set: { password: hashedPassword, passwordSetupRequired: false, updatedAt: new Date() }, $inc: { sessionVersion: 1 },
                $unset: { passwordResetTokenHash: '', passwordResetTokenExpires: '', resetOTP: '', resetOTPHash: '', resetOTPExpires: '', resetOTPAttempts: '' } }
        ));
    },

    async updatePassword(email, hashedPassword) {
        const user = await this.findByEmail(email);
        return user ? this.updatePasswordById(user._id, hashedPassword) : { modifiedCount: 0 };
    },

    async updatePasswordById(authId, hashedPassword, expectedState) {
        const filter = { _id: accountId(authId), disabledAt: null };
        if (expectedState) {
            // Compare the state authorized by the request in the password write itself.
            // Missing legacy versions mean zero, exactly as in session authorization.
            const version = sessionVersion(expectedState);
            if (version === 0) filter.$or = [{ sessionVersion: 0 }, { sessionVersion: { $exists: false } }];
            else filter.sessionVersion = version;
            filter.password = expectedState.password ?? null;
            filter.passwordSetupRequired = expectedState.passwordSetupRequired ?? null;
        }
        return await notifyChange(authId, authCollection.updateOne(
            filter,
            {
                $set: {
                    password: hashedPassword,
                    passwordSetupRequired: false,
                    resetOTP: null,
                    resetOTPHash: null,
                    resetOTPExpires: null,
                    updatedAt: new Date()
                },
                $inc: { sessionVersion: 1 },
                $unset: { passwordResetTokenHash: '', passwordResetTokenExpires: '', resetOTPAttempts: '' }
            }
        ));
    },

    async markPasswordSetupRequiredForExistingUsers() {
        return await authCollection.updateMany(
            { passwordSetupRequired: { $exists: false } },
            { $set: { passwordSetupRequired: true } }
        );
    },

    async updateRoleById(authId, role) {
        return await notifyChange(authId, authCollection.updateOne(
            { _id: accountId(authId) },
            { $set: { role, updatedAt: new Date() }, $inc: { sessionVersion: 1 } }
        ));
    },

    // Admin email change: login identity follows the new email.
    async updateEmailById(authId, email) {
        return await notifyChange(authId, authCollection.updateOne(
            { _id: accountId(authId) },
            { $set: { email, updatedAt: new Date() }, $inc: { sessionVersion: 1 },
                $unset: { passwordResetTokenHash: '', passwordResetTokenExpires: '', resetOTP: '', resetOTPHash: '', resetOTPExpires: '' } }
        ));
    },

    async revokeSessionsById(authId) {
        return notifyChange(authId, authCollection.updateOne({ _id: accountId(authId) },
            { $inc: { sessionVersion: 1 }, $set: { updatedAt: new Date() } }));
    },

    async disableById(authId) {
        // Retain an identity tombstone so old links/imports cannot recreate access.
        return notifyChange(authId, authCollection.updateOne({ _id: accountId(authId) },
            { $set: { disabledAt: new Date(), updatedAt: new Date() }, $inc: { sessionVersion: 1 },
                $unset: { password: '', resetOTP: '', resetOTPHash: '', resetOTPExpires: '', resetOTPAttempts: '',
                    passwordResetTokenHash: '', passwordResetTokenExpires: '' } }));
    },

    // CAIS-synced accounts: no local password. The user sets it later
    // via magic link -> setup-password. Role is pre-validated by caller.
    async createSyncedUser({ email, role }) {
        if (!authEmail(email) || !CREATABLE_ROLES.includes(role)) throw new TypeError('Invalid imported account');
        const newUser = {
            email,
            role,
            isVerified: true,
            passwordSetupRequired: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const result = await authCollection.insertOne(newUser);
        return { ...newUser, _id: result.insertedId };
    },

    // One-time normalization for accounts created before Roles existed
    // ('user' / missing role -> 'alumni'). Safe to run on every startup.
    async normalizeLegacyRoles() {
        return await authCollection.updateMany(
            { role: { $nin: [Roles.STUDENT, Roles.ALUMNI, Roles.ADMIN] } },
            { $set: { role: Roles.ALUMNI, updatedAt: new Date() } }
        );
    }
};

export default AuthModel;
