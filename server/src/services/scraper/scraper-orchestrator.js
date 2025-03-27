const { logger } = require('../../utils/logger');
const { AccountManager } = require('./account-manager');
const { MetricsCollector } = require('./metrics-collector');
const { PriorityScheduler } = require('./priority-scheduler');
const { AlertManager } = require('./alert-manager');
const { XScraper } = require('./x-scraper');
const { ProxyManager } = require('./proxy-manager');

/**
 * Orchestrates the X account scraping system
 */
class ScraperOrchestrator {
  /**
   * Initialize the orchestrator
   */
  constructor(config = {}) {
    this.log = logger.child({ module: 'ScraperOrchestrator' });
    
    // Configuration with defaults
    this.config = {
      maxConcurrentWorkers: parseInt(process.env.MAX_CONCURRENT_WORKERS || '2', 10),
      maxBrowsers: parseInt(process.env.MAX_BROWSERS || '2', 10),
      alertsEnabled: process.env.ALERTS_ENABLED !== 'false',
      useProxies: process.env.USE_PROXIES !== 'false',
      minProxies: parseInt(process.env.MIN_PROXIES || '20', 10),
      ...config
    };
    
    // Initialize service components
    this.accountManager = new AccountManager({ 
      storageType: process.env.ACCOUNT_STORAGE_TYPE || 'memory'
    });
    
    this.metricsCollector = new MetricsCollector({ 
      storageType: process.env.METRICS_STORAGE_TYPE || 'memory'
    });
    
    this.alertManager = new AlertManager({ 
      storageType: process.env.ALERTS_STORAGE_TYPE || 'memory'
    });

    // Initialize proxy manager if enabled
    if (this.config.useProxies) {
      this.proxyManager = new ProxyManager({
        minProxies: this.config.minProxies,
        healthCheckInterval: parseInt(process.env.PROXY_HEALTH_CHECK_INTERVAL || '300000', 10), // 5 minutes
        proxyProviderUrls: process.env.PROXY_PROVIDER_URLS ? 
          process.env.PROXY_PROVIDER_URLS.split(',') : [],
        proxyProviderApiKeys: process.env.PROXY_PROVIDER_API_KEYS ? 
          JSON.parse(process.env.PROXY_PROVIDER_API_KEYS) : {}
      });
    }
    
    this.scraper = new XScraper({
      maxConcurrentBrowsers: this.config.maxBrowsers,
      navigationTimeout: 30000, // 30 seconds
      baseUrl: 'https://twitter.com',
      useProxies: this.config.useProxies,
      proxyManager: this.proxyManager
    });
    
    this.scheduler = new PriorityScheduler({
      maxConcurrent: this.config.maxConcurrentWorkers,
      minInterval: 60 * 60 * 1000 // 1 hour
    });
    
    this.isInitialized = false;
    this.isRunning = false;
    
    this.log.info('Scraper orchestrator created', { 
      maxConcurrentWorkers: this.config.maxConcurrentWorkers,
      maxBrowsers: this.config.maxBrowsers,
      alertsEnabled: this.config.alertsEnabled,
      useProxies: this.config.useProxies,
      minProxies: this.config.minProxies
    });
  }
  
