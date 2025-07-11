const { body, param, query, validationResult } = require('express-validator');

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// Common validation rules
const validateUpdateService = [
  body('domain')
    .isLength({ min: 1, max: 255 })
    .withMessage('Domain is required and must be less than 255 characters')
    .matches(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
    .withMessage('Invalid domain format'),
  
  body('action')
    .isIn(['unsubscribe', 'ignore', 'restore'])
    .withMessage('Action must be one of: unsubscribe, ignore, restore'),
  
  handleValidationErrors
];

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be a number between 1 and 1000'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be a number between 1 and 100'),
  
  handleValidationErrors
];

const validateSearch = [
  query('q')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters')
    .escape(), // Sanitize HTML
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateUpdateService,
  validatePagination,
  validateSearch
};