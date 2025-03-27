const express = require('express');
const { logger } = require('../../utils/logger');
const { AccountManager } = require('../../services/scraper/account-manager');
const crypto = require('crypto');

const router = express.Router();
const log = logger.child({ module: 'AccountsAPI' });

// Initialize account manager
const accountManager = new AccountManager({ 
  // Config will be passed from the orchestrator
  storageType: process.env.ACCOUNT_STORAGE_TYPE || 'memory'
});

// Initialize account manager
(async () => {
  try {
    await accountManager.initialize();
    log.info('Account manager initialized successfully');
  } catch (error) {
    log.error('Failed to initialize account manager', { error });
  }
})();

/**
 * @route   GET /api/accounts
 * @desc    Get all accounts with optional filtering
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    console.log('GET /api/accounts request received', { query: req.query });
    
    const { active, tag, priority } = req.query;
    
    // Build filter object
    const filter = {};
    
    if (active !== undefined) {
      filter.active = active === 'true';
    }
    
    if (tag) {
      filter.tag = tag;
    }
    
    if (priority) {
      filter.priority = parseInt(priority, 10);
    }
    
    let accounts = [];
    
    // First try to use accountManager
    try {
      if (accountManager) {
        console.log('Getting accounts with accountManager');
        accounts = await accountManager.getAccounts(filter);
        console.log('Retrieved accounts from manager', { count: accounts.length });
      }
    } catch (managerError) {
      console.error('Error getting accounts from accountManager:', managerError);
      // Will fall back to global storage
    }
    
    // If no accounts from accountManager or there was an error, try global storage
    if (accounts.length === 0 && global.accounts) {
      console.log('Using fallback global accounts storage');
      accounts = Array.from(global.accounts.values());
      
      // Apply filters if needed
      if (Object.keys(filter).length > 0) {
        accounts = accounts.filter(account => {
          let match = true;
          if (filter.active !== undefined) match = match && account.active === filter.active;
          if (filter.tag) match = match && account.tags.includes(filter.tag);
          if (filter.priority) match = match && account.priority === filter.priority;
          return match;
        });
      }
      
      console.log('Retrieved accounts from global storage', { count: accounts.length });
    }
    
    return res.json({ 
      success: true, 
      data: accounts
    });
  } catch (error) {
    console.error('Error getting all accounts', error);
    
    return res.status(500).json({ 
      success: false, 
      error: 'Server error retrieving accounts' 
    });
  }
});

/**
 * @route   GET /api/accounts/:id
 * @desc    Get account by ID
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const account = await accountManager.getAccount(req.params.id);
    
    if (!account) {
      return res.status(404).json({ 
        success: false, 
        error: 'Account not found' 
      });
    }
    
    return res.json({ 
      success: true, 
      data: account
    });
  } catch (error) {
    log.error('Error getting account by id', { error, id: req.params.id });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error retrieving account' 
    });
  }
});

/**
 * @route   POST /api/accounts
 * @desc    Create a new account
 * @access  Public
 */
router.post('/', async (req, res) => {
  try {
    console.log('Received create account request with body:', req.body);
    
    // Validate required fields
    const { username, name, url } = req.body;
    if (!username || !name || !url) {
      console.log('Missing required fields:', { username, name, url });
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: username, name, and url are required' 
      });
    }
    
    // Generate a unique ID for the account
    const id = crypto.createHash('md5').update(username + Date.now()).digest('hex');
    
    // Make sure tags is always a proper array
    let tags = [];
    
    // Log the incoming tags to troubleshoot
    console.log('Raw tags from request:', req.body.tags);
    console.log('Type of tags:', typeof req.body.tags);
    
    if (req.body.tags !== undefined) {
      // Handle different tag formats
      if (Array.isArray(req.body.tags)) {
        // Filter out any empty or invalid tags
        tags = req.body.tags
          .map(tag => String(tag).trim())  // Convert all tags to strings
          .filter(tag => tag && tag.length > 0); // Remove empty tags
        
        console.log('Tags after processing array:', tags);
      } else if (typeof req.body.tags === 'string') {
        // Split comma-separated tags if sent as a string
        tags = req.body.tags.split(',')
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0);
        console.log('Tags from comma-separated string:', tags);
      } else {
        console.log('Tags in unexpected format:', req.body.tags);
        // Try to convert to string and then to array as last resort
        try {
          const tagString = String(req.body.tags);
          tags = tagString.split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);
          console.log('Tags from forced string conversion:', tags);
        } catch (e) {
          console.error('Could not process tags:', e.message);
        }
      }
    }
    
    console.log('Final processed tags:', tags);
    
    // Create a full account object with all fields
    const newAccount = {
      id,
      username,
      name,
      url: url.startsWith('https://') ? url : `https://twitter.com/${username}`,
      priority: req.body.priority || 2,
      active: req.body.active !== undefined ? req.body.active : true,
      tags: tags,
      lastScraped: null,
      lastError: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {}
    };
    
    console.log('Created account object:', newAccount);
    console.log('Tags in new account:', newAccount.tags);
    
    // First try to use accountManager if available
    try {
      if (accountManager) {
        const savedAccount = await accountManager.addAccount(newAccount);
        console.log('Account saved via accountManager:', savedAccount);
        console.log('Tags in saved account:', savedAccount.tags);
        return res.status(201).json({ success: true, data: savedAccount });
      }
    } catch (managerError) {
      console.error('Error saving with accountManager:', managerError);
      // Fall back to simple in-memory storage
    }
    
    // Fallback: Simple in-memory storage of accounts if accountManager fails
    if (!global.accounts) {
      global.accounts = new Map();
    }
    
    // Store the account
    global.accounts.set(id, newAccount);
    console.log('Account saved in fallback storage:', id);
    
    // Return the created account
    return res.status(201).json({ success: true, data: newAccount });
  } catch (error) {
    console.error('Error creating account:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to create account', 
      error: error.message 
    });
  }
});

