const express = require('express');
const { check } = require('express-validator');
const {
  getAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  bulkImportAccounts,
} = require('../controllers/accountController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// Protect all routes
router.use(protect);

// Get all accounts and create account
router
  .route('/')
  .get(getAccounts)
  .post(
    [
      check('username', 'Username is required').not().isEmpty(),
      check('priority', 'Priority must be between 1 and 5').isInt({ min: 1, max: 5 }),
    ],
    createAccount
  );

// Bulk import accounts
router.post('/import', bulkImportAccounts);

// Get, update, and delete single account
router
  .route('/:id')
  .get(getAccount)
  .put(updateAccount)
  .delete(deleteAccount);

module.exports = router; 