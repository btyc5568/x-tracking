const express = require('express');
const router = express.Router();
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryAccounts,
  addAccountsToCategory,
  removeAccountsFromCategory
} = require('../controllers/categoryController');

// Get all categories and create new category
router.route('/')
  .get(getCategories)
  .post(createCategory);

// Get, update and delete category
router.route('/:id')
  .get(getCategory)
  .put(updateCategory)
  .delete(deleteCategory);

// Get accounts in a category
router.route('/:id/accounts')
  .get(getCategoryAccounts)
  .post(addAccountsToCategory)
  .delete(removeAccountsFromCategory);

module.exports = router; 