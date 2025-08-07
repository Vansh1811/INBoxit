const logger = require('../utils/logger');

// Enhanced error handler with better error categorization
const errorHandler = (err, req, res, next) => {
  // Enhanced logging with request context
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    timestamp: new Date().toISOString(),
    body: req.method === 'POST' ? req.body : undefined,
    query: Object.keys(req.query).length > 0 ? req.query : undefined
  });

  // Handle authentication errors
  if (err.message.includes('REAUTH_REQUIRED')) {
    return res.status(401).json({
      error: 'Authentication Required',
      message: 'Your Gmail access has expired. Please log in again.',
      action: 'REAUTH_REQUIRED',
      timestamp: new Date().toISOString()
    });
  } // ✅ ADDED MISSING CLOSING BRACE

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: Object.values(err.errors).map(e => ({
        field: e.path,
        message: e.message,
        value: e.value
      }))
    });
  } // ✅ ADDED MISSING CLOSING BRACE

  // Handle MongoDB cast errors
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID format',
      field: err.path,
      value: err.value
    });
  } // ✅ ADDED MISSING CLOSING BRACE

  // Handle duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      error: 'Duplicate entry',
      field: field,
      message: `${field} already exists`
    });
  } // ✅ ADDED MISSING CLOSING BRACE

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      message: 'Please log in again'
    });
  } // ✅ ADDED MISSING CLOSING BRACE

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      message: 'Please log in again'
    });
  } // ✅ ADDED MISSING CLOSING BRACE

  // Gmail API specific errors
  if (err.code === 401 && err.message.includes('invalid_grant')) {
    return res.status(401).json({
      error: 'Authentication expired',
      message: 'Please log in again to refresh your Gmail access',
      action: 'REAUTH_REQUIRED'
    });
  } // ✅ ADDED MISSING CLOSING BRACE

  // Gmail API quota errors
  if (err.code === 403 && err.message.includes('quotaExceeded')) {
    return res.status(429).json({
      error: 'Gmail API quota exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter: 3600
    });
  } // ✅ ADDED MISSING CLOSING BRACE

  // Gmail API rate limit errors
  if (err.code === 429) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Please slow down your requests',
      retryAfter: parseInt(err.retryAfter) || 60
    });
  } // ✅ ADDED MISSING CLOSING BRACE

  // Network/timeout errors
  if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
    return res.status(503).json({
      error: 'Service temporarily unavailable',
      message: 'Please try again in a moment',
      code: err.code
    });
  } // ✅ ADDED MISSING CLOSING BRACE

  // Default error response
  const isDevelopment = process.env.NODE_ENV === 'development';
  const statusCode = err.status || err.statusCode || 500;

  res.status(statusCode).json({
    error: isDevelopment ? err.message : 'Internal Server Error',
    ...(isDevelopment && {
      stack: err.stack,
      code: err.code
    }),
    timestamp: new Date().toISOString()
  });
};

// Enhanced 404 handler - Already perfect!
const notFoundHandler = (req, res) => {
  logger.warn('Route not found:', {
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    message: 'The requested endpoint does not exist',
    timestamp: new Date().toISOString()
  });
};

// Enhanced async error wrapper - Already excellent!
const asyncHandler = (fn, timeout = 30000) => (req, res, next) => {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), timeout);
  });

  Promise.race([
    Promise.resolve(fn(req, res, next)),
    timeoutPromise
  ]).catch(next);
};

// Request timeout middleware - Already perfect!
const requestTimeout = (timeout = 30000) => (req, res, next) => {
  req.setTimeout(timeout, () => {
    const err = new Error('Request timeout');
    err.status = 408;
    next(err);
  });
  next();
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  requestTimeout
};