/**
 * @route   PUT /api/accounts/:id
 * @desc    Update an account
 * @access  Public
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Check if account exists
    const existingAccount = await accountManager.getAccount(id);
    
    if (!existingAccount) {
      return res.status(404).json({ 
        success: false, 
        error: 'Account not found' 
      });
    }
    
    // Update account
    const updatedAccount = await accountManager.updateAccount(id, updateData);
    
    return res.json({ 
      success: true, 
      data: updatedAccount
    });
  } catch (error) {
    log.error('Error updating account', { error, id: req.params.id, body: req.body });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error updating account' 
    });
  }
});

/**
 * @route   DELETE /api/accounts/:id
 * @desc    Delete an account
 * @access  Public
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if account exists
    const existingAccount = await accountManager.getAccount(id);
    
    if (!existingAccount) {
      return res.status(404).json({ 
        success: false, 
        error: 'Account not found' 
      });
    }
    
    // Delete account
    const result = await accountManager.deleteAccount(id);
    
    return res.json({ 
      success: true, 
      message: 'Account deleted successfully',
      data: result
    });
  } catch (error) {
    log.error('Error deleting account', { error, id: req.params.id });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error deleting account' 
    });
  }
});

/**
 * @route   GET /api/accounts/username/:username
 * @desc    Find account by username
 * @access  Public
 */
router.get('/username/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    const account = await accountManager.findAccountByUsername(username);
    
    if (!account) {
      return res.status(404).json({ 
        success: false, 
        error: 'Account not found' 
      });
    }
    
    return res.json({ 
      success: true, 
      data: account
    });
  } catch (error) {
    log.error('Error finding account by username', { error, username: req.params.username });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error finding account' 
    });
  }
});

/**
 * @route   POST /api/accounts/:id/scrape
 * @desc    Manually trigger scraping for an account
 * @access  Public
 */
router.post('/:id/scrape', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if account exists
    const existingAccount = await accountManager.getAccount(id);
    
    if (!existingAccount) {
      return res.status(404).json({ 
        success: false, 
        error: 'Account not found' 
      });
    }
    
    // Get the orchestrator
    const orchestrator = req.app.get('scraperOrchestrator');
    
    if (!orchestrator) {
      return res.status(500).json({ 
        success: false, 
        error: 'Scraper orchestrator not available' 
      });
    }
    
    // Request scraping
    const result = await orchestrator.scrapeAccount(id);
    
    return res.json({ 
      success: true, 
      message: 'Scrape request processed',
      data: result
    });
  } catch (error) {
    log.error('Error triggering account scrape', { error, id: req.params.id });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error triggering account scrape' 
    });
  }
});

/**
 * @route   PUT /api/accounts/:id/toggle
 * @desc    Toggle account active status
 * @access  Public
 */
router.put('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    
    // Check if account exists
    const existingAccount = await accountManager.getAccount(id);
    
    if (!existingAccount) {
      return res.status(404).json({ 
        success: false, 
        error: 'Account not found' 
      });
    }
    
    if (active === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'Active status is required' 
      });
    }
    
    // Update account active status
    const updatedAccount = await accountManager.updateAccount(id, { active });
    
    return res.json({ 
      success: true, 
      message: `Account ${active ? 'activated' : 'deactivated'} successfully`,
      data: updatedAccount
    });
  } catch (error) {
    log.error('Error toggling account status', { error, id: req.params.id, body: req.body });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error toggling account status' 
    });
  }
});

module.exports = router; 