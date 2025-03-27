const Category = require('../models/Category');
const Account = require('../models/Account');
const { asyncHandler } = require('../middlewares/async');
const ErrorResponse = require('../utils/errorResponse');
const mongoose = require('mongoose');

// Create a mock in-memory category store for testing
const mockCategories = [
  {
    _id: '5f9f1b9b9b9b9b9b9b9b9b9b',
    name: 'Crypto Experts',
    description: 'Individuals and organizations with cryptocurrency expertise',
    color: '#f39c12',
    isDefault: true,
    accountCount: 2,
    sentimentScore: 0.85,
    sentimentConfidence: 0.78
  },
  {
    _id: '5f9f1b9b9b9b9b9b9b9b9b9c',
    name: 'News',
    description: 'News outlets and journalists',
    color: '#3498db',
    isDefault: false,
    accountCount: 1,
    sentimentScore: 0.65,
    sentimentConfidence: 0.82
  },
  {
    _id: '5f9f1b9b9b9b9b9b9b9b9b9d',
    name: 'Stock Analysts',
    description: 'Stock market analysts and financial experts',
    color: '#2ecc71',
    isDefault: false,
    accountCount: 0,
    sentimentScore: 0.72,
    sentimentConfidence: 0.65
  }
];

// Helper to check if MongoDB is connected
const isMongoConnected = () => {
  try {
    return mongoose.connection.readyState === 1;
  } catch (error) {
    return false;
  }
};

/**
 * @desc    Get all categories
 * @route   GET /api/v1/categories
 * @access  Private
 */
exports.getCategories = asyncHandler(async (req, res, next) => {
  // Try MongoDB first
  if (isMongoConnected()) {
    const categories = await Category.find().sort({ name: 1 });
    
    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } else {
    // Use mock data if MongoDB is not connected
    res.status(200).json({
      success: true,
      count: mockCategories.length,
      data: mockCategories,
      mock: true
    });
  }
});

/**
 * @desc    Get single category
 * @route   GET /api/v1/categories/:id
 * @access  Private
 */
exports.getCategory = asyncHandler(async (req, res, next) => {
  if (isMongoConnected()) {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return next(
        new ErrorResponse(`Category not found with id of ${req.params.id}`, 404)
      );
    }
    
    res.status(200).json({
      success: true,
      data: category
    });
  } else {
    // Use mock data if MongoDB is not connected
    const category = mockCategories.find(c => c._id === req.params.id);
    
    if (!category) {
      return next(
        new ErrorResponse(`Category not found with id of ${req.params.id}`, 404)
      );
    }
    
    res.status(200).json({
      success: true,
      data: category,
      mock: true
    });
  }
});

/**
 * @desc    Create new category
 * @route   POST /api/v1/categories
 * @access  Private
 */
exports.createCategory = asyncHandler(async (req, res, next) => {
  if (isMongoConnected()) {
    // Check if category with same name already exists
    const existingCategory = await Category.findOne({ 
      name: { $regex: new RegExp('^' + req.body.name + '$', 'i') }
    });
    
    if (existingCategory) {
      return next(
        new ErrorResponse(`Category with name "${req.body.name}" already exists`, 400)
      );
    }
    
    const category = await Category.create(req.body);
    
    res.status(201).json({
      success: true,
      data: category
    });
  } else {
    // Use mock data if MongoDB is not connected
    const existingCategory = mockCategories.find(
      c => c.name.toLowerCase() === req.body.name.toLowerCase()
    );
    
    if (existingCategory) {
      return next(
        new ErrorResponse(`Category with name "${req.body.name}" already exists`, 400)
      );
    }
    
    const newCategory = {
      _id: `mock_${Date.now()}`,
      name: req.body.name,
      description: req.body.description || '',
      color: req.body.color || '#3498db',
      isDefault: false,
      accountCount: 0,
      sentimentScore: 0,
      sentimentConfidence: 0
    };
    
    mockCategories.push(newCategory);
    
    res.status(201).json({
      success: true,
      data: newCategory,
      mock: true
    });
  }
});

/**
 * @desc    Update category
 * @route   PUT /api/v1/categories/:id
 * @access  Private
 */
