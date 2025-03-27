const { logger } = require('../../utils/logger');
const { EventEmitter } = require('events');
const { default: PQueue } = require('p-queue');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

/**
 * Manages a pool of proxies for the scraper
 */
class ProxyManager extends EventEmitter {
  /**
   * Initialize the proxy manager
   */
  constructor(config = {}) {
    super();
    this.log = logger.child({ module: 'ProxyManager' });
    
    // Configuration with defaults
    this.config = {
      minProxies: config.minProxies || 20,
      healthCheckInterval: config.healthCheckInterval || 5 * 60 * 1000, // 5 minutes
      healthCheckTimeout: config.healthCheckTimeout || 10000, // 10 seconds
      healthCheckUrl: config.healthCheckUrl || 'https://twitter.com',
      maxUsagePerProxy: config.maxUsagePerProxy || 100, // Max requests per proxy before rotation
      coolingPeriod: config.coolingPeriod || 10 * 60 * 1000, // 10 minutes of rest after max usage
      proxyFilePath: config.proxyFilePath || path.join(process.cwd(), 'data', 'proxies.json'),
      proxyProviderUrls: config.proxyProviderUrls || [],
      proxyProviderApiKeys: config.proxyProviderApiKeys || {},
      minRequestInterval: config.minRequestInterval || 3000, // Minimum 3 seconds between requests per IP
      maxRequestInterval: config.maxRequestInterval || 5000, // Maximum 5 seconds between requests per IP
      ...config
    };
    
    // State
    this.proxies = new Map(); // Map of proxy info by ID
    this.availableProxies = new Set(); // Set of available proxy IDs
    this.coolingProxies = new Map(); // Map of cooling proxy IDs to timeout IDs
    this.proxyUsage = new Map(); // Map of proxy IDs to usage count
    this.lastUsedTime = new Map(); // Map of proxy IDs to last used timestamp
    
    // Request queues per proxy
    this.proxyQueues = new Map(); // Map of proxy IDs to PQueue instances
    
    // Health check timer
    this.healthCheckTimer = null;
    
    // Metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      proxyRotations: 0,
      proxiesAdded: 0,
      proxiesRemoved: 0,
      healthChecks: 0,
      healthChecksFailed: 0
    };
    
    this.isInitialized = false;
    
