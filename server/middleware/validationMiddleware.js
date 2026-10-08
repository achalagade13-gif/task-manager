const { errorResponse } = require('../utils/response');

/**
 * Validates ID format in route parameters (supports UUIDs and alphanumeric string IDs)
 */
const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return errorResponse(res, 400, `Invalid ID format for parameter: ${paramName}`);
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const legacyObjectIdRegex = /^[0-9a-fA-F]{24}$/;
    const genericIdRegex = /^[a-zA-Z0-9_-]{8,64}$/;

    if (!uuidRegex.test(id) && !legacyObjectIdRegex.test(id) && !genericIdRegex.test(id)) {
      return errorResponse(res, 400, `Invalid ID format for parameter: ${paramName}`);
    }

    next();
  };
};

/**
 * Validates User Registration Request Body
 */
const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body;
  const errors = {};

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.name = 'Name is required';
  } else if (name.trim().length > 60) {
    errors.name = 'Name cannot exceed 60 characters';
  }

  const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,})+$/;
  if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
    errors.email = 'A valid email address is required';
  }

  if (!password || typeof password !== 'string') {
    errors.password = 'Password is required';
  } else if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters long';
  }

  if (Object.keys(errors).length > 0) {
    return errorResponse(res, 400, 'Validation failed', errors);
  }

  req.body.name = name.trim();
  req.body.email = email.trim().toLowerCase();
  next();
};

/**
 * Validates User Login Request Body
 */
const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = {};

  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    errors.email = 'Email is required';
  }

  if (!password || typeof password !== 'string' || password.length === 0) {
    errors.password = 'Password is required';
  }

  if (Object.keys(errors).length > 0) {
    return errorResponse(res, 400, 'Validation failed', errors);
  }

  req.body.email = email.trim().toLowerCase();
  next();
};

/**
 * Validates Task Creation and Update Body
 */
const validateTask = (isUpdate = false) => {
  return (req, res, next) => {
    const { title, description, status, priority, dueDate, tags } = req.body;
    const errors = {};

    if (!isUpdate || title !== undefined) {
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        errors.title = 'Task title is required';
      } else if (title.trim().length > 120) {
        errors.title = 'Task title cannot exceed 120 characters';
      }
    }

    if (description !== undefined && typeof description === 'string' && description.length > 2000) {
      errors.description = 'Description cannot exceed 2000 characters';
    }

    const validStatuses = ['todo', 'in-progress', 'completed'];
    if (status !== undefined && !validStatuses.includes(status)) {
      errors.status = `Status must be one of: ${validStatuses.join(', ')}`;
    }

    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (priority !== undefined && !validPriorities.includes(priority)) {
      errors.priority = `Priority must be one of: ${validPriorities.join(', ')}`;
    }

    if (dueDate !== undefined && dueDate !== null && dueDate !== '') {
      const parsedDate = new Date(dueDate);
      if (isNaN(parsedDate.getTime())) {
        errors.dueDate = 'Due date must be a valid date format';
      }
    }

    if (tags !== undefined && !Array.isArray(tags) && typeof tags !== 'string') {
      errors.tags = 'Tags must be an array of strings or a comma-separated string';
    }

    if (Object.keys(errors).length > 0) {
      return errorResponse(res, 400, 'Validation failed', errors);
    }

    // Format tags if string was sent
    if (typeof req.body.tags === 'string') {
      req.body.tags = req.body.tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
    }

    next();
  };
};

/**
 * Validates Status Update Route
 */
const validateTaskStatus = (req, res, next) => {
  const { status } = req.body;
  const validStatuses = ['todo', 'in-progress', 'completed'];

  if (!status || !validStatuses.includes(status)) {
    return errorResponse(
      res,
      400,
      `Status is required and must be one of: ${validStatuses.join(', ')}`
    );
  }

  next();
};

/**
 * Validates Password Change
 */
const validateChangePassword = (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  const errors = {};

  if (!currentPassword) {
    errors.currentPassword = 'Current password is required';
  }

  if (!newPassword || newPassword.length < 6) {
    errors.newPassword = 'New password must be at least 6 characters long';
  }

  if (Object.keys(errors).length > 0) {
    return errorResponse(res, 400, 'Validation failed', errors);
  }

  next();
};

module.exports = {
  validateObjectId,
  validateRegister,
  validateLogin,
  validateTask,
  validateTaskStatus,
  validateChangePassword
};
