const { errorResponse } = require('../utils/response');

/**
 * 404 Route Not Found Handler
 */
const notFoundHandler = (req, res, next) => {
  return errorResponse(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
};

/**
 * Global Centralized Error Handling Middleware
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = null;

  // Handle PostgreSQL Duplicate Key Error (Code 23505 or code 11000)
  if (err.code === '23505' || err.code === 11000 || (err.message && err.message.includes('unique constraint'))) {
    statusCode = 409;
    message = 'An account with this email address already exists';
    errors = { email: 'Email is already registered' };
  }

  // Handle PostgreSQL Invalid UUID / Cast Error (Code 22P02 or CastError)
  if (err.code === '22P02' || err.name === 'CastError') {
    statusCode = 400;
    message = `Resource not found or invalid ID format`;
  }

  // Handle Validation Errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errors = {};
    if (err.errors) {
      Object.keys(err.errors).forEach((key) => {
        errors[key] = err.errors[key].message || err.errors[key];
      });
    }
  }

  // Handle JWT Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token expired';
  }

  // Log unexpected errors during development
  if (process.env.NODE_ENV !== 'test' && statusCode === 500) {
    console.error('[Error Handler]', err);
  }

  return errorResponse(res, statusCode, message, errors);
};

module.exports = {
  notFoundHandler,
  errorHandler
};
