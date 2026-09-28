import UserModel from './users.models.js';
import AuthModel from '../auth/auth.models.js';
import { fetchFromCAIS } from '../sync/cais.service.js';
import Roles from '../../constant/roles.js';
import bcrypt from 'bcryptjs';

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

    if (source === 'cais') {
      users = await fetchFromCAIS();
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
      data: summary,
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
      let role = null;
      if (user.authId) {
        const auth = await AuthModel.findById(user.authId);
        role = auth?.role || null;
      }
      return { ...rest, role };
    }));

    res.status(200).json({
      success: true,
      data: safeUsers,
      message: "Users fetched successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await UserModel.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    const { password, ...safeUser } = user;

    let role = null;
    if (user.authId) {
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

// Admin-only: change a user's role (student / alumni / admin).
// Role lives on the auth record; the directory `:id` is the profile id.
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
    const { name, interests } = req.body;

    const updateData = {};
    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({
          success: false,
          message: "Please provide a name"
        });
      }
      updateData.name = String(name).trim();
    }
    if (interests !== undefined) {
      if (!Array.isArray(interests) || interests.length > 20) {
        return res.status(400).json({
          success: false,
          message: "Interests must be an array (max 20)"
        });
      }
      updateData.interests = interests.map((i) => String(i).trim()).filter(Boolean).slice(0, 20);
    }

    const profile = await UserModel.findByAuthId(req.user._id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found"
      });
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Nothing to update"
      });
    }

    await UserModel.updateById(String(profile._id), updateData);
    const updated = await UserModel.findById(String(profile._id));
    const { password, ...safeProfile } = updated;

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: { ...safeProfile, role: req.user.role }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};