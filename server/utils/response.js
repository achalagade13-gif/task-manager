/**
 * Standardized API Response Utilities
 */

const successResponse = (res, statusCode = 200, message = 'Success', data = null, meta = null) => {
  const payload = {
    success: true,
    message,
    ...(data !== null && { data }),
    ...(meta && { meta })
  };
  return res.status(statusCode).json(payload);
};

const errorResponse = (res, statusCode = 400, message = 'An error occurred', errors = null) => {
  const payload = {
    success: false,
    message,
    ...(errors && { errors })
  };
  return res.status(statusCode).json(payload);
};

module.exports = {
  successResponse,
  errorResponse
};
