const puppeteer = require('puppeteer');
const { logger } = require('../../utils/logger');

class BrowserManager {
  constructor(config = {}) {
    this.config = {
      maxBrowsers: config.maxBrowsers || 2,
      launchOptions: config.launchOptions || {},
      ...config
    };
    
    this.log = logger.logger.child({ module: 'BrowserManager' });
    
    // Browser pool
    this.browsers = new Map(); // Map<browserId, { browser, inUse, createdAt }>
    this.lastBrowserId = 0;
  }
  
  async initialize() {
    this.log.info('Initializing browser manager');
    
    try {
      // Nothing to initialize for now
      this.log.info('Browser manager initialized successfully');
    } catch (error) {
      this.log.error('Failed to initialize browser manager', { error });
      throw error;
    }
  }
  
  async getBrowser() {
    try {
      // Find an available browser
      let browser = null;
      let browserId = null;
      
      // Check for an existing browser that's not in use
      for (const [id, browserInfo] of this.browsers.entries()) {
        if (!browserInfo.inUse) {
          browser = browserInfo.browser;
          browserId = id;
          break;
        }
      }
      
      if (!browser) {
        // Create a new browser if we're under the limit
        if (this.browsers.size < this.config.maxBrowsers) {
          const newBrowserId = ++this.lastBrowserId;
          
          this.log.debug('Launching new browser', { browserId: newBrowserId });
          
          const launchOptions = {
            headless: 'new',
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-accelerated-2d-canvas',
              '--disable-gpu',
              '--window-size=1920x1080'
            ],
            ...this.config.launchOptions
          };
          
          const newBrowser = await puppeteer.launch(launchOptions);
          
          // Setup browser close listener
          newBrowser.on('disconnected', () => {
            this.log.debug('Browser disconnected, removing from pool', { browserId: newBrowserId });
            this.browsers.delete(newBrowserId);
          });
          
          this.browsers.set(newBrowserId, {
            browser: newBrowser,
            inUse: true,
            createdAt: Date.now()
          });
          
          return newBrowser;
        } else {
          // Wait for a browser to become available
          this.log.warn('Maximum browser limit reached, waiting for one to become available');
          
          return new Promise((resolve) => {
            const checkInterval = setInterval(async () => {
              for (const [id, browserInfo] of this.browsers.entries()) {
                if (!browserInfo.inUse) {
                  clearInterval(checkInterval);
                  
                  // Mark browser as in use
                  browserInfo.inUse = true;
                  this.browsers.set(id, browserInfo);
                  
                  resolve(browserInfo.browser);
                  return;
                }
              }
              
              // If a browser was closed, we may have room for a new one
              if (this.browsers.size < this.config.maxBrowsers) {
                clearInterval(checkInterval);
                resolve(this.getBrowser());
              }
            }, 1000);
          });
        }
      } else {
        // Mark browser as in use
        this.browsers.set(browserId, {
          ...this.browsers.get(browserId),
          inUse: true
        });
        
        return browser;
      }
    } catch (error) {
      this.log.error('Error getting browser', { error });
      throw error;
    }
  }
  
  async releaseBrowser(browser) {
    try {
      // Find the browser in the pool
      for (const [id, browserInfo] of this.browsers.entries()) {
        if (browserInfo.browser === browser) {
          // Mark browser as not in use
          this.browsers.set(id, {
            ...browserInfo,
            inUse: false
          });
          
          this.log.debug('Browser released back to pool', { browserId: id });
          return true;
        }
      }
      
      this.log.warn('Attempted to release unknown browser');
      return false;
    } catch (error) {
      this.log.error('Error releasing browser', { error });
      throw error;
    }
  }
  
  async shutdown() {
    this.log.info(`Shutting down ${this.browsers.size} browsers`);
    
    const closePromises = [];
    
    for (const [id, browserInfo] of this.browsers.entries()) {
      try {
        this.log.debug('Closing browser', { browserId: id });
        closePromises.push(browserInfo.browser.close());
      } catch (error) {
        this.log.error('Error closing browser', { error, browserId: id });
      }
    }
    
    await Promise.all(closePromises);
    this.browsers.clear();
    
    this.log.info('All browsers closed');
  }
  
  async updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    };
    
    this.log.info('Browser manager config updated', { 
      maxBrowsers: this.config.maxBrowsers
    });
  }
  
  async createPage(browser, options = {}) {
    try {
      const page = await browser.newPage();
      
      // Set viewport
      await page.setViewport({
        width: options.width || 1920,
        height: options.height || 1080,
        deviceScaleFactor: 1
      });
      
      // Set user agent
      if (options.userAgent) {
        await page.setUserAgent(options.userAgent);
      }
      
      // Set extra HTTP headers
      if (options.headers) {
        await page.setExtraHTTPHeaders(options.headers);
      }
      
      // Set cookies
      if (options.cookies && Array.isArray(options.cookies)) {
        await page.setCookie(...options.cookies);
      }
      
      // Set request interception
      if (options.interceptRequests) {
        await page.setRequestInterception(true);
        
        page.on('request', (request) => {
          const resourceType = request.resourceType();
          
          // Block unnecessary resources to speed up scraping
          if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
            request.abort();
          } else {
            request.continue();
          }
        });
      }
      
      // Set timeout
      if (options.timeout) {
        page.setDefaultNavigationTimeout(options.timeout);
        page.setDefaultTimeout(options.timeout);
      }
      
      return page;
    } catch (error) {
      this.log.error('Error creating page', { error });
      throw error;
    }
  }
  
  getStats() {
    let inUseCount = 0;
    let availableCount = 0;
    
    for (const browserInfo of this.browsers.values()) {
      if (browserInfo.inUse) {
        inUseCount++;
      } else {
        availableCount++;
      }
    }
    
    return {
      total: this.browsers.size,
      inUse: inUseCount,
      available: availableCount,
      maxBrowsers: this.config.maxBrowsers
    };
  }
}

module.exports = { BrowserManager }; 