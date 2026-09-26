import UserModel from './users.models.js';
import AuthModel from '../auth/auth.models.js';
import Roles from '../../constant/roles.js';
import bcrypt from 'bcryptjs';

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
    if (email) updateData.email = email;
    
    await UserModel.updateById(id, updateData);
    
    const updatedUser = await UserModel.findById(id);
    const { password, ...safeUser } = updatedUser;
    
    res.status(200).json({
      success: true,
      data: safeUser,
      message: "User updated successfully"
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

// Logged-in user updates their OWN directory profile (name only).
// Email and role stay managed by sync / admins.
export const updateMyProfile = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide a name"
      });
    }

    const profile = await UserModel.findByAuthId(req.user._id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found"
      });
    }

    await UserModel.updateById(String(profile._id), { name: name.trim() });
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