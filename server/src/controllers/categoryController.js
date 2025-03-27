const Category = require('../models/Category');
const Account = require('../models/Account');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

/**
 * @desc    Get all categories
 * @route   GET /api/categories
 * @access  Private
 */
exports.getCategories = async (req, res) => {
  try {
    const { sort, page = 1, limit = 20 } = req.query;

    // Define sort options
    let sortOptions = {};
    if (sort) {
      const parts = sort.split(':');
      sortOptions[parts[0]] = parts[1] === 'desc' ? -1 : 1;
    } else {
      sortOptions = { isDefault: -1, name: 1 };
    }

    // Count total documents
    const total = await Category.countDocuments();

    // Fetch categories
    const categories = await Category.find()
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: categories.length,
      total,
      pagination: {
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        pageSize: parseInt(limit),
      },
      data: categories,
    });
  } catch (err) {
    logger.error(`Error getting categories: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server Error',
    });
  }
};

/**
 * @desc    Get single category
 * @route   GET /api/categories/:id
 * @access  Private
 */
exports.getCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      });
    }

    res.json({
      success: true,
      data: category,
    });
  } catch (err) {
    logger.error(`Error getting category: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server Error',
    });
  }
};

/**
 * @desc    Create new category
 * @route   POST /api/categories
 * @access  Private
 */
exports.createCategory = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }

  try {
    // Check if category with this name already exists
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${req.body.name}$`, 'i') },
    });
    
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        error: 'Category with this name already exists',
      });
    }

    const category = await Category.create(req.body);

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (err) {
    logger.error(`Error creating category: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server Error',
    });
  }
};

/**
 * @desc    Update category
 * @route   PUT /api/categories/:id
 * @access  Private
 */
exports.updateCategory = async (req, res) => {
  try {
    let category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      });
    }

    // If name is being updated, check it's not a duplicate
    if (req.body.name && req.body.name !== category.name) {
      const existingCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${req.body.name}$`, 'i') },
        _id: { $ne: req.params.id },
      });
      
      if (existingCategory) {
        return res.status(400).json({
          success: false,
          error: 'Category with this name already exists',
        });
      }
    }

    category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.json({
      success: true,
      data: category,
    });
  } catch (err) {
    logger.error(`Error updating category: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server Error',
    });
  }
};

/**
 * @desc    Delete category
 * @route   DELETE /api/categories/:id
 * @access  Private
 */
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      });
    }

    // Check if category is in use
    const accountCount = await Account.countDocuments({
      categories: req.params.id,
    });

    if (accountCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete category that is assigned to ${accountCount} accounts`,
      });
    }

    await category.deleteOne();

    res.json({
      success: true,
      data: {},
    });
  } catch (err) {
    logger.error(`Error deleting category: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server Error',
    });
  }
};

/**
 * @desc    Get accounts in a category
 * @route   GET /api/categories/:id/accounts
 * @access  Private
 */
exports.getCategoryAccounts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      });
    }

    // Count accounts in this category
    const total = await Account.countDocuments({
      categories: req.params.id,
    });

    // Find accounts in this category
    const accounts = await Account.find({ categories: req.params.id })
      .sort({ priority: -1, username: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('categories', 'name color');

    res.json({
      success: true,
      count: accounts.length,
      total,
      pagination: {
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        pageSize: parseInt(limit),
      },
      category: category.name,
      data: accounts,
    });
  } catch (err) {
    logger.error(`Error getting category accounts: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server Error',
    });
  }
}; 