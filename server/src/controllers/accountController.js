const Account = require('../models/Account');
const Category = require('../models/Category');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');
const { asyncHandler } = require('../middlewares/async');
const ErrorResponse = require('../utils/errorResponse');
const mongoose = require('mongoose');

// Create a mock in-memory account store for testing
const mockAccounts = [
  {
    _id: 'acc_1',
    username: 'elonmusk',
    displayName: 'Elon Musk',
    profileImageUrl: 'https://pbs.twimg.com/profile_images/1383184766959120385/MM9DHPWC_400x400.jpg',
    priority: 5,
    categories: ['5f9f1b9b9b9b9b9b9b9b9b9b'],
    active: true,
    lastScraped: new Date().toISOString(),
    followerCount: 128000000,
    followingCount: 201,
    tags: ['tech', 'business', 'crypto']
  },
  {
    _id: 'acc_2',
    username: 'jack',
    displayName: 'Jack',
    profileImageUrl: 'https://pbs.twimg.com/profile_images/1115644092329758721/AFjOr-K8_400x400.jpg',
    priority: 4,
    categories: ['5f9f1b9b9b9b9b9b9b9b9b9b'],
    active: true,
    lastScraped: new Date().toISOString(),
    followerCount: 6300000,
    followingCount: 4212,
    tags: ['crypto', 'bitcoin', 'business']
  },
  {
    _id: 'acc_3',
    username: 'CNBC',
    displayName: 'CNBC',
    profileImageUrl: 'https://pbs.twimg.com/profile_images/1455613402616659970/MpK1lFyQ_400x400.jpg',
    priority: 3,
    categories: ['5f9f1b9b9b9b9b9b9b9b9b9c'],
    active: true,
    lastScraped: new Date().toISOString(),
    followerCount: 4200000,
    followingCount: 1256,
    tags: ['news', 'finance']
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
 * @desc    Get all accounts
 * @route   GET /api/accounts
 * @access  Private
 */
exports.getAccounts = async (req, res) => {
  try {
    if (isMongoConnected()) {
      const { category, priority, search, sort, page = 1, limit = 10 } = req.query;
      const query = {};

      // Filter by category if provided
      if (category) {
        query.categories = category;
      }

      // Filter by priority if provided
      if (priority) {
        query.priority = priority;
      }

      // Search by username or displayName if provided
      if (search) {
        query.$or = [
          { username: { $regex: search, $options: 'i' } },
          { displayName: { $regex: search, $options: 'i' } },
        ];
      }

      // Count total documents
      const total = await Account.countDocuments(query);

      // Define sort options
      let sortOptions = {};
      if (sort) {
        const parts = sort.split(':');
        sortOptions[parts[0]] = parts[1] === 'desc' ? -1 : 1;
      } else {
        sortOptions = { priority: -1, username: 1 };
      }

      // Fetch accounts
      const accounts = await Account.find(query)
        .sort(sortOptions)
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
        data: accounts,
      });
    } else {
      // Use mock data if MongoDB is not connected
      let filteredAccounts = [...mockAccounts];
      
      // Apply filter by category if provided
      if (req.query.category) {
        filteredAccounts = filteredAccounts.filter(account => 
          account.categories.includes(req.query.category)
        );
      }
      
      // Apply filter by priority if provided
      if (req.query.priority) {
        filteredAccounts = filteredAccounts.filter(account => 
          account.priority === parseInt(req.query.priority)
        );
      }
      
      // Apply search filter if provided
      if (req.query.search) {
        const searchTerm = req.query.search.toLowerCase();
        filteredAccounts = filteredAccounts.filter(account => 
          account.username.toLowerCase().includes(searchTerm) || 
          account.displayName.toLowerCase().includes(searchTerm)
        );
      }
      
      // Apply sorting
      const { sort } = req.query;
      if (sort) {
        const parts = sort.split(':');
        const field = parts[0];
        const direction = parts[1] === 'desc' ? -1 : 1;
        
        filteredAccounts.sort((a, b) => {
          if (a[field] < b[field]) return -1 * direction;
          if (a[field] > b[field]) return 1 * direction;
          return 0;
        });
      } else {
        // Default sorting
        filteredAccounts.sort((a, b) => {
          if (a.priority > b.priority) return -1;
          if (a.priority < b.priority) return 1;
          return a.username.localeCompare(b.username);
        });
      }
      
      // Apply pagination
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedAccounts = filteredAccounts.slice(startIndex, endIndex);
      
      res.json({
        success: true,
        count: paginatedAccounts.length,
        total: filteredAccounts.length,
        pagination: {
          totalPages: Math.ceil(filteredAccounts.length / limit),
          currentPage: page,
          pageSize: limit,
        },
        data: paginatedAccounts,
        mock: true
      });
    }
  } catch (err) {
    logger.error(`Error getting accounts: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server Error',
    });
  }
};

/**
 * @desc    Get single account
 * @route   GET /api/accounts/:id
 * @access  Private
 */
exports.getAccount = async (req, res) => {
  try {
    const account = await Account.findById(req.params.id).populate(
      'categories',
      'name color'
    );

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
      });
    }

    res.json({
      success: true,
      data: account,
    });
  } catch (err) {
    logger.error(`Error getting account: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server Error',
    });
  }
};