  /**
   * Initialize all components of the scraper system
   */
  async initialize() {
    if (this.isInitialized) {
      this.log.warn('Scraper orchestrator already initialized');
      return;
    }
    
    try {
      this.log.info('Initializing scraper orchestrator');
      
      // Initialize account manager
      await this.accountManager.initialize();
      this.log.info('Account manager initialized');
      
      // Initialize metrics collector
      await this.metricsCollector.initialize();
      this.log.info('Metrics collector initialized');
      
      // Initialize alert manager if enabled
      if (this.config.alertsEnabled) {
        // Pass metrics collector to alert manager for event handling
        await this.alertManager.initialize(this.metricsCollector);
        this.log.info('Alert manager initialized and connected to metrics collector');
      }

      // Initialize proxy manager if enabled
      if (this.config.useProxies && this.proxyManager) {
        await this.proxyManager.initialize();
        this.log.info('Proxy manager initialized');
      }
      
      // Initialize scraper
      await this.scraper.initialize();
      this.log.info('Scraper initialized');
      
      // Set up scheduler
      this.scheduler.setup({
        accountManager: this.accountManager,
        metricsCollector: this.metricsCollector,
        scraper: this.scraper
      });
      this.log.info('Scheduler setup complete');
      
      this.isInitialized = true;
      this.log.info('Scraper orchestrator initialized successfully');
      
      return true;
    } catch (error) {
      this.log.error('Failed to initialize scraper orchestrator', { error });
      throw error;
    }
  }
  
  /**
   * Start the scraper system
   */
  async start() {
    if (this.isRunning) {
      this.log.warn('Scraper orchestrator already running');
      return;
    }
    
    try {
      // Initialize if not already initialized
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      this.log.info('Starting scraper orchestrator');
      
      // Start the scheduler
      this.scheduler.start();
      
      this.isRunning = true;
      this.log.info('Scraper orchestrator started successfully');
      
      return true;
    } catch (error) {
      this.log.error('Failed to start scraper orchestrator', { error });
      throw error;
    }
  }
  
  /**
   * Stop the scraper system
   */
  async stop() {
    if (!this.isRunning) {
      this.log.warn('Scraper orchestrator not running');
      return;
    }
    
    try {
      this.log.info('Stopping scraper orchestrator');
      
      // Stop the scheduler
      this.scheduler.stop();
      
      // Close the scraper
      await this.scraper.close();
      
      this.isRunning = false;
      this.log.info('Scraper orchestrator stopped successfully');
      
      return true;
    } catch (error) {
      this.log.error('Error stopping scraper orchestrator', { error });
      throw error;
    }
  }
  
  /**
   * Get status of all components
   */
  getStatus() {
    const schedulerStatus = this.scheduler.getStatus();
    
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      accountCount: this.accountManager ? Object.keys(this.accountManager.accounts).length : 0,
      scheduler: schedulerStatus,
      scraper: {
        browsersRunning: this.scraper ? this.scraper.browsersRunning : 0,
        maxBrowsers: this.config.maxBrowsers
      },
      proxyManager: this.proxyManager ? this.proxyManager.getStatus() : null,
      lastUpdated: new Date().toISOString()
    };
  }
  
  /**
   * Manually trigger a scrape for an account
   */
  async scrapeAccount(accountId) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      // Prioritize the account for immediate scraping
      return this.scheduler.prioritizeScrape(accountId);
    } catch (error) {
      this.log.error('Error manually scraping account', { error, accountId });
      throw error;
    }
  }
  
  /**
   * Process metrics against alerts
   */
  async processAlerts() {
    if (!this.isInitialized || !this.config.alertsEnabled) {
      await this.initialize();
    }
    
    try {
      this.log.info('Processing metrics against alerts');
      
      // Get latest metrics for all accounts
      const latestMetrics = await this.metricsCollector.getLatestMetrics();
      
      if (!latestMetrics || latestMetrics.length === 0) {
        this.log.info('No metrics available for alert processing');
        return { processed: 0, triggered: 0 };
      }
      
      // Process metrics against alerts
      const triggeredAlerts = await this.alertManager.processMetrics(latestMetrics);
      
      this.log.info('Alert processing complete', { 
        processedMetrics: latestMetrics.length,
        triggeredAlerts: triggeredAlerts.length
      });
      
      return {
        processed: latestMetrics.length,
        triggered: triggeredAlerts.length,
        alerts: triggeredAlerts
      };
    } catch (error) {
      this.log.error('Error processing alerts', { error });
      throw error;
    }
  }
}

module.exports = { ScraperOrchestrator }; 