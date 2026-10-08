const User = require('../models/User');
const { generateToken } = require('../utils/token');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, avatar } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return errorResponse(res, 409, 'An account with this email address already exists', {
        email: 'Email is already registered'
      });
    }

    // Default avatar if none provided
    const userAvatar =
      avatar ||
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
        name
      )}&backgroundColor=4f46e5,06b6d4,3b82f6`;

    // Create user in Supabase PostgreSQL
    const user = await User.create({
      name,
      email,
      password,
      avatar: userAvatar
    });

    // Generate JWT token
    const token = generateToken(user._id);

    return successResponse(
      res,
      201,
      'User account registered successfully',
      {
        user: {
          _id: user._id,
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio,
          preferences: user.preferences,
          createdAt: user.createdAt
        },
        token
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Log in existing user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      return errorResponse(res, 401, 'Invalid email or password');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return errorResponse(res, 401, 'Invalid email or password');
    }

    // Generate JWT token
    const token = generateToken(user._id);

    return successResponse(
      res,
      200,
      'Login successful',
      {
        user: {
          _id: user._id,
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio,
          preferences: user.preferences,
          createdAt: user.createdAt
        },
        token
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user / clear token on client
 * @route   POST /api/auth/logout
 * @access  Public
 */
const logout = async (req, res) => {
  return successResponse(res, 200, 'Logged out successfully');
};

/**
 * @desc    Get current authenticated user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res) => {
  return successResponse(res, 200, 'User profile retrieved', {
    user: req.user
  });
};

/**
 * @desc    Update user profile details
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, avatar, bio, preferences } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }

    if (name) user.name = name.trim();
    if (avatar !== undefined) user.avatar = avatar;
    if (bio !== undefined) user.bio = bio;
    if (preferences) {
      const currentPrefs = user.preferences && typeof user.preferences.toObject === 'function'
        ? user.preferences.toObject()
        : (user.preferences || {});
      user.preferences = {
        ...currentPrefs,
        ...preferences
      };
    }

    await user.save();

    return successResponse(res, 200, 'Profile updated successfully', {
      user: {
        _id: user._id,
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        preferences: user.preferences,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Change user password
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return errorResponse(res, 400, 'Current password is incorrect', {
        currentPassword: 'Incorrect current password'
      });
    }

    user.password = newPassword;
    user._isPasswordModified = true;
    await user.save();

    return successResponse(res, 200, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  changePassword
};