/**
 * @desc    Create new account
 * @route   POST /api/accounts
 * @access  Private
 */
exports.createAccount = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }

  try {
    // Check if username already exists
    const existingAccount = await Account.findOne({ username: req.body.username });
    if (existingAccount) {
      return res.status(400).json({
        success: false,
        error: 'Account with this username already exists',
      });
    }

    // Validate categories if provided
    if (req.body.categories && req.body.categories.length > 0) {
      const categoryCount = await Category.countDocuments({
        _id: { $in: req.body.categories },
      });

      if (categoryCount !== req.body.categories.length) {
        return res.status(400).json({
          success: false,
          error: 'One or more categories not found',
        });
      }
    }

    const account = await Account.create(req.body);

    // Update category counts
    if (req.body.categories && req.body.categories.length > 0) {
      await Category.updateMany(
        { _id: { $in: req.body.categories } },
        { $inc: { accountCount: 1 } }
      );
    }

    res.status(201).json({
      success: true,
      data: account,
    });
  } catch (err) {
    logger.error(`Error creating account: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server Error',
    });
  }
};

/**
 * @desc    Update account
 * @route   PUT /api/accounts/:id
 * @access  Private
 */
exports.updateAccount = async (req, res) => {
  try {
    let account = await Account.findById(req.params.id);

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
      });
    }

    // Store original categories to update counts
    const originalCategories = [...account.categories];

    // Validate new categories if provided
    if (req.body.categories && req.body.categories.length > 0) {
      const categoryCount = await Category.countDocuments({
        _id: { $in: req.body.categories },
      });

      if (categoryCount !== req.body.categories.length) {
        return res.status(400).json({
          success: false,
          error: 'One or more categories not found',
        });
      }
    }

    account = await Account.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('categories', 'name color');

    // Update category counts if categories changed
    if (req.body.categories) {
      // Decrease count for removed categories
      const removedCategories = originalCategories.filter(
        (cat) => !req.body.categories.includes(cat.toString())
      );
      if (removedCategories.length > 0) {
        await Category.updateMany(
          { _id: { $in: removedCategories } },
          { $inc: { accountCount: -1 } }
        );
      }

      // Increase count for added categories
      const addedCategories = req.body.categories.filter(
        (cat) => !originalCategories.includes(cat)
      );
      if (addedCategories.length > 0) {
        await Category.updateMany(
          { _id: { $in: addedCategories } },
          { $inc: { accountCount: 1 } }
        );
      }
    }

    res.json({
      success: true,
      data: account,
    });
  } catch (err) {
    logger.error(`Error updating account: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server Error',
    });
  }
};

/**
 * @desc    Delete account
 * @route   DELETE /api/accounts/:id
 * @access  Private
 */
exports.deleteAccount = async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
      });
    }

    await account.deleteOne();

    // Update category counts
    if (account.categories.length > 0) {
      await Category.updateMany(
        { _id: { $in: account.categories } },
        { $inc: { accountCount: -1 } }
      );
    }

    res.json({
      success: true,
      data: {},
    });
  } catch (err) {
    logger.error(`Error deleting account: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server Error',
    });
  }
};

/**
 * @desc    Bulk import accounts
 * @route   POST /api/accounts/import
 * @access  Private
 */
exports.bulkImportAccounts = async (req, res) => {
  try {
    const { accounts } = req.body;

    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an array of accounts',
      });
    }

    // Verify all usernames are unique
    const usernames = accounts.map((account) => account.username);
    if (new Set(usernames).size !== usernames.length) {
      return res.status(400).json({
        success: false,
        error: 'Duplicate usernames found in import data',
      });
    }

    // Check for existing accounts
    const existingAccounts = await Account.find({
      username: { $in: usernames },
    });

    if (existingAccounts.length > 0) {
      const existingUsernames = existingAccounts.map((account) => account.username);
      return res.status(400).json({
        success: false,
        error: `These accounts already exist: ${existingUsernames.join(', ')}`,
      });
    }

    // Validate all categories
    const allCategoryIds = [
      ...new Set(
        accounts.flatMap((account) => 
          account.categories ? account.categories : []
        )
      ),
    ];

    if (allCategoryIds.length > 0) {
      const categoryCount = await Category.countDocuments({
        _id: { $in: allCategoryIds },
      });

      if (categoryCount !== allCategoryIds.length) {
        return res.status(400).json({
          success: false,
          error: 'One or more categories not found',
        });
      }
    }

    // Create accounts
    const createdAccounts = await Account.insertMany(accounts);

    // Update category counts
    const categoryUpdateMap = {};
    accounts.forEach((account) => {
      if (account.categories && account.categories.length > 0) {
        account.categories.forEach((catId) => {
          categoryUpdateMap[catId] = (categoryUpdateMap[catId] || 0) + 1;
        });
      }
    });

    const categoryUpdatePromises = Object.entries(categoryUpdateMap).map(
      ([catId, count]) => {
        return Category.updateOne(
          { _id: catId },
          { $inc: { accountCount: count } }
        );
      }
    );

    await Promise.all(categoryUpdatePromises);

    res.status(201).json({
      success: true,
      count: createdAccounts.length,
      data: createdAccounts,
    });
  } catch (err) {
    logger.error(`Error bulk importing accounts: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server Error',
    });
  }
};

