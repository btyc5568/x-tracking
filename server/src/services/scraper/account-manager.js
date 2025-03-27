const md5 = require('md5');
const { logger } = require('../../utils/logger');

/**
 * Manages X accounts for tracking
 */
class AccountManager {
  /**
   * Initialize the account manager
   */
  constructor(config = {}) {
    this.log = logger.child({ module: 'AccountManager' });
    this.accounts = {};
    this.storage = config.storageType || 'memory';
    this.initialized = false;
    
    this.log.info('Account manager initialized', { storageType: this.storage });
  }

  /**
   * Initialize the account storage
   */
  async initialize() {
    if (this.initialized) {
      this.log.warn('Account manager already initialized');
      return;
    }

    try {
      // In a real implementation, this would connect to the database
      // or load from a file, etc.
      
      this.accounts = {}; // Reset accounts
      
      // Add some test accounts if in memory mode and no accounts exist
      if (this.storage === 'memory') {
        await this.addTestAccounts();
      }
      
      this.initialized = true;
      this.log.info('Account manager initialized successfully');
      return true;
    } catch (error) {
      this.log.error('Failed to initialize account manager', { error });
      throw error;
    }
  }
  
  /**
   * Add test accounts for development
   */
  async addTestAccounts() {
    const testAccounts = [
      {
        username: 'elonmusk',
        name: 'Elon Musk',
        priority: 1,
        active: true,
        tags: ['tech', 'space', 'ai']
      },
      {
        username: 'BillGates',
        name: 'Bill Gates',
        priority: 2,
        active: true,
        tags: ['tech', 'philanthropy']
      },
      {
        username: 'OpenAI',
        name: 'OpenAI',
        priority: 1,
        active: true,
        tags: ['ai', 'tech']
      }
    ];
    
    for (const account of testAccounts) {
      await this.addAccount(account);
    }
    
    this.log.info('Added test accounts', { count: testAccounts.length });
  }

  /**
   * Add a new account to track
   */
  async addAccount(accountData) {
    if (!accountData.username) {
      throw new Error('Username is required');
    }
    
    // Create a unique ID if not provided
    const id = accountData.id || md5(accountData.username);
    
    // Check if account already exists
    if (this.accounts[id]) {
      this.log.warn('Account already exists', { id, username: accountData.username });
      return this.accounts[id];
    }
    
    // Create the account
    const now = new Date().toISOString();
    const account = {
      id,
      username: accountData.username,
      name: accountData.name || accountData.username,
      url: `https://twitter.com/${accountData.username}`,
      priority: accountData.priority || 3, // Default to lower priority
      active: accountData.active !== undefined ? accountData.active : true,
      tags: accountData.tags || [],
      lastScraped: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
      metadata: accountData.metadata || {}
    };
    
    // Save the account
    this.accounts[id] = account;
    
    this.log.info('Account added', { id, username: account.username });
    
    return account;
  }

  /**
   * Update an existing account
   */
  async updateAccount(id, updateData) {
    // Check if account exists
    if (!this.accounts[id]) {
      this.log.warn('Account not found for update', { id });
      throw new Error('Account not found');
    }
    
    // Update allowed fields
    const allowedFields = ['name', 'priority', 'active', 'tags', 'metadata'];
    const account = this.accounts[id];
    let updated = false;
    
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        account[field] = updateData[field];
        updated = true;
      }
    }
    
    // Special handling for username update
    if (updateData.username && updateData.username !== account.username) {
      account.username = updateData.username;
      account.url = `https://twitter.com/${updateData.username}`;
      updated = true;
    }
    
    if (updated) {
      account.updatedAt = new Date().toISOString();
      this.log.info('Account updated', { id, username: account.username });
    } else {
      this.log.debug('No changes to account', { id });
    }
    
    return account;
  }

  /**
   * Delete an account
   */
  async deleteAccount(id) {
    // Check if account exists
    if (!this.accounts[id]) {
      this.log.warn('Account not found for deletion', { id });
      throw new Error('Account not found');
    }
    
    // Delete the account
    const username = this.accounts[id].username;
    delete this.accounts[id];
    
    this.log.info('Account deleted', { id, username });
    
    return { success: true, id, username };
  }

  /**
   * Get an account by ID
   */
  async getAccount(id) {
    return this.accounts[id] || null;
  }

  /**
   * Find an account by username
   */
  async findAccountByUsername(username) {
    if (!username) return null;
    
    const normalizedUsername = username.toLowerCase();
    
    return Object.values(this.accounts).find(
      account => account.username.toLowerCase() === normalizedUsername
    ) || null;
  }

  /**
   * Get all accounts with optional filtering
   */
  async getAccounts(filter = {}) {
    try {
      this.log.debug('Getting accounts with filter', { filter });
      
      let accounts = Object.values(this.accounts);
      
      // Filter by active status
      if (filter.active !== undefined) {
        this.log.debug('Filtering accounts by active status', { active: filter.active });
        accounts = accounts.filter(account => account.active === filter.active);
      }
      
      // Filter by priority
      if (filter.priority !== undefined) {
        this.log.debug('Filtering accounts by priority', { priority: filter.priority });
        accounts = accounts.filter(account => account.priority === filter.priority);
      }
      
      // Filter by tag
      if (filter.tag) {
        this.log.debug('Filtering accounts by tag', { tag: filter.tag });
        accounts = accounts.filter(account => account.tags.includes(filter.tag));
      }
      
      // Sort by priority (highest first)
      accounts.sort((a, b) => a.priority - b.priority);
      
      this.log.debug('Returning accounts', { count: accounts.length });
      return accounts;
    } catch (error) {
      this.log.error('Error in getAccounts', { error: error.message, stack: error.stack });
      throw error;
    }
  }
  
  /**
   * Update the lastScraped timestamp for an account
   */
  async updateLastScraped(id, success, errorMessage = null) {
    // Check if account exists
    if (!this.accounts[id]) {
      this.log.warn('Account not found for updating lastScraped', { id });
      throw new Error('Account not found');
    }
    
    // Update the account
    const account = this.accounts[id];
    account.lastScraped = new Date().toISOString();
    
    if (!success && errorMessage) {
      account.lastError = {
        message: errorMessage,
        timestamp: account.lastScraped
      };
    } else if (success) {
      account.lastError = null;
    }
    
    account.updatedAt = account.lastScraped;
    
    this.log.debug('Updated lastScraped timestamp', { 
      id, 
      username: account.username, 
      success, 
      hasError: !!account.lastError 
    });
    
    return account;
  }
  
  /**
   * Get the next account to scrape based on priority
   */
  async getNextAccountToScrape() {
    // Get all active accounts
    const activeAccounts = await this.getAccounts({ active: true });
    
    if (activeAccounts.length === 0) {
      this.log.debug('No active accounts to scrape');
      return null;
    }
    
    // Sort by priority and last scraped time
    activeAccounts.sort((a, b) => {
      // If priorities are different, sort by priority (lower number = higher priority)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      
      // If one has never been scraped, prioritize it
      if (!a.lastScraped) return -1;
      if (!b.lastScraped) return 1;
      
      // Otherwise sort by lastScraped (oldest first)
      return new Date(a.lastScraped) - new Date(b.lastScraped);
    });
    
    // Return the highest priority account that hasn't been scraped recently
    return activeAccounts[0];
  }
}

module.exports = { AccountManager }; 