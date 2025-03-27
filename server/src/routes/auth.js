const express = require('express');
const { check } = require('express-validator');
const {
  register,
  login,
  getMe,
  updateDetails,
  updatePassword,
  updatePreferences,
} = require('../controllers/authController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

// Register user
router.post(
  '/register',
  [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check(
      'password',
      'Please enter a password with 6 or more characters'
    ).isLength({ min: 6 }),
  ],
  register
);

// Login user
router.post(
  '/login',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists(),
  ],
  login
);

// Get current user
router.get('/me', protect, getMe);

// Update user details
router.put(
  '/updatedetails',
  protect,
  [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').optional().isEmail(),
  ],
  updateDetails
);

// Update password
router.put(
  '/updatepassword',
  protect,
  [
    check('currentPassword', 'Current password is required').exists(),
    check(
      'newPassword',
      'Please enter a new password with 6 or more characters'
    ).isLength({ min: 6 }),
  ],
  updatePassword
);

// Update preferences
router.put('/preferences', protect, updatePreferences);

module.exports = router; 