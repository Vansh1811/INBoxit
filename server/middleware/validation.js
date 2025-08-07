const { body, param, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const rateLimit = require('express-rate-limit');

// ✅ Enhanced validation error handler with rich logging
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
      location: err.location || 'body'
    }));

    // ✅ Enhanced logging with request context
    logger.warn('Validation failed', {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id || 'anonymous',
      userAgent: req.get('User-Agent'),
      errors: errorDetails,
      body: req.method === 'POST' ? req.body : undefined
    });

    return res.status(400).json({
      error: 'Validation failed',
      message: 'The request contains invalid data',
      details: errorDetails,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }

  next();
}; // ✅ FIXED: Added missing closing brace

// ✅ Enhanced domain validation with better patterns
const domainValidation = body('domain')
  .trim()
  .isLength({ min: 1, max: 255 })
  .withMessage('Domain is required and must be less than 255 characters')
  .matches(/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/)
  .withMessage('Invalid domain format')
  .custom((value) => {
    // ✅ Enhanced domain validation
    const invalidDomains = ['localhost', '127.0.0.1', 'example.com', 'test.com'];
    if (invalidDomains.includes(value.toLowerCase())) {
      throw new Error('Invalid or test domain not allowed');
    }
    return true;
  });

// ✅ Enhanced service update validation
const validateUpdateService = [
  param('domain')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Domain parameter is required')
    .matches(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
    .withMessage('Invalid domain format in URL parameter'),
    
  body('action')
    .isIn(['unsubscribe', 'ignore', 'restore', 'update_category'])
    .withMessage('Action must be one of: unsubscribe, ignore, restore, update_category'),
    
  body('reason')
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Reason must be between 1 and 500 characters')
    .escape(),
    
  body('category')
    .optional()
    .isIn(['social', 'ecommerce', 'newsletter', 'entertainment', 'productivity', 
           'financial', 'education', 'communication', 'marketing', 'other'])
    .withMessage('Invalid category'),
    
  handleValidationErrors
];

// ✅ Enhanced bulk operations validation
const validateBulkAction = [
  body('domains')
    .isArray({ min: 1, max: 50 })
    .withMessage('Domains must be an array with 1-50 items'),
    
  body('domains.*')
    .trim()
    .matches(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
    .withMessage('Each domain must be valid'),
    
  body('action')
    .isIn(['unsubscribe', 'ignore', 'restore', 'update_category', 'delete'])
    .withMessage('Action must be one of: unsubscribe, ignore, restore, update_category, delete'),
    
  body('reason')
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Reason must be between 1 and 500 characters')
    .escape(),
    
  body('category')
    .optional()
    .isIn(['social', 'ecommerce', 'newsletter', 'entertainment', 'productivity', 
           'financial', 'education', 'communication', 'marketing', 'other'])
    .withMessage('Invalid category'),
    
  handleValidationErrors
];

// ✅ Enhanced pagination with better limits
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be a number between 1 and 1000')
    .toInt(),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be a number between 1 and 100')
    .toInt(),
    
  query('sortBy')
    .optional()
    .isIn(['lastSeen', 'platform', 'confidence', 'category', 'date'])
    .withMessage('SortBy must be one of: lastSeen, platform, confidence, category, date'),
    
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('SortOrder must be asc or desc'),
    
  handleValidationErrors
];

// ✅ Enhanced search validation with security
const validateSearch = [
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\s@.-]+$/)
    .withMessage('Search query contains invalid characters')
    .escape(),
    
  query('filter')
    .optional()
    .isIn(['all', 'active', 'unsubscribed', 'ignored', 'suspicious'])
    .withMessage('Filter must be one of: all, active, unsubscribed, ignored, suspicious'),
    
  query('category')
    .optional()
    .isIn(['all', 'social', 'ecommerce', 'newsletter', 'entertainment', 'productivity', 
           'financial', 'education', 'communication', 'marketing', 'other'])
    .withMessage('Category filter is invalid'),
    
  handleValidationErrors
];

// ✅ Email validation for various endpoints
const validateEmail = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail({
      gmail_lowercase: true,
      gmail_remove_dots: false
    }),
    
  handleValidationErrors
];

// ✅ Enhanced service creation validation
const validateCreateService = [
  domainValidation,
  
  body('platform')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Platform name is required and must be less than 100 characters')
    .matches(/^[a-zA-Z0-9\s.-]+$/)
    .withMessage('Platform name contains invalid characters'),
    
  body('sender')
    .trim()
    .isEmail()
    .withMessage('Sender must be a valid email address'),
    
  body('category')
    .optional()
    .isIn(['social', 'ecommerce', 'newsletter', 'entertainment', 'productivity', 
           'financial', 'education', 'communication', 'marketing', 'other'])
    .withMessage('Invalid category'),
    
  body('confidence')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Confidence must be a number between 0 and 100'),
    
  handleValidationErrors
];

// ✅ Export preferences validation
const validateExportRequest = [
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Export format must be json or csv'),
    
  query('includeUnsubscribed')
    .optional()
    .isBoolean()
    .withMessage('includeUnsubscribed must be true or false')
    .toBoolean(),
    
  query('includeIgnored')
    .optional()
    .isBoolean()
    .withMessage('includeIgnored must be true or false')
    .toBoolean(),
    
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('startDate must be a valid ISO 8601 date'),
    
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('endDate must be a valid ISO 8601 date')
    .custom((endDate, { req }) => {
      if (req.query.startDate && new Date(endDate) <= new Date(req.query.startDate)) {
        throw new Error('endDate must be after startDate');
      }
      return true;
    }),
    
  handleValidationErrors
];

