const puppeteer = require('puppeteer');
const { logger } = require('../../utils/logger');
const path = require('path');
const fs = require('fs').promises;

/**
 * Scrapes X (Twitter) accounts for metrics
 */
class XScraper {
  /**
   * Initialize the X scraper
   */
  constructor(config = {}) {
    this.log = logger.child({ module: 'XScraper' });
    
    // Configuration with defaults
    this.config = {
      baseUrl: config.baseUrl || 'https://twitter.com',
      navigationTimeout: config.navigationTimeout || 30000, // 30 seconds
      maxConcurrentBrowsers: config.maxConcurrentBrowsers || 2,
      screenshotPath: config.screenshotPath || path.join(process.cwd(), 'screenshots'),
      headless: config.headless !== false, // Default to headless
      ...config
    };
    
    // State
    this.browsers = new Map();
    this.isInitialized = false;
    
    this.log.info('X scraper created', { 
      baseUrl: this.config.baseUrl,
      maxConcurrentBrowsers: this.config.maxConcurrentBrowsers
    });
  }
  
  /**
   * Initialize the scraper
   */
  async initialize() {
    try {
      // Create screenshot directory if it doesn't exist
      await fs.mkdir(this.config.screenshotPath, { recursive: true });
      
      this.isInitialized = true;
      this.log.info('X scraper initialized successfully');
      
      return true;
    } catch (error) {
      this.log.error('Failed to initialize X scraper', { error });
      throw error;
    }
  }
  
  /**
   * Close all browser instances
   */
  async close() {
    try {
      const browserIds = [...this.browsers.keys()];
      
      if (browserIds.length === 0) {
        this.log.debug('No browsers to close');
        return true;
      }
      
      this.log.info(`Closing ${browserIds.length} browser instances`);
      
      for (const id of browserIds) {
        try {
          const browser = this.browsers.get(id);
          if (browser) {
            await browser.close();
            this.browsers.delete(id);
          }
        } catch (err) {
          this.log.error('Error closing browser', { err, browserId: id });
        }
      }
      
      this.log.info('All browsers closed');
      return true;
    } catch (error) {
      this.log.error('Error closing browsers', { error });
      throw error;
    }
  }
  
