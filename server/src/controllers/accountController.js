const Account = require('../models/Account');
const Category = require('../models/Category');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

/**
 * @desc    Get all accounts
 * @route   GET /api/accounts
 * @access  Private
 */
exports.getAccounts = async (req, res) => {
  try {
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