const { verifyToken } = require('../utils/token');
const { errorResponse } = require('../utils/response');
const User = require('../models/User');

/**
 * Protect routes: verify JWT in Authorization header and attach user
 */
const protect = async (req, res, next) => {
  let token = null;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return errorResponse(res, 401, 'Access denied. No authentication token provided.');
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 401, 'Session expired. Please log in again.');
    }
    return errorResponse(res, 401, 'Invalid authentication token.');
  }

  try {
    const user = await User.findById(decoded.id);

    if (!user) {
      return errorResponse(res, 401, 'Authentication failed. User no longer exists.');
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('[Protect Middleware] User lookup failed:', error.message);
    return errorResponse(res, 500, 'Database error during authentication verification.');
  }
};

module.exports = {
  protect
};
