const { logger } = require('../../utils/logger');

/**
 * Schedules X account scraping based on priority
 */
class PriorityScheduler {
  /**
   * Initialize the scheduler
   */
  constructor(config = {}) {
    this.log = logger.child({ module: 'PriorityScheduler' });
    
    // Initialize configuration with defaults
    this.config = {
      minInterval: config.minInterval || 60 * 60 * 1000, // 1 hour default minimum interval
      maxConcurrent: config.maxConcurrent || 2, // Default max concurrent jobs
      priorityLevels: config.priorityLevels || {
        1: 1 * 60 * 60 * 1000,     // Priority 1: every 1 hour
        2: 3 * 60 * 60 * 1000,     // Priority 2: every 3 hours
        3: 12 * 60 * 60 * 1000,    // Priority 3: every 12 hours
        4: 24 * 60 * 60 * 1000,    // Priority 4: every 1 day
        5: 3 * 24 * 60 * 60 * 1000 // Priority 5: every 3 days
      },
      ...config
    };
    
    // Initialize state
    this.queue = [];
    this.running = new Map();
    this.timers = new Map();
    this.isRunning = false;
    this.accountManager = null;
    this.metricsCollector = null;
    this.scraper = null;
    
    this.log.info('Priority scheduler initialized', { 
      minInterval: this.config.minInterval, 
      maxConcurrent: this.config.maxConcurrent 
    });
  }
  
  /**
   * Set up the scheduler with required services
   */
  setup({ accountManager, metricsCollector, scraper }) {
    this.accountManager = accountManager;
    this.metricsCollector = metricsCollector;
    this.scraper = scraper;
    
    this.log.info('Priority scheduler setup complete');
    return this;
  }
  
