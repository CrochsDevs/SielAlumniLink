import UserModel from './users.models.js';
import AuthModel from '../auth/auth.models.js';
import { fetchFromCAIS } from '../sync/cais.service.js';
import Roles from '../../constant/roles.js';
import bcrypt from 'bcryptjs';
import { ConversationModel } from '../messages/messages.models.js';
import { emitToUser } from '../../realtime/socket.js';
import { contactUpdates } from './profile-contact.js';

const SYNCABLE_ROLES = [Roles.STUDENT, Roles.ALUMNI];

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));

// Admin-only: bulk upsert from CAIS.
// Body: { source: 'cais' } pulls live from CAIS_API_URL.
// CAIS fields: Student ID, Full Name, Program/Course, Year Level,
//   Section, Academic Status, Email, Contact Number.
// - role is derived (Academic Status Graduated -> alumni, else student)
// - synced accounts get NO password (passwordSetupRequired: true);
//   users set it via magic link -> setup-password.
export const syncUsers = async (req, res) => {
  try {
    let users = req.body.users;
    const { source } = req.body;
    let caisMeta = null;

    if (source === 'cais') {
      const pulled = await fetchFromCAIS();
      users = pulled.users;
      caisMeta = pulled.meta;
    }

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a non-empty users array'
      });
    }

    if (users.length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Batch too large (max 5000 per sync)'
      });
    }

    const summary = { total: users.length, created: 0, updated: 0, skipped: [] };
    const seen = new Set();

    for (const entry of users) {
      const email = String(entry.email || '').trim().toLowerCase();
      const name = String(entry.name || '').trim();
      const role = String(entry.role || '').trim().toLowerCase();
      const profileData = {
        name,
        email,
        role,
        studentId: String(entry.studentId || '').trim(),
        program: String(entry.program || '').trim(),
        yearLevel: String(entry.yearLevel || '').trim(),
        section: String(entry.section || '').trim(),
        academicStatus: String(entry.academicStatus || '').trim(),
        contactNumber: String(entry.contactNumber || '').trim(),
      };

      if (!isValidEmail(email)) {
        summary.skipped.push({ email: entry.email || null, reason: 'Invalid email' });
        continue;
      }
      if (seen.has(email)) {
        summary.skipped.push({ email, reason: 'Duplicate in batch' });
        continue;
      }
      seen.add(email);

      if (!name) {
        summary.skipped.push({ email, reason: 'Missing name' });
        continue;
      }
      if (!SYNCABLE_ROLES.includes(role)) {
        summary.skipped.push({ email, reason: `Invalid role (must be ${SYNCABLE_ROLES.join('/')})` });
        continue;
      }

      const existingAuth = await AuthModel.findByEmail(email);

      if (existingAuth) {
        // Keep existing password/state; only refresh synced fields.
        if (existingAuth.role !== role) {
          await AuthModel.updateRoleById(existingAuth._id, role);
        }
        const profile = await UserModel.findByAuthId(existingAuth._id);
        if (profile) {
          await UserModel.updateById(String(profile._id), profileData);
        } else {
          await UserModel.createUserProfile(existingAuth._id, profileData);
        }
        summary.updated += 1;
      } else {
        const newAuth = await AuthModel.createSyncedUser({ email, role });
        await UserModel.createUserProfile(newAuth._id, profileData);
        summary.created += 1;
      }
    }

    res.status(200).json({
      success: true,
      data: { ...summary, sources: caisMeta },
      message: 'Sync complete'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getUsers = async (req, res) => {
  try {
    const users = await UserModel.findAll();
    const safeUsers = await Promise.all(users.map(async (user) => {
      const { password, ...rest } = user;
      // Role lives on the profile; auth record is the fallback.
      let role = user.role || null;
      if (!role && user.authId) {
        const auth = await AuthModel.findById(user.authId);
        role = auth?.role || null;
      }
      return { ...rest, role };
    }));

    // Optional role filter (?role=alumni) — used by mentorship discovery.
    const { role } = req.query;
    const data = role
      ? safeUsers.filter((u) => (u.role || '').toLowerCase() === String(role).toLowerCase())
      : safeUsers;

    res.status(200).json({
      success: true,
      data,
      message: "Users fetched successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getMyProfile = async (req, res) => {
  try {
    const user = await UserModel.findByAuthId(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }
    const { password, ...safeUser } = user;
    res.status(200).json({
      success: true,
      data: { ...safeUser, role: req.user.role }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    let user = await UserModel.findById(id);
    
    if (!user) {
      user = await UserModel.findByAuthId(id);
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    const { password, ...safeUser } = user;

    let role = user.role || null;
    if (!role && user.authId) {
      const auth = await AuthModel.findById(user.authId);
      role = auth?.role || null;
    }

    res.status(200).json({
      success: true,
      data: { ...safeUser, role },
      message: "User fetched successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, and password"
      });
    }
    
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists"
      });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const newUser = await UserModel.create({
      name,
      email,
      password: hashedPassword
    });
    
    const { password: _, ...safeUser } = newUser;
    
    res.status(201).json({
      success: true,
      data: safeUser,
      message: "User created successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;

    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const updateData = {};
    if (name) updateData.name = name;

    // Email change syncs BOTH records (login identity + directory).
    let emailChanged = false;
    if (email && email !== user.email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format"
        });
      }
      const taken = await AuthModel.findByEmail(email);
      if (taken && String(taken._id) !== String(user.authId)) {
        return res.status(400).json({
          success: false,
          message: "Email is already used by another account"
        });
      }
      updateData.email = email;
      if (user.authId) {
        await AuthModel.updateEmailById(user.authId, email);
      }
      emailChanged = true;
    }

    await UserModel.updateById(id, updateData);

    const updatedUser = await UserModel.findById(id);
    const { password, ...safeUser } = updatedUser;

    res.status(200).json({
      success: true,
      data: { ...safeUser, emailChanged },
      message: emailChanged
        ? "User updated. Email changed — the user must log in again."
        : "User updated successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    await UserModel.deleteById(id);
    
    res.status(200).json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin-only: graduate a student -> converts Student to Alumni.
// Sets role=alumni, academicStatus=Graduated, graduatedAt=now.
// Safe to call on alumni already (idempotent refresh).
export const graduateUser = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide the graduate email'
      });
    }

    const auth = await AuthModel.findByEmail(String(email).trim().toLowerCase());
    if (!auth) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }
    if (auth.role === Roles.ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Cannot graduate an admin account'
      });
    }

    if (auth.role !== Roles.ALUMNI) {
      await AuthModel.updateRoleById(auth._id, Roles.ALUMNI);
    }

    const profile = await UserModel.findByAuthId(auth._id);
    if (profile) {
      await UserModel.updateById(String(profile._id), {
        role: Roles.ALUMNI,
        academicStatus: 'Graduated',
        graduatedAt: profile.graduatedAt || new Date(),
      });
    } else {
      await UserModel.createUserProfile(auth._id, {
        name: auth.email,
        email: auth.email,
        role: Roles.ALUMNI,
        academicStatus: 'Graduated',
        graduatedAt: new Date(),
      });
    }

    res.status(200).json({
      success: true,
      message: `${auth.email} is now an alumnus`,
      data: { email: auth.email, role: Roles.ALUMNI }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!Object.values(Roles).includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed: ${Object.values(Roles).join(', ')}`
      });
    }

    const profile = await UserModel.findById(id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (!profile.authId) {
      return res.status(400).json({
        success: false,
        message: "This profile has no linked login account"
      });
    }

    // Safety: an admin cannot demote/remove their own admin access
    if (String(profile.authId) === String(req.user._id) && role !== Roles.ADMIN) {
      return res.status(403).json({
        success: false,
        message: "You cannot remove your own admin role"
      });
    }

    await AuthModel.updateRoleById(profile.authId, role);
    await UserModel.updateById(String(profile._id), { role });

    res.status(200).json({
      success: true,
      message: `Role updated to ${role}`,
      data: { role }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Logged-in user updates their OWN directory profile.
// Editable: name + career interests. Email and role stay managed
// by sync / admins.
export const updateMyProfile = async (req, res) => {
  try {
    const { name, program, batch, location, bio, skills, employmentHistory, education, interests } = req.body;

    let updateData;
    try {
      updateData = contactUpdates(req.body);
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    // Handle MongoDB operators ($push, $addToSet, $pull, etc.)
    const mongoOps = {};
    if (req.body.$push) mongoOps.$push = req.body.$push;
    if (req.body.$addToSet) mongoOps.$addToSet = req.body.$addToSet;
    if (req.body.$pull) mongoOps.$pull = req.body.$pull;
    if (req.body.$set) mongoOps.$set = req.body.$set;

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ success: false, message: "Please provide a name" });
      }
      updateData.name = String(name).trim();
    }
    if (program !== undefined) updateData.program = String(program).trim();
    if (batch !== undefined) updateData.batch = String(batch).trim();
    if (location !== undefined) updateData.location = String(location).trim();
    if (bio !== undefined) updateData.bio = String(bio).trim();
    // Store Cloudinary URLs and asset IDs, never image buffers/base64 in MongoDB.
    for (const [field, publicIdField, folder] of [
      ['profilePicture', 'profilePicturePublicId', 'profiles'],
      ['bannerImage', 'bannerImagePublicId', 'covers'],
    ]) {
      const value = req.body[field];
      const publicId = req.body[publicIdField];
      if (value === undefined && publicId === undefined) continue;
      if (value !== undefined && value !== null) {
        let valid = false;
        try {
          const url = new URL(value);
          valid = typeof value === 'string' && value.length <= 2048 && url.protocol === 'https:' &&
            url.hostname === 'res.cloudinary.com' && url.pathname.startsWith(`/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`);
        } catch { /* invalid URL */ }
        if (!valid) return res.status(400).json({ success: false, message: `Invalid ${field} URL` });
      }
      if (publicId !== undefined && publicId !== null &&
          (typeof publicId !== 'string' || publicId.length > 200 ||
           !publicId.startsWith(`alumnilink/${folder}/${req.user._id}/`) || publicId.split('/').includes('..'))) {
        return res.status(400).json({ success: false, message: `Invalid ${publicIdField}` });
      }
      if (value !== undefined) updateData[field] = value;
      if (publicId !== undefined) updateData[publicIdField] = publicId;
      if (value === null) updateData[publicIdField] = null;
    }
    if (skills !== undefined) {
      if (!Array.isArray(skills)) {
        return res.status(400).json({ success: false, message: "Skills must be an array" });
      }
      updateData.skills = skills.map((s) => String(s).trim()).filter(Boolean);
      if (updateData.skills.length > 10) {
        return res.status(400).json({ success: false, message: 'You can add up to 10 skills only' });
      }
    }
    if (employmentHistory !== undefined) updateData.employmentHistory = employmentHistory;
    if (education !== undefined) updateData.education = education;
    if (interests !== undefined) {
      if (!Array.isArray(interests) || interests.length > 20) {
        return res.status(400).json({ success: false, message: "Interests must be an array (max 20)" });
      }
      updateData.interests = interests.map((i) => String(i).trim()).filter(Boolean).slice(0, 20);
    }

    const profile = await UserModel.findByAuthId(req.user._id);
    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    for (const [operator, fields] of Object.entries(mongoOps)) {
      if (Object.keys(fields).some(field => ['_id', 'authId', 'role', 'email', 'academicStatus', 'graduatedAt', 'createdAt'].includes(field.split('.')[0]))) {
        return res.status(403).json({ success: false, message: 'Account identity and graduation fields are managed by administrators' });
      }
      if (Object.keys(fields).some((field) => field.startsWith('skills.')) ||
          (Object.hasOwn(fields, 'skills') && !['$push', '$addToSet', '$pull'].includes(operator))) {
        return res.status(400).json({ success: false, message: 'Use the skills array to replace skills' });
      }
      if (['$push', '$addToSet'].includes(operator) && Object.hasOwn(fields, 'skills')) {
        const value = fields.skills;
        const additions = typeof value === 'string' ? [value] : value?.$each;
        if (!Array.isArray(additions) || additions.some((skill) => typeof skill !== 'string' || !skill.trim())) {
          return res.status(400).json({ success: false, message: 'Skills must be non-empty strings' });
        }
        mongoOps[operator] = { ...fields, skills: { $each: additions.map((skill) => skill.trim()) } };
      }
    }

    const hasUpdates = Object.keys(updateData).length > 0 || Object.keys(mongoOps).length > 0;
    if (!hasUpdates) {
      return res.status(400).json({ success: false, message: "Nothing to update" });
    }

    const finalUpdate = { ...updateData, ...mongoOps };
    await UserModel.updateById(String(profile._id), finalUpdate);
    const updated = await UserModel.findById(String(profile._id));
    const { password, ...safeProfile } = updated;

    if (updateData.profilePicture !== undefined || updateData.name !== undefined) {
      try {
        const conversations = await ConversationModel.findMine(req.user._id);
        const recipients = new Set([String(req.user._id)]);
        conversations.forEach((conversation) => {
          (conversation.participants || []).forEach((participant) => {
            if (participant.authId) recipients.add(String(participant.authId));
          });
        });
        const payload = {
          authId: String(req.user._id),
          name: safeProfile.name,
          profilePicture: safeProfile.profilePicture || null,
        };
        recipients.forEach((authId) => emitToUser(authId, 'profile:updated', payload));
      } catch (error) {
        console.error('[profile] Failed to deliver chat profile update', error);
      }
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: { ...safeProfile, role: req.user.role }
    });
  } catch (error) {
    res.status(error.code === 'SKILL_LIMIT_EXCEEDED' ? 400 : 500).json({
      success: false,
      message: error.message
    });
  }
};

// Track a profile view — increments view count on the viewed user's profile.
export const trackProfileView = async (req, res) => {
  try {
    const { id } = req.params;
    if (String(id) === String(req.user._id)) {
      return res.status(200).json({ success: true, message: 'Own profile — not counted' });
    }
    const result = await UserModel.updateById(id, { $inc: { profileViews: 1 } });
    if (!result) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, message: 'Profile view recorded' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