exports.updateCategory = asyncHandler(async (req, res, next) => {
  if (isMongoConnected()) {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    if (!category) {
      return next(
        new ErrorResponse(`Category not found with id of ${req.params.id}`, 404)
      );
    }
    
    res.status(200).json({
      success: true,
      data: category
    });
  } else {
    // Use mock data if MongoDB is not connected
    const categoryIndex = mockCategories.findIndex(c => c._id === req.params.id);
    
    if (categoryIndex === -1) {
      return next(
        new ErrorResponse(`Category not found with id of ${req.params.id}`, 404)
      );
    }
    
    // Update the category properties
    const updatedCategory = {
      ...mockCategories[categoryIndex],
      ...req.body,
      _id: req.params.id // Ensure the ID doesn't change
    };
    
    // Replace the old category with the updated one
    mockCategories[categoryIndex] = updatedCategory;
    
    res.status(200).json({
      success: true,
      data: updatedCategory,
      mock: true
    });
  }
});

/**
 * @desc    Delete category
 * @route   DELETE /api/v1/categories/:id
 * @access  Private
 */
exports.deleteCategory = asyncHandler(async (req, res, next) => {
  if (isMongoConnected()) {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return next(
        new ErrorResponse(`Category not found with id of ${req.params.id}`, 404)
      );
    }
    
    await category.deleteOne();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } else {
    // Use mock data if MongoDB is not connected
    const categoryIndex = mockCategories.findIndex(c => c._id === req.params.id);
    
    if (categoryIndex === -1) {
      return next(
        new ErrorResponse(`Category not found with id of ${req.params.id}`, 404)
      );
    }
    
    // Remove the category from the mock data
    mockCategories.splice(categoryIndex, 1);
    
    res.status(200).json({
      success: true,
      data: {},
      mock: true
    });
  }
});

/**
 * @desc    Get accounts in a category
 * @route   GET /api/v1/categories/:id/accounts
 * @access  Private
 */
exports.getCategoryAccounts = asyncHandler(async (req, res, next) => {
  const category = await Category.findById(req.params.id);
  
  if (!category) {
    return next(
      new ErrorResponse(`Category not found with id of ${req.params.id}`, 404)
    );
  }
  
  const accounts = await Account.find({ categories: req.params.id })
    .sort({ priority: -1, username: 1 });
  
  res.status(200).json({
    success: true,
    count: accounts.length,
    data: accounts
  });
});

/**
 * @desc    Add accounts to a category
 * @route   POST /api/v1/categories/:id/accounts
 * @access  Private
 */
exports.addAccountsToCategory = asyncHandler(async (req, res, next) => {
  const { accountIds } = req.body;
  
  if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
    return next(
      new ErrorResponse('Please provide an array of account IDs', 400)
    );
  }
  
  const category = await Category.findById(req.params.id);
  
  if (!category) {
    return next(
      new ErrorResponse(`Category not found with id of ${req.params.id}`, 404)
    );
  }
  
  // Update accounts to add this category
  const updatePromises = accountIds.map(async (accountId) => {
    const account = await Account.findById(accountId);
    if (!account) return null;
    
    // Check if category already exists in account
    if (!account.categories.includes(req.params.id)) {
      account.categories.push(req.params.id);
      return account.save();
    }
    
    return account;
  });
  
  await Promise.all(updatePromises);
  
  // Update category account count
  const accountCount = await Account.countDocuments({ categories: req.params.id });
  category.accountCount = accountCount;
  await category.save();
  
  res.status(200).json({
    success: true,
    data: { accountCount }
  });
});

/**
 * @desc    Remove accounts from a category
 * @route   DELETE /api/v1/categories/:id/accounts
 * @access  Private
 */
exports.removeAccountsFromCategory = asyncHandler(async (req, res, next) => {
  const { accountIds } = req.body;
  
  if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
    return next(
      new ErrorResponse('Please provide an array of account IDs', 400)
    );
  }
  
  const category = await Category.findById(req.params.id);
  
  if (!category) {
    return next(
      new ErrorResponse(`Category not found with id of ${req.params.id}`, 404)
    );
  }
  
  // Update accounts to remove this category
  const updatePromises = accountIds.map(async (accountId) => {
    const account = await Account.findById(accountId);
    if (!account) return null;
    
    account.categories = account.categories.filter(
      catId => catId.toString() !== req.params.id
    );
    
    return account.save();
  });
  
  await Promise.all(updatePromises);
  
  // Update category account count
  const accountCount = await Account.countDocuments({ categories: req.params.id });
  category.accountCount = accountCount;
  await category.save();
  
  res.status(200).json({
    success: true,
    data: { accountCount }
  });
}); 