  /**
   * Start the scheduler
   */
  start() {
    if (this.isRunning) {
      this.log.warn('Scheduler is already running');
      return this;
    }
    
    if (!this.accountManager || !this.metricsCollector || !this.scraper) {
      this.log.error('Scheduler cannot start: missing required services');
      throw new Error('Scheduler cannot start: accountManager, metricsCollector, and scraper are required');
    }
    
    this.isRunning = true;
    this.log.info('Starting priority scheduler');
    
    // Initial schedule
    this.scheduleAll();
    
    // Start processing the queue
    this.processQueue();
    
    return this;
  }
  
  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isRunning) {
      this.log.warn('Scheduler is not running');
      return this;
    }
    
    this.isRunning = false;
    this.log.info('Stopping priority scheduler');
    
    // Clear all timers
    for (const timerId of this.timers.values()) {
      clearTimeout(timerId);
    }
    
    this.timers.clear();
    
    return this;
  }
  
  /**
   * Schedule all accounts for scraping
   */
  async scheduleAll() {
    try {
      // Get all active accounts
      const accounts = await this.accountManager.getAccounts({ active: true });
      
      if (accounts.length === 0) {
        this.log.info('No active accounts to schedule');
        return;
      }
      
      this.log.info(`Scheduling ${accounts.length} accounts`);
      
      // Schedule each account
      for (const account of accounts) {
        await this.scheduleAccount(account);
      }
    } catch (error) {
      this.log.error('Error scheduling accounts', { error });
    }
  }
  
  /**
   * Schedule an account for scraping
   */
  async scheduleAccount(account) {
    try {
      if (!account || !account.id) {
        this.log.warn('Invalid account object for scheduling');
        return;
      }
      
      // Cancel any existing timer for this account
      if (this.timers.has(account.id)) {
        clearTimeout(this.timers.get(account.id));
        this.timers.delete(account.id);
      }
      
      // Calculate next run time
      const nextRunDelay = this.calculateNextRunDelay(account);
      
      this.log.debug(`Scheduling account ${account.username} (${account.id}) to run in ${Math.round(nextRunDelay / 1000 / 60)} minutes`);
      
      // Set timer for next run
      const timerId = setTimeout(() => {
        this.addToQueue(account);
        this.timers.delete(account.id);
      }, nextRunDelay);
      
      // Store timer ID
      this.timers.set(account.id, timerId);
    } catch (error) {
      this.log.error('Error scheduling account', { error, accountId: account.id });
    }
  }
  
  /**
   * Calculate delay until next run based on priority
   */
  calculateNextRunDelay(account) {
    try {
      // Default to lowest priority if invalid
      const priority = account.priority && this.config.priorityLevels[account.priority] 
        ? account.priority 
        : Object.keys(this.config.priorityLevels).length;
      
      // Get interval based on priority
      const priorityInterval = this.config.priorityLevels[priority];
      
      // If never scraped, schedule immediately with a small random delay
      if (!account.lastScraped) {
        return Math.random() * 10000; // Random delay 0-10 seconds
      }
      
      // Calculate time since last scrape
      const lastScraped = new Date(account.lastScraped);
      const now = new Date();
      const elapsed = now - lastScraped;
      
      // Calculate delay
      let delay = priorityInterval - elapsed;
      
      // If delay is negative, schedule immediately with a small random delay
      if (delay <= 0) {
        delay = Math.random() * 10000; // Random delay 0-10 seconds
      }
      
      // Ensure minimum interval
      return Math.max(delay, Math.random() * this.config.minInterval * 0.1); // Random small delay
    } catch (error) {
      this.log.error('Error calculating next run delay', { error, accountId: account.id });
      // Default to a reasonable delay on error
      return 15 * 60 * 1000; // 15 minutes
    }
  }
  
  /**
   * Add an account to the scraping queue
   */
  addToQueue(account) {
    try {
      // Check if account is already in queue
      const inQueue = this.queue.some(item => item.id === account.id);
      
      // Check if account is already running
      const isRunning = this.running.has(account.id);
      
      if (inQueue || isRunning) {
        this.log.debug(`Account ${account.username} (${account.id}) is already queued or running`);
        return;
      }
      
      // Add to queue with timestamp
      this.queue.push({
        ...account,
        queuedAt: new Date().toISOString()
      });
      
      this.log.info(`Added account ${account.username} (${account.id}) to queue`, { 
        queueSize: this.queue.length, 
        running: this.running.size 
      });
      
      // Trigger queue processing
      this.processQueue();
    } catch (error) {
      this.log.error('Error adding account to queue', { error, accountId: account.id });
    }
  }
  
  /**
   * Process the scraping queue
   */
  async processQueue() {
    try {
      // If not running or queue is empty, do nothing
      if (!this.isRunning || this.queue.length === 0) {
        return;
      }
      
      // Check if we can start more jobs
      const canStart = this.running.size < this.config.maxConcurrent;
      
      if (!canStart) {
        this.log.debug('Max concurrent jobs running, waiting for completion', { 
          running: this.running.size,
          maxConcurrent: this.config.maxConcurrent,
          queueSize: this.queue.length
        });
        return;
      }
      
      // Sort queue by priority (lower number = higher priority)
      this.queue.sort((a, b) => a.priority - b.priority);
      
      // Get next account from queue
      const account = this.queue.shift();
      
      // Add to running set
      this.running.set(account.id, {
        account,
        startedAt: new Date().toISOString()
      });
      
      this.log.info(`Starting scrape for ${account.username} (${account.id})`, { 
        queueSize: this.queue.length, 
        running: this.running.size
      });
      
      // Start the scrape job
      this.scrapeAccount(account)
        .catch(error => {
          this.log.error('Error in scrape job', { error, accountId: account.id });
        })
        .finally(() => {
          // Remove from running map
          this.running.delete(account.id);
          
          // Schedule next run
          this.scheduleAccount(account);
          
          // Continue processing queue
          this.processQueue();
        });
    } catch (error) {
      this.log.error('Error processing queue', { error });
      // Continue processing queue after a short delay
      setTimeout(() => this.processQueue(), 5000);
    }
  }
  
  /**
   * Scrape an account
   */
  async scrapeAccount(account) {
    if (!account || !account.id) {
      this.log.error('Invalid account object for scraping');
      return false;
    }
    
    if (!this.scraper || !this.metricsCollector) {
      this.log.error('Scraper or metrics collector not available');
      return false;
    }
    
    const start = Date.now();
    
    try {
      this.log.info(`Starting to scrape account: ${account.username} (${account.id})`);
      
      // Scrape profile data
      const scrapeResult = await this.scraper.scrapeUserProfile(account.username);
      
      if (!scrapeResult || !scrapeResult.success) {
        throw new Error(scrapeResult?.error || 'Unknown scraping error');
      }
      
      // Get profile metrics from the scraped data
      const metrics = {
        followers: scrapeResult.data.followers,
        following: scrapeResult.data.following,
        tweets: scrapeResult.data.tweets,
        engagement: {
          avgLikes: scrapeResult.data.avgLikes || 0,
          avgRetweets: scrapeResult.data.avgRetweets || 0,
          avgReplies: scrapeResult.data.avgReplies || 0,
          avgViews: scrapeResult.data.avgViews || 0
        },
        profileUrl: scrapeResult.data.profileUrl,
        verified: scrapeResult.data.verified,
        protected: scrapeResult.data.protected,
        lastTweetDate: scrapeResult.data.lastTweetDate
      };
      
      // Save metrics to the database
      const metricsResult = await this.metricsCollector.saveMetrics(account.id, metrics);
      
      // Update account info
      await this.accountManager.updateAccount(account.id, {
        name: scrapeResult.data.displayName,
        profileImageUrl: scrapeResult.data.profileImageUrl,
        bio: scrapeResult.data.bio,
        lastScraped: new Date().toISOString()
      });
      
      // Report success
      await this.accountManager.updateLastScraped(account.id, true);
      
      const duration = Date.now() - start;
      
      this.log.info(`Completed scraping ${account.username} in ${duration}ms`, {
        accountId: account.id,
        metricsId: metricsResult.id,
        duration
      });
      
      return {
        success: true,
        accountId: account.id,
        metricsId: metricsResult.id,
        duration,
        metrics
      };
    } catch (error) {
      const duration = Date.now() - start;
      
      this.log.error(`Error scraping account ${account.username}`, {
        accountId: account.id,
        error: error.message,
        stack: error.stack,
        duration
      });
      
      // Report failure
      await this.accountManager.updateLastScraped(account.id, false, error.message);
      
      return {
        success: false,
        accountId: account.id,
        error: error.message,
        duration
      };
    }
  }
  
  /**
   * Get the current queue status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      queueSize: this.queue.length,
      running: Array.from(this.running.values()).map(item => ({
        accountId: item.account.id,
        username: item.account.username,
        startedAt: item.startedAt,
        runtime: new Date() - new Date(item.startedAt)
      })),
      scheduledCount: this.timers.size,
      maxConcurrent: this.config.maxConcurrent
    };
  }
  
  /**
   * Add an account to the front of the queue (manual request)
   */
  async prioritizeScrape(accountId) {
    try {
      // Get the account
      const account = await this.accountManager.getAccount(accountId);
      
      if (!account) {
        this.log.warn('Account not found for prioritized scrape', { accountId });
        throw new Error('Account not found');
      }
      
      // Check if already running
      if (this.running.has(accountId)) {
        this.log.info('Account is already being scraped', { accountId });
        return {
          success: true,
          message: 'Account is already being scraped',
          status: 'running'
        };
      }
      
      // Remove from queue if already queued
      const existingIndex = this.queue.findIndex(item => item.id === accountId);
      
      if (existingIndex >= 0) {
        this.queue.splice(existingIndex, 1);
      }
      
      // Cancel any existing timer
      if (this.timers.has(accountId)) {
        clearTimeout(this.timers.get(accountId));
        this.timers.delete(accountId);
      }
      
      // Add to front of queue with timestamp
      this.queue.unshift({
        ...account,
        queuedAt: new Date().toISOString()
      });
      
      this.log.info(`Prioritized account ${account.username} (${accountId}) for immediate scraping`, { 
        queueSize: this.queue.length, 
        running: this.running.size 
      });
      
      // Trigger queue processing
      this.processQueue();
      
      return {
        success: true,
        message: 'Account prioritized for immediate scraping',
        status: 'queued',
        position: 1
      };
    } catch (error) {
      this.log.error('Error prioritizing account for scraping', { error, accountId });
      throw error;
    }
  }
}

module.exports = { PriorityScheduler }; 