/**
 * @desc    Update account categories
 * @route   PUT /api/accounts/:id/categories
 * @access  Private
 */
exports.updateAccountCategories = asyncHandler(async (req, res, next) => {
  // Verify account exists
  const account = await Account.findById(req.params.id);
  
  if (!account) {
    return next(new ErrorResponse(`Account not found with id of ${req.params.id}`, 404));
  }
  
  // Validate request body
  const { categories } = req.body;
  
  if (!categories || !Array.isArray(categories)) {
    return next(new ErrorResponse('Please provide an array of category IDs', 400));
  }
  
  // Verify all categories exist
  for (const categoryId of categories) {
    const category = await Category.findById(categoryId);
    if (!category) {
      return next(new ErrorResponse(`Category not found with id of ${categoryId}`, 404));
    }
  }
  
  // Update account with new categories
  account.categories = categories;
  await account.save();
  
  // Update account counts for all categories
  const allCategories = await Category.find();
  
  for (const category of allCategories) {
    const count = await Account.countDocuments({ categories: category._id });
    category.accountCount = count;
    await category.save();
  }
  
  // Return updated account
  res.status(200).json({
    success: true,
    data: await Account.findById(req.params.id).populate('categories', 'name color')
  });
});

/**
 * @desc    Add account to categories
 * @route   POST /api/accounts/:id/categories
 * @access  Private
 */
exports.addAccountToCategories = asyncHandler(async (req, res, next) => {
  // Verify account exists
  const account = await Account.findById(req.params.id);
  
  if (!account) {
    return next(new ErrorResponse(`Account not found with id of ${req.params.id}`, 404));
  }
  
  // Validate request body
  const { categoryIds } = req.body;
  
  if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
    return next(new ErrorResponse('Please provide an array of category IDs', 400));
  }
  
  // Add account to each category if not already added
  for (const categoryId of categoryIds) {
    // Verify category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return next(new ErrorResponse(`Category not found with id of ${categoryId}`, 404));
    }
    
    // Check if account already has this category
    if (!account.categories.includes(categoryId)) {
      account.categories.push(categoryId);
    }
  }
  
  // Save account
  await account.save();
  
  // Update account counts for affected categories
  for (const categoryId of categoryIds) {
    const category = await Category.findById(categoryId);
    const count = await Account.countDocuments({ categories: categoryId });
    category.accountCount = count;
    await category.save();
  }
  
  // Return updated account
  res.status(200).json({
    success: true,
    data: await Account.findById(req.params.id).populate('categories', 'name color')
  });
});

/**
 * @desc    Remove account from categories
 * @route   DELETE /api/accounts/:id/categories
 * @access  Private
 */
exports.removeAccountFromCategories = asyncHandler(async (req, res, next) => {
  // Verify account exists
  const account = await Account.findById(req.params.id);
  
  if (!account) {
    return next(new ErrorResponse(`Account not found with id of ${req.params.id}`, 404));
  }
  
  // Validate request body
  const { categoryIds } = req.body;
  
  if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
    return next(new ErrorResponse('Please provide an array of category IDs', 400));
  }
  
  // Remove account from each category
  account.categories = account.categories.filter(
    categoryId => !categoryIds.includes(categoryId.toString())
  );
  
  // Save account
  await account.save();
  
  // Update account counts for affected categories
  for (const categoryId of categoryIds) {
    const category = await Category.findById(categoryId);
    if (category) {
      const count = await Account.countDocuments({ categories: categoryId });
      category.accountCount = count;
      await category.save();
    }
  }
  
  // Return updated account
  res.status(200).json({
    success: true,
    data: await Account.findById(req.params.id).populate('categories', 'name color')
  });
}); 