const { body, validationResult } = require('express-validator');
const config = require('../config/config');

// Validation rules for user registration
const validateRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
    .custom((value) => {
      if (!value.toLowerCase().endsWith(`@${config.email.allowedDomain}`)) {
        throw new Error(`Email must be from ${config.email.allowedDomain} domain`);
      }
      return true;
    }),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
  body('first_name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name is required and must be less than 100 characters'),
  body('last_name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name is required and must be less than 100 characters'),
  body('department')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Department must be less than 100 characters'),
  body('position')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Position must be less than 100 characters')
];

// Validation rules for user login
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Validation rules for ticket creation
const validateTicket = [
  body('catalog_item_id')
    .isInt({ min: 1 })
    .withMessage('Please select a valid catalog item'),
  body('title')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title is required and must be less than 255 characters'),
  body('description')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Description is required and must be less than 5000 characters'),
  body('reason')
    .isIn(['no_longer_used', 'duplicate_license', 'employee_left', 'project_ended', 'cost_optimization', 'other'])
    .withMessage('Please select a valid reason'),
  body('custom_reason')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Custom reason must be less than 1000 characters'),
  body('savings_period_months')
    .optional()
    .isInt({ min: 1, max: 60 })
    .withMessage('Savings period must be between 1 and 60 months')
];

// Validation rules for catalog item
const validateCatalogItem = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name is required and must be less than 255 characters'),
  body('type')
    .isIn(['account', 'license', 'subscription'])
    .withMessage('Please select a valid type'),
  body('unit_cost')
    .isFloat({ min: 0 })
    .withMessage('Unit cost must be a positive number'),
  body('currency')
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be 3 characters'),
  body('billing_period')
    .isIn(['monthly', 'quarterly', 'yearly', 'one-time'])
    .withMessage('Please select a valid billing period'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Category must be less than 100 characters'),
  body('vendor')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Vendor must be less than 100 characters'),
  body('owner_team')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Owner team must be less than 100 characters'),
  body('owner_contact')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Owner contact must be less than 255 characters')
];

// Validation rules for comment
const validateComment = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Comment is required and must be less than 5000 characters')
];

// Validation rules for password reset
const validatePasswordReset = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
];

// Validation rules for password change
const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('confirmNewPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match new password');
      }
      return true;
    })
];

// Helper function to handle validation results
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    req.flash('error_msg', errorMessages.join('. '));
    return res.redirect('back');
  }
  next();
}

module.exports = {
  validateRegistration,
  validateLogin,
  validateTicket,
  validateCatalogItem,
  validateComment,
  validatePasswordReset,
  validatePasswordChange,
  handleValidationErrors
};