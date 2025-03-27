const express = require('express');
const { check } = require('express-validator');
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryAccounts,
} = require('../controllers/categoryController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// Protect all routes
router.use(protect);

// Get all categories and create category
router
  .route('/')
  .get(getCategories)
  .post(
    [check('name', 'Category name is required').not().isEmpty()],
    createCategory
  );

// Get, update, and delete single category
router
  .route('/:id')
  .get(getCategory)
  .put(updateCategory)
  .delete(deleteCategory);

// Get accounts in a category
router.get('/:id/accounts', getCategoryAccounts);

module.exports = router; 