// ✅ Authentication validation for user profile updates
const validateUserProfile = [
  body('displayName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Display name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\s.-]+$/)
    .withMessage('Display name contains invalid characters'),
    
  body('preferences.theme')
    .optional()
    .isIn(['light', 'dark', 'auto'])
    .withMessage('Theme must be light, dark, or auto'),
    
  body('preferences.emailNotifications')
    .optional()
    .isBoolean()
    .withMessage('Email notifications must be true or false')
    .toBoolean(),
    
  body('preferences.autoScan')
    .optional()
    .isBoolean()
    .withMessage('Auto scan must be true or false')
    .toBoolean(),
    
  body('preferences.scanFrequency')
    .optional()
    .isIn(['daily', 'weekly', 'monthly'])
    .withMessage('Scan frequency must be daily, weekly, or monthly'),
    
  handleValidationErrors
];

// ✅ Enhanced scan request validation
const validateScanRequest = [
  body('forceRefresh')
    .optional()
    .isBoolean()
    .withMessage('forceRefresh must be true or false')
    .toBoolean(),
    
  body('maxEmails')
    .optional()
    .isInt({ min: 10, max: 2000 })
    .withMessage('maxEmails must be between 10 and 2000')
    .toInt(),
    
  body('includeOldEmails')
    .optional()
    .isBoolean()
    .withMessage('includeOldEmails must be true or false')
    .toBoolean(),
    
  handleValidationErrors
];

// ✅ Advanced validation utilities
const sanitizeAndValidateHtml = (value) => {
  // Remove potentially dangerous HTML tags and attributes
  return value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
              .replace(/javascript:/gi, '')
              .replace(/on\w+\s*=/gi, '');
};

const validateObjectId = param('id')
  .matches(/^[0-9a-fA-F]{24}$/)
  .withMessage('Invalid ID format');

// ✅ Rate limiting for validation-heavy endpoints
const validationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 validation requests per 15 minutes
  message: {
    error: 'Too many validation requests',
    message: 'Please slow down your requests'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ✅ Security headers validation
const validateSecurityHeaders = (req, res, next) => {
  // Check for common security headers
  const userAgent = req.get('User-Agent');
  const origin = req.get('Origin');
  
  if (!userAgent) {
    logger.warn('Request without User-Agent header', {
      ip: req.ip,
      url: req.originalUrl
    });
  }
  
  // Validate origin for CORS requests
  if (origin && req.method !== 'GET') {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:3001'
    ].filter(Boolean);
    
    if (!allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      logger.warn('Request from unauthorized origin', {
        origin,
        ip: req.ip,
        url: req.originalUrl
      });
      
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Request from unauthorized origin'
      });
    }
  }
  
  next();
};

// ✅ Content-Type validation middleware
const validateContentType = (expectedTypes = ['application/json']) => {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'DELETE') {
      return next(); // Skip for GET/DELETE requests
    }
    
    const contentType = req.get('Content-Type');
    if (!contentType || !expectedTypes.some(type => contentType.includes(type))) {
      logger.warn('Invalid Content-Type header', {
        contentType,
        expectedTypes,
        url: req.originalUrl,
        method: req.method
      });
      
      return res.status(400).json({
        error: 'Invalid Content-Type',
        message: `Expected Content-Type to be one of: ${expectedTypes.join(', ')}`,
        received: contentType
      });
    }
    
    next();
  };
};

// ✅ Custom validation for InboxIt-specific business rules
const validateBusinessRules = {
  // Ensure user can't unsubscribe from critical services
  preventCriticalUnsubscribe: body('domain').custom((domain) => {
    const criticalDomains = ['gmail.com', 'google.com', 'github.com'];
    if (criticalDomains.includes(domain.toLowerCase())) {
      throw new Error('Cannot unsubscribe from critical system services');
    }
    return true;
  }),
  
  // Validate bulk operation limits based on user tier
  validateBulkLimits: body('domains').custom((domains, { req }) => {
    const maxBulkOperations = req.user?.isPremium ? 100 : 50;
    if (domains.length > maxBulkOperations) {
      throw new Error(`Bulk operations limited to ${maxBulkOperations} items for your account tier`);
    }
    return true;
  }),
  
  // Validate scan frequency limits
  validateScanFrequency: (req, res, next) => {
    const user = req.user;
    if (!user) return next();
    
    const lastScan = user.lastScan;
    const minimumInterval = user.isPremium ? 5 * 60 * 1000 : 15 * 60 * 1000; // 5 min premium, 15 min free
    
    if (lastScan && (Date.now() - new Date(lastScan).getTime()) < minimumInterval) {
      return res.status(429).json({
        error: 'Scan frequency limit exceeded',
        message: `Please wait ${Math.ceil(minimumInterval / 60000)} minutes between scans`,
        nextAllowedScan: new Date(new Date(lastScan).getTime() + minimumInterval).toISOString()
      });
    }
    
    next();
  }
};

module.exports = {
  // Core validation functions
  handleValidationErrors,
  
  // Service management validations
  validateUpdateService,
  validateBulkAction,
  validateCreateService,
  
  // Query and search validations
  validatePagination,
  validateSearch,
  validateExportRequest,
  
  // User and authentication validations
  validateEmail,
  validateUserProfile,
  
  // Scan and processing validations
  validateScanRequest,
  
  // Security and utility validations
  validateObjectId,
  validateSecurityHeaders,
  validateContentType,
  validationRateLimit,
  
  // Business rule validations
  validateBusinessRules,
  
  // Utility functions
  sanitizeAndValidateHtml,
  domainValidation
};