  /**
   * Get a browser instance
   */
  async getBrowser() {
    try {
      // Check if we can create more browsers
      if (this.browsers.size >= this.config.maxConcurrentBrowsers) {
        this.log.error('Maximum concurrent browser limit reached', {
          current: this.browsers.size,
          max: this.config.maxConcurrentBrowsers
        });
        throw new Error('Maximum concurrent browser limit reached');
      }
      
      // Launch new browser
      const browserId = `browser_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      this.log.debug('Launching new browser', { browserId });
      
      const browser = await puppeteer.launch({
        headless: this.config.headless ? 'new' : false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1280,1024'
        ]
      });
      
      // Store browser
      this.browsers.set(browserId, browser);
      
      // Add event handler for browser disconnection
      browser.on('disconnected', () => {
        this.log.info('Browser disconnected', { browserId });
        this.browsers.delete(browserId);
      });
      
      this.log.info('Browser launched', {
        browserId,
        currentBrowsers: this.browsers.size
      });
      
      return { browser, browserId };
    } catch (error) {
      this.log.error('Error launching browser', { error });
      throw error;
    }
  }
  
  /**
   * Scrape metrics for an X account
   */
  async scrapeAccount(account) {
    if (!account || !account.username) {
      this.log.error('Invalid account for scraping', { account });
      return {
        success: false,
        error: 'Invalid account: username is required'
      };
    }
    
    let browser;
    let browserId;
    let page;
    
    try {
      this.log.info(`Scraping account: ${account.username}`);
      
      // Get browser instance
      ({ browser, browserId } = await this.getBrowser());
      
      // Create page
      page = await browser.newPage();
      
      // Set user agent to avoid detection
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      );
      
      // Set viewport size
      await page.setViewport({ width: 1280, height: 1024 });
      
      // Set navigation timeout
      page.setDefaultNavigationTimeout(this.config.navigationTimeout);
      
      // Go to profile page
      const profileUrl = `${this.config.baseUrl}/${account.username}`;
      this.log.info(`Navigating to: ${profileUrl}`);
      
      // Navigate to the profile
      const response = await page.goto(profileUrl, {
        waitUntil: 'networkidle2'
      });
      
      // Check for errors
      if (!response || !response.ok()) {
        const statusCode = response ? response.status() : 'unknown';
        const error = `Failed to load profile page: ${statusCode}`;
        this.log.error(error, { url: profileUrl, statusCode });
        
        // Take screenshot of error
        await this.takeScreenshot(page, `${account.username}_error_${Date.now()}.png`);
        
        return {
          success: false,
          error
        };
      }
      
      // Check if we're on the correct page
      const url = page.url();
      if (!url.includes(account.username.toLowerCase())) {
        const error = 'Redirected to another page, account may not exist';
        this.log.error(error, { expectedUrl: profileUrl, actualUrl: url });
        
        // Take screenshot of error
        await this.takeScreenshot(page, `${account.username}_redirect_${Date.now()}.png`);
        
        return {
          success: false,
          error
        };
      }
      
      // Extract metrics
      this.log.info(`Extracting metrics for ${account.username}`);
      const metrics = await this.extractMetrics(page, account);
      
      // Take success screenshot if debugging
      if (process.env.NODE_ENV === 'development') {
        await this.takeScreenshot(page, `${account.username}_success_${Date.now()}.png`);
      }
      
      this.log.info(`Scraped ${account.username} successfully`, {
        metrics: Object.keys(metrics)
      });
      
      return {
        success: true,
        metrics
      };
    } catch (error) {
      this.log.error(`Error scraping account: ${account.username}`, { error });
      
      // Take screenshot of error
      if (page) {
        await this.takeScreenshot(page, `${account.username}_error_${Date.now()}.png`);
      }
      
      return {
        success: false,
        error: error.message || 'Unknown error during scraping'
      };
    } finally {
      // Close page
      if (page) {
        try {
          await page.close();
        } catch (err) {
          this.log.error('Error closing page', { error: err });
        }
      }
      
      // Remove browser from tracking (but don't close it yet for reuse)
      if (browserId && this.browsers.has(browserId)) {
        // Close browser if it's been open for more than 10 minutes (for cleanup)
        const browser = this.browsers.get(browserId);
        if (browser && browser._createdAt && Date.now() - browser._createdAt > 10 * 60 * 1000) {
          try {
            await browser.close();
            this.browsers.delete(browserId);
            this.log.debug('Closed browser after timeout', { browserId });
          } catch (err) {
            this.log.error('Error closing timed-out browser', { error: err, browserId });
          }
        }
      }
    }
  }
  
  /**
   * Take a screenshot during scraping
   */
  async takeScreenshot(page, filename) {
    try {
      if (!page) return;
      
      const filePath = path.join(this.config.screenshotPath, filename);
      await page.screenshot({ path: filePath, fullPage: true });
      this.log.debug(`Screenshot saved: ${filePath}`);
    } catch (error) {
      this.log.error('Error taking screenshot', { error, filename });
    }
  }
  
  /**
   * Extract metrics from an X profile page
   */
  async extractMetrics(page, account) {
    try {
      // Wait for the profile to load
      await page.waitForSelector('h1[role="heading"]', { timeout: 10000 });
      
      // Get basic user info
      const userInfo = await this.extractUserInfo(page);
      
      // Extract recent tweets and engagement metrics
      const tweets = await this.extractRecentTweets(page, 20); // Get up to 20 tweets
      
      // Calculate engagement metrics
      const engagement = this.calculateEngagementMetrics(tweets);
      
      // Return metrics
      return {
        followers: userInfo.followers,
        following: userInfo.following,
        tweets: userInfo.tweets,
        name: userInfo.name,
        description: userInfo.description,
        location: userInfo.location,
        url: userInfo.url,
        joinDate: userInfo.joinDate,
        verified: userInfo.verified,
        recentTweetCount: tweets.length,
        engagement,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.log.error('Error extracting metrics', { error, username: account.username });
      throw error;
    }
  }
  
  /**
   * Extract user info from profile page
   */
  async extractUserInfo(page) {
    try {
      // Get name and bio
      const name = await page.evaluate(() => {
        const nameEl = document.querySelector('h1[role="heading"]');
        return nameEl ? nameEl.textContent.trim() : null;
      });
      
      const description = await page.evaluate(() => {
        const bioEl = document.querySelector('[data-testid="UserDescription"]');
        return bioEl ? bioEl.textContent.trim() : null;
      });
      
      // Get location
      const location = await page.evaluate(() => {
        const locationEl = document.querySelector('[data-testid="UserLocation"]');
        return locationEl ? locationEl.textContent.trim() : null;
      });
      
      // Get URL
      const url = await page.evaluate(() => {
        const urlEl = document.querySelector('[data-testid="UserUrl"]');
        return urlEl ? urlEl.textContent.trim() : null;
      });
      
      // Get join date
      const joinDate = await page.evaluate(() => {
        const joinDateEl = document.querySelector('[data-testid="UserJoinDate"]');
        return joinDateEl ? joinDateEl.textContent.trim() : null;
      });
      
      // Get verified status
      const verified = await page.evaluate(() => {
        const verifiedBadge = document.querySelector('[data-testid="UserBadge"]');
        return !!verifiedBadge;
      });
      
      // Get follower, following, and tweet counts
      const statsCounts = await page.evaluate(() => {
        const statsElements = document.querySelectorAll('[data-testid="primaryColumn"] a[role="link"] span');
        const stats = { followers: 0, following: 0, tweets: 0 };
        
        for (const stat of statsElements) {
          const text = stat.textContent;
          if (text && text.match(/\d/)) {
            const parentText = stat.parentElement?.textContent || '';
            
            if (parentText.includes('Followers') || parentText.includes('Follower')) {
              stats.followers = XScraper.parseCount(text);
            } else if (parentText.includes('Following')) {
              stats.following = XScraper.parseCount(text);
            } else if (parentText.includes('posts') || parentText.includes('Posts')) {
              stats.tweets = XScraper.parseCount(text);
            }
          }
        }
        
        return stats;
      });
      
      return {
        name,
        description,
        location,
        url,
        joinDate,
        verified,
        followers: statsCounts.followers,
        following: statsCounts.following,
        tweets: statsCounts.tweets
      };
    } catch (error) {
      this.log.error('Error extracting user info', { error });
      return {
        followers: 0,
        following: 0,
        tweets: 0
      };
    }
  }
  
  /**
   * Extract recent tweets from profile page
   */
  async extractRecentTweets(page, count = 10) {
    try {
      // Wait for tweets to load
      await page.waitForSelector('[data-testid="cellInnerDiv"]', { timeout: 10000 });
      
      // Need to scroll to load more tweets
      const tweets = [];
      let previousTweetCount = -1;
      
      while (tweets.length < count && tweets.length !== previousTweetCount) {
        previousTweetCount = tweets.length;
        
        // Extract tweets currently visible
        const newTweets = await page.evaluate(() => {
          const tweetElements = document.querySelectorAll('[data-testid="cellInnerDiv"]');
          const extractedTweets = [];
          
          for (const tweet of tweetElements) {
            // Skip ads, suggested tweets, etc.
            if (tweet.textContent.includes('Promoted') || 
                tweet.querySelector('[data-testid="socialContext"]')) {
              continue;
            }
            
            // Get tweet text
            const tweetTextEl = tweet.querySelector('[data-testid="tweetText"]');
            const tweetText = tweetTextEl ? tweetTextEl.textContent.trim() : null;
            
            // Skip if not a primary tweet
            if (!tweetText) continue;
            
            // Get engagement metrics
            const statsElements = tweet.querySelectorAll('[data-testid$="count"]');
            const stats = { likes: 0, retweets: 0, replies: 0 };
            
            for (const stat of statsElements) {
              const countEl = stat.querySelector('[aria-hidden="true"]');
              const count = countEl ? countEl.textContent.trim() : '0';
              const testId = stat.getAttribute('data-testid');
              
              if (testId === 'like_count') {
                stats.likes = XScraper.parseCount(count);
              } else if (testId === 'retweet_count') {
                stats.retweets = XScraper.parseCount(count);
              } else if (testId === 'reply_count') {
                stats.replies = XScraper.parseCount(count);
              }
            }
            
            // Get timestamp
            const timestampEl = tweet.querySelector('time');
            const timestamp = timestampEl ? timestampEl.getAttribute('datetime') : null;
            
            // Get tweet URL
            const linkEl = tweet.querySelector('a[href*="/status/"]');
            const tweetUrl = linkEl ? linkEl.getAttribute('href') : null;
            
            // Get tweet ID from URL
            const tweetId = tweetUrl ? tweetUrl.split('/status/')[1] : null;
            
            extractedTweets.push({
              id: tweetId,
              text: tweetText,
              url: tweetUrl ? `https://twitter.com${tweetUrl}` : null,
              timestamp,
              likes: stats.likes,
              retweets: stats.retweets,
              replies: stats.replies
            });
          }
          
          return extractedTweets;
        });
        
        // Add new unique tweets to our collection
        for (const tweet of newTweets) {
          if (tweet.id && !tweets.some(t => t.id === tweet.id)) {
            tweets.push(tweet);
          }
        }
        
        // If we have enough tweets, break
        if (tweets.length >= count) {
          break;
        }
        
        // Scroll to load more tweets
        await this.autoScroll(page);
        
        // Wait a bit for new tweets to load
        await page.waitForTimeout(1000);
      }
      
      // Return the requested number of tweets
      return tweets.slice(0, count);
    } catch (error) {
      this.log.error('Error extracting recent tweets', { error });
      return [];
    }
  }
  
  /**
   * Calculate engagement metrics from tweets
   */
  calculateEngagementMetrics(tweets) {
    if (!tweets || tweets.length === 0) {
      return {
        avgLikes: 0,
        avgRetweets: 0,
        avgReplies: 0
      };
    }
    
    const totalLikes = tweets.reduce((sum, tweet) => sum + (tweet.likes || 0), 0);
    const totalRetweets = tweets.reduce((sum, tweet) => sum + (tweet.retweets || 0), 0);
    const totalReplies = tweets.reduce((sum, tweet) => sum + (tweet.replies || 0), 0);
    
    return {
      avgLikes: Math.round(totalLikes / tweets.length),
      avgRetweets: Math.round(totalRetweets / tweets.length),
      avgReplies: Math.round(totalReplies / tweets.length)
    };
  }
  
  /**
   * Auto-scroll the page to load more content
   */
  async autoScroll(page) {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 500;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          
          if (totalHeight >= scrollHeight - window.innerHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
  }
  
  /**
   * Static method to parse numeric counts with K, M, etc.
   */
  static parseCount(countText) {
    if (!countText) return 0;
    
    // Remove commas
    let text = countText.replace(/,/g, '');
    
    // Handle special formats
    if (text.includes('K') || text.includes('k')) {
      return Math.round(parseFloat(text.replace(/[K|k]/g, '')) * 1000);
    } else if (text.includes('M') || text.includes('m')) {
      return Math.round(parseFloat(text.replace(/[M|m]/g, '')) * 1000000);
    } else if (text.includes('B') || text.includes('b')) {
      return Math.round(parseFloat(text.replace(/[B|b]/g, '')) * 1000000000);
    }
    
    return parseInt(text, 10) || 0;
  }
  
  /**
   * Get the number of running browsers
   */
  get browsersRunning() {
    return this.browsers.size;
  }
}

module.exports = { XScraper }; 