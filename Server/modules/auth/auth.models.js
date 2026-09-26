import { client } from '../../config/db.js';
import Roles from '../../constant/roles.js';

const db = client.db('SielAlumni');
const authCollection = db.collection('auth');

// Roles that can be assigned at creation (never ADMIN — admins are
// promoted from existing DB accounts via the promote-admin script).
const CREATABLE_ROLES = [Roles.STUDENT, Roles.ALUMNI];

export const AuthModel = {
    async findByEmail(email) {
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
        return await authCollection.updateOne(
            { email },
            {
                $set: {
                    resetOTP: otp,
                    resetOTPExpires: otpExpires,
                    updatedAt: new Date()
                }
            }
        );
    },

    async findByOTP(email, otp) {
        return await authCollection.findOne({
            email: email,
            resetOTP: otp,
            resetOTPExpires: { $gt: new Date() }
        });
    },

    async updatePassword(email, hashedPassword) {
        return await authCollection.updateOne(
            { email },
            {
                $set: {
                    password: hashedPassword,
                    passwordSetupRequired: false,
                    resetOTP: null,
                    resetOTPExpires: null,
                    updatedAt: new Date()
                }
            }
        );
    },

    async updatePasswordById(authId, hashedPassword) {
        return await authCollection.updateOne(
            { _id: authId },
            {
                $set: {
                    password: hashedPassword,
                    passwordSetupRequired: false,
                    resetOTP: null,
                    resetOTPExpires: null,
                    updatedAt: new Date()
                }
            }
        );
    },

    async markPasswordSetupRequiredForExistingUsers() {
        return await authCollection.updateMany(
            { passwordSetupRequired: { $exists: false } },
            { $set: { passwordSetupRequired: true } }
        );
    },

    async updateRoleById(authId, role) {
        return await authCollection.updateOne(
            { _id: authId },
            { $set: { role, updatedAt: new Date() } }
        );
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