    this.log.info('Proxy manager created', { 
      minProxies: this.config.minProxies,
      healthCheckInterval: this.config.healthCheckInterval
    });
  }
  
  /**
   * Initialize the proxy manager
   */
  async initialize() {
    if (this.isInitialized) {
      this.log.warn('Proxy manager already initialized');
      return true;
    }
    
    try {
      this.log.info('Initializing proxy manager');
      
      // Load proxies from file
      await this.loadProxies();
      
      // If not enough proxies, try to fetch from providers
      if (this.proxies.size < this.config.minProxies) {
        await this.fetchProxiesFromProviders();
      }
      
      // If still not enough proxies, log warning
      if (this.proxies.size < this.config.minProxies) {
        this.log.warn(`Not enough proxies available. Required: ${this.config.minProxies}, Available: ${this.proxies.size}`);
      } else {
        this.log.info(`Loaded ${this.proxies.size} proxies`);
      }
      
      // Initialize queues for each proxy
      for (const proxyId of this.proxies.keys()) {
        this.initializeProxyQueue(proxyId);
      }
      
      // Start health checks
      this.startHealthChecks();
      
      this.isInitialized = true;
      this.log.info('Proxy manager initialized successfully');
      
      return true;
    } catch (error) {
      this.log.error('Failed to initialize proxy manager', { error });
      throw error;
    }
  }
  
  /**
   * Initialize a queue for a proxy
   */
  initializeProxyQueue(proxyId) {
    if (this.proxyQueues.has(proxyId)) {
      return this.proxyQueues.get(proxyId);
    }
    
    // Create a new queue with concurrency of 1 to ensure sequential requests
    const queue = new PQueue({ concurrency: 1 });
    this.proxyQueues.set(proxyId, queue);
    
    return queue;
  }
  
  /**
   * Load proxies from file
   */
  async loadProxies() {
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(this.config.proxyFilePath);
      await fs.mkdir(dir, { recursive: true });
      
      // Check if the file exists
      try {
        await fs.access(this.config.proxyFilePath);
      } catch (err) {
        // Create empty proxies file if it doesn't exist
        await fs.writeFile(this.config.proxyFilePath, JSON.stringify({
          proxies: [],
          lastUpdated: new Date().toISOString()
        }, null, 2));
        return;
      }
      
      // Read and parse the file
      const data = await fs.readFile(this.config.proxyFilePath, 'utf8');
      const proxyData = JSON.parse(data);
      
      if (!proxyData.proxies || !Array.isArray(proxyData.proxies)) {
        this.log.warn('Invalid proxy file format, expected { proxies: [] }');
        return;
      }
      
      // Clear existing proxies
      this.proxies.clear();
      this.availableProxies.clear();
      
      // Add each proxy to the pool
      for (const proxy of proxyData.proxies) {
        if (this.isValidProxy(proxy)) {
          const proxyId = this.generateProxyId(proxy);
          this.proxies.set(proxyId, { ...proxy, id: proxyId });
          this.availableProxies.add(proxyId);
          this.proxyUsage.set(proxyId, 0);
        } else {
          this.log.warn('Skipping invalid proxy', { proxy });
        }
      }
      
      this.log.info(`Loaded ${this.proxies.size} proxies from file`);
    } catch (error) {
      this.log.error('Error loading proxies from file', { error });
      // Continue with empty proxy list if file loading fails
    }
  }
  
  /**
   * Save proxies to file
   */
  async saveProxies() {
    try {
      const proxyArray = [...this.proxies.values()];
      
      const proxyData = {
        proxies: proxyArray,
        lastUpdated: new Date().toISOString()
      };
      
      await fs.writeFile(
        this.config.proxyFilePath, 
        JSON.stringify(proxyData, null, 2),
        'utf8'
      );
      
      this.log.info(`Saved ${proxyArray.length} proxies to file`);
      return true;
    } catch (error) {
      this.log.error('Error saving proxies to file', { error });
      return false;
    }
  }
  
  /**
   * Fetch proxies from configured providers
   */
  async fetchProxiesFromProviders() {
    if (!this.config.proxyProviderUrls || this.config.proxyProviderUrls.length === 0) {
      this.log.warn('No proxy providers configured');
      return;
    }
    
    this.log.info(`Fetching proxies from ${this.config.proxyProviderUrls.length} providers`);
    
    for (const providerUrl of this.config.proxyProviderUrls) {
      try {
        const response = await axios.get(providerUrl, {
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (response.status === 200 && response.data) {
          const newProxies = this.parseProxyResponse(response.data, providerUrl);
          this.log.info(`Fetched ${newProxies.length} proxies from provider`);
          
          // Add new proxies to pool
          for (const proxy of newProxies) {
            await this.addProxy(proxy);
          }
        } else {
          this.log.warn('Failed to fetch proxies from provider', { 
            url: providerUrl,
            status: response.status
          });
        }
      } catch (error) {
        this.log.error('Error fetching proxies from provider', { 
          url: providerUrl, 
          error 
        });
      }
    }
  }
  
  /**
   * Parse proxy response from provider
   */
  parseProxyResponse(data, providerUrl) {
    try {
      // This method should be customized based on the format of your proxy providers
      // Below is a generic implementation that tries to handle common formats
      
      let proxies = [];
      
      if (typeof data === 'string') {
        // Handle line-separated list like "ip:port:user:pass" or "ip:port"
        const lines = data.split('\n').filter(line => line.trim().length > 0);
        
        for (const line of lines) {
          const parts = line.trim().split(':');
          if (parts.length >= 2) {
            const host = parts[0];
            const port = parts[1];
            
            let proxy = {
              host,
              port: parseInt(port, 10),
              protocol: 'http'
            };
            
            // If credentials are provided
            if (parts.length >= 4) {
              proxy.auth = {
                username: parts[2],
                password: parts[3]
              };
            }
            
            proxies.push(proxy);
          }
        }
      } else if (Array.isArray(data)) {
        // Handle array of objects
        for (const item of data) {
          if (typeof item === 'object' && item !== null) {
            // Try to extract proxy details based on common field names
            const host = item.ip || item.host || item.address;
            const port = item.port;
            
            if (host && port) {
              let proxy = {
                host,
                port: parseInt(port, 10),
                protocol: item.protocol || item.type || 'http'
              };
              
              // If credentials are provided
              if (item.username && item.password) {
                proxy.auth = {
                  username: item.username,
                  password: item.password
                };
              }
              
              proxies.push(proxy);
            }
          }
        }
      } else if (typeof data === 'object' && data !== null) {
        // Handle object with proxy list inside
        const possibleArrayKeys = ['data', 'proxies', 'list', 'items', 'results'];
        
        for (const key of possibleArrayKeys) {
          if (Array.isArray(data[key])) {
            return this.parseProxyResponse(data[key], providerUrl);
          }
        }
      }
      
      return proxies;
    } catch (error) {
      this.log.error('Error parsing proxy response', { error, providerUrl });
      return [];
    }
  }
  
  /**
   * Start health check interval
   */
  startHealthChecks() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    this.healthCheckTimer = setInterval(() => {
      this.runHealthChecks();
    }, this.config.healthCheckInterval);
    
    // Run an immediate health check
    this.runHealthChecks();
  }
  
  /**
   * Run health checks on all proxies
   */
  async runHealthChecks() {
    if (this.proxies.size === 0) {
      this.log.warn('No proxies to health check');
      return;
    }
    
    this.log.info(`Running health checks on ${this.proxies.size} proxies`);
    this.metrics.healthChecks++;
    
    const checkPromises = [];
    
    for (const [proxyId, proxy] of this.proxies.entries()) {
      checkPromises.push(this.checkProxyHealth(proxyId, proxy));
    }
    
    try {
      const results = await Promise.allSettled(checkPromises);
      
      let healthyCount = 0;
      let unhealthyCount = 0;
      
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          healthyCount++;
        } else {
          unhealthyCount++;
        }
      }
      
      if (unhealthyCount > 0) {
        this.metrics.healthChecksFailed += unhealthyCount;
      }
      
      this.log.info(`Health check complete. Healthy: ${healthyCount}, Unhealthy: ${unhealthyCount}`);
      
      // Save the updated proxy list
      await this.saveProxies();
      
      // If we're running low on proxies, try to fetch more
      if (this.availableProxies.size < this.config.minProxies / 2) {
        this.log.warn(`Running low on available proxies (${this.availableProxies.size}). Attempting to fetch more.`);
        await this.fetchProxiesFromProviders();
      }
    } catch (error) {
      this.log.error('Error running health checks', { error });
    }
  }
  
  /**
   * Check health of a single proxy
   */
  async checkProxyHealth(proxyId, proxy) {
    try {
      const axiosConfig = {
        timeout: this.config.healthCheckTimeout,
        proxy: this.createAxiosProxyConfig(proxy)
      };
      
      const start = Date.now();
      
      const response = await axios.get(this.config.healthCheckUrl, axiosConfig);
      
      const elapsed = Date.now() - start;
      
      if (response.status === 200) {
        this.log.debug(`Proxy ${proxyId} is healthy (${elapsed}ms)`);
        
        // Update proxy with health information
        proxy.lastCheck = new Date().toISOString();
        proxy.healthy = true;
        proxy.responseTime = elapsed;
        
        // Add to available proxies if not already there
        if (!this.availableProxies.has(proxyId)) {
          this.availableProxies.add(proxyId);
        }
        
        return true;
      } else {
        this.log.warn(`Proxy ${proxyId} returned non-200 status: ${response.status}`);
        
        // Update proxy with health information
        proxy.lastCheck = new Date().toISOString();
        proxy.healthy = false;
        proxy.responseTime = elapsed;
        proxy.lastError = `HTTP ${response.status}`;
        
        // Remove from available proxies
        this.availableProxies.delete(proxyId);
        
        return false;
      }
    } catch (error) {
      this.log.warn(`Proxy ${proxyId} health check failed`, { error: error.message });
      
      // Update proxy with health information
      proxy.lastCheck = new Date().toISOString();
      proxy.healthy = false;
      proxy.lastError = error.message;
      
      // Remove from available proxies
      this.availableProxies.delete(proxyId);
      
      return false;
    }
  }
  
  /**
   * Get a proxy for a request
   */
  async getProxy() {
    if (!this.isInitialized) {
      throw new Error('Proxy manager not initialized');
    }
    
    if (this.availableProxies.size === 0) {
      this.log.warn('No available proxies, running emergency health check');
      await this.runHealthChecks();
      
      if (this.availableProxies.size === 0) {
        throw new Error('No available proxies after health check');
      }
    }
    
    // Convert set to array for random selection
    const availableProxyIds = [...this.availableProxies];
    
    // Sort by least recently used and least used
    availableProxyIds.sort((a, b) => {
      const lastUsedTimeA = this.lastUsedTime.get(a) || 0;
      const lastUsedTimeB = this.lastUsedTime.get(b) || 0;
      
      const usageA = this.proxyUsage.get(a) || 0;
      const usageB = this.proxyUsage.get(b) || 0;
      
      // First prioritize by usage
      if (usageA !== usageB) {
        return usageA - usageB;
      }
      
      // Then by last used time
      return lastUsedTimeA - lastUsedTimeB;
    });
    
    // Get the best proxy
    const proxyId = availableProxyIds[0];
    const proxy = this.proxies.get(proxyId);
    
    if (!proxy) {
      this.log.error(`Proxy ${proxyId} not found despite being in available list`);
      this.availableProxies.delete(proxyId);
      return this.getProxy(); // Try again
    }
    
    // Update usage metrics
    const currentUsage = this.proxyUsage.get(proxyId) || 0;
    this.proxyUsage.set(proxyId, currentUsage + 1);
    this.lastUsedTime.set(proxyId, Date.now());
    
    // Check if proxy should be cooled down after this usage
    if (currentUsage + 1 >= this.config.maxUsagePerProxy) {
      this.log.info(`Proxy ${proxyId} reached max usage, cooling down`);
      this.coolDownProxy(proxyId);
      this.metrics.proxyRotations++;
    }
    
    return { proxyId, proxy };
  }
  
  /**
   * Execute a function using a proxy with appropriate throttling
   */
  async withProxy(fn) {
    if (!this.isInitialized) {
      throw new Error('Proxy manager not initialized');
    }
    
    const { proxyId, proxy } = await this.getProxy();
    const queue = this.proxyQueues.get(proxyId) || this.initializeProxyQueue(proxyId);
    
    // Add the request to the queue for this proxy
    return queue.add(async () => {
      this.metrics.totalRequests++;
      
      try {
        // Generate a random delay between min and max interval
        const delay = Math.random() * (this.config.maxRequestInterval - this.config.minRequestInterval) + this.config.minRequestInterval;
        
        // Wait for the delay before executing
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Execute the function with the proxy
        const result = await fn(proxy);
        
        this.metrics.successfulRequests++;
        return result;
      } catch (error) {
        this.metrics.failedRequests++;
        
        // If error is proxy-related, mark it as unhealthy
        if (this.isProxyError(error)) {
          this.log.warn(`Proxy ${proxyId} failed`, { error: error.message });
          await this.markProxyUnhealthy(proxyId, error.message);
        }
        
        throw error;
      }
    });
  }
  
  /**
   * Mark a proxy as unhealthy
   */
  async markProxyUnhealthy(proxyId, errorMessage) {
    const proxy = this.proxies.get(proxyId);
    
    if (!proxy) {
      return;
    }
    
    this.log.warn(`Marking proxy ${proxyId} as unhealthy: ${errorMessage}`);
    
    // Update proxy health info
    proxy.healthy = false;
    proxy.lastCheck = new Date().toISOString();
    proxy.lastError = errorMessage;
    
    // Remove from available proxies
    this.availableProxies.delete(proxyId);
    
    // Emit event
    this.emit('proxyUnhealthy', { proxyId, error: errorMessage });
    
    // Trigger a health check on this proxy after a delay
    setTimeout(() => {
      this.checkProxyHealth(proxyId, proxy);
    }, 60 * 1000); // Check again in 1 minute
  }
  
  /**
   * Cool down a proxy after it's been used too much
   */
  coolDownProxy(proxyId) {
    // Remove proxy from available pool
    this.availableProxies.delete(proxyId);
    
    // Reset usage counter
    this.proxyUsage.set(proxyId, 0);
    
    // Set timer to add it back after cooling period
    const timerId = setTimeout(() => {
      const proxy = this.proxies.get(proxyId);
      
      if (proxy && proxy.healthy) {
        this.log.info(`Proxy ${proxyId} cooled down, adding back to available pool`);
        this.availableProxies.add(proxyId);
      } else {
        this.log.info(`Proxy ${proxyId} cooled down but unhealthy, running health check`);
        this.checkProxyHealth(proxyId, proxy);
      }
      
      this.coolingProxies.delete(proxyId);
    }, this.config.coolingPeriod);
    
    // Store timer ID for cleanup
    this.coolingProxies.set(proxyId, timerId);
  }
  
  /**
   * Add a new proxy to the pool
   */
  async addProxy(proxyConfig) {
    if (!this.isValidProxy(proxyConfig)) {
      this.log.warn('Invalid proxy configuration', { proxyConfig });
      return false;
    }
    
    const proxyId = this.generateProxyId(proxyConfig);
    
    // Skip if already exists
    if (this.proxies.has(proxyId)) {
      this.log.debug(`Proxy ${proxyId} already exists, skipping`);
      return false;
    }
    
    const proxy = {
      ...proxyConfig,
      id: proxyId,
      added: new Date().toISOString(),
      healthy: false,
      lastCheck: null
    };
    
    this.proxies.set(proxyId, proxy);
    this.proxyUsage.set(proxyId, 0);
    this.initializeProxyQueue(proxyId);
    
    this.log.info(`Added new proxy ${proxyId}`);
    this.metrics.proxiesAdded++;
    
    // Check health before making available
    const isHealthy = await this.checkProxyHealth(proxyId, proxy);
    
    if (isHealthy) {
      this.availableProxies.add(proxyId);
    }
    
    // Save proxies to file
    await this.saveProxies();
    
    return isHealthy;
  }
  
  /**
   * Remove a proxy from the pool
   */
  async removeProxy(proxyId) {
    if (!this.proxies.has(proxyId)) {
      return false;
    }
    
    this.log.info(`Removing proxy ${proxyId}`);
    
    // Remove from all collections
    this.proxies.delete(proxyId);
    this.availableProxies.delete(proxyId);
    this.proxyUsage.delete(proxyId);
    this.lastUsedTime.delete(proxyId);
    
    // Clear any cooling timer
    if (this.coolingProxies.has(proxyId)) {
      clearTimeout(this.coolingProxies.get(proxyId));
      this.coolingProxies.delete(proxyId);
    }
    
    // Clean up queue
    if (this.proxyQueues.has(proxyId)) {
      this.proxyQueues.get(proxyId).clear();
      this.proxyQueues.delete(proxyId);
    }
    
    this.metrics.proxiesRemoved++;
    
    // Save updated proxy list
    await this.saveProxies();
    
    return true;
  }
  
  /**
   * Generate a unique ID for a proxy
   */
  generateProxyId(proxyConfig) {
    const { host, port, auth } = proxyConfig;
    
    if (auth && auth.username) {
      return `${host}:${port}:${auth.username}`;
    }
    
    return `${host}:${port}`;
  }
  
  /**
   * Check if a proxy configuration is valid
   */
  isValidProxy(proxyConfig) {
    if (!proxyConfig || typeof proxyConfig !== 'object') {
      return false;
    }
    
    // Must have host and port
    if (!proxyConfig.host || !proxyConfig.port) {
      return false;
    }
    
    // Port must be a number
    if (isNaN(parseInt(proxyConfig.port, 10))) {
      return false;
    }
    
    // If auth is provided, it must have username and password
    if (proxyConfig.auth) {
      if (!proxyConfig.auth.username || !proxyConfig.auth.password) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Check if an error is likely proxy-related
   */
  isProxyError(error) {
    if (!error) {
      return false;
    }
    
    const errorMessage = error.message || '';
    
    // Common proxy error messages
    const proxyErrors = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'EHOSTUNREACH',
      'socket hang up',
      'proxy',
      'tunneling socket',
      'connection refused',
      'connect timed out',
      'proxy authentication required',
      '407', // Proxy Authentication Required
      '502', // Bad Gateway
      '503', // Service Unavailable
      '504', // Gateway Timeout
    ];
    
    return proxyErrors.some(msg => errorMessage.toLowerCase().includes(msg.toLowerCase()));
  }
  
  /**
   * Create a proxy config for axios
   */
  createAxiosProxyConfig(proxy) {
    const axiosProxy = {
      host: proxy.host,
      port: proxy.port,
      protocol: (proxy.protocol || 'http') + ':',
    };
    
    if (proxy.auth) {
      axiosProxy.auth = {
        username: proxy.auth.username,
        password: proxy.auth.password
      };
    }
    
    return axiosProxy;
  }
  
  /**
   * Stop the proxy manager
   */
  async stop() {
    this.log.info('Stopping proxy manager');
    
    // Clear health check timer
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    // Clear all cooling timers
    for (const timerId of this.coolingProxies.values()) {
      clearTimeout(timerId);
    }
    this.coolingProxies.clear();
    
    // Clear all queues
    for (const queue of this.proxyQueues.values()) {
      queue.clear();
    }
    
    // Save proxies before stopping
    await this.saveProxies();
    
    this.log.info('Proxy manager stopped');
    return true;
  }
  
  /**
   * Get status of the proxy manager
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      totalProxies: this.proxies.size,
      availableProxies: this.availableProxies.size,
      coolingProxies: this.coolingProxies.size,
      metrics: { ...this.metrics },
      healthCheckInterval: this.config.healthCheckInterval,
      lastUpdated: new Date().toISOString()
    };
  }
}

module.exports = { ProxyManager }; 