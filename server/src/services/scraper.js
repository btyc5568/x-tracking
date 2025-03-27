const puppeteer = require('puppeteer');
const logger = require('../utils/logger');

class Scraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isLoggedIn = false;
    this.lastRequestTime = 0;
    this.minRequestInterval = 5000; // 5 seconds between requests
  }

  async initialize() {
    try {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
      });
      this.page = await this.browser.newPage();

      // Set viewport size
      await this.page.setViewport({ width: 1280, height: 800 });

      // Set user agent
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      );

      logger.info('Scraper initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Error initializing scraper: ${error.message}`);
      return false;
    }
  }

  async login(username, password) {
    if (!this.browser || !this.page) {
      await this.initialize();
    }

    try {
      logger.info('Attempting to log in to X...');
      await this.page.goto('https://twitter.com/i/flow/login', {
        waitUntil: 'networkidle2',
      });

      // Wait for the username field to be visible
      await this.page.waitForSelector('input[autocomplete="username"]');

      // Type username
      await this.page.type('input[autocomplete="username"]', username);

      // Click Next button
      await this.page.click('[role="button"]:has-text("Next")');

      // Wait for password field
      await this.page.waitForSelector('input[type="password"]');

      // Type password
      await this.page.type('input[type="password"]', password);

      // Click Log in button
      await this.page.click('[role="button"]:has-text("Log in")');

      // Wait for the page to load
      await this.page.waitForNavigation({ waitUntil: 'networkidle2' });

      // Check if login was successful
      const url = this.page.url();
      this.isLoggedIn = url.includes('twitter.com/home');

      if (this.isLoggedIn) {
        logger.info('Successfully logged in to X');
      } else {
        logger.error('Failed to log in to X');
      }

      return this.isLoggedIn;
    } catch (error) {
      logger.error(`Error logging in to X: ${error.message}`);
      return false;
    }
  }

  async throttleRequest() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.minRequestInterval) {
      const delay = this.minRequestInterval - elapsed;
      logger.debug(`Throttling request for ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  async getProfile(username) {
    if (!this.isLoggedIn) {
      logger.error('Not logged in. Please log in first.');
      return null;
    }

    try {
      await this.throttleRequest();

      // Navigate to the user's profile
      await this.page.goto(`https://twitter.com/${username}`, {
        waitUntil: 'networkidle2',
      });

      // Extract profile data
      const profileData = await this.page.evaluate(() => {
        // Check if profile exists
        if (document.querySelector('[data-testid="error-detail"]')) {
          return null;
        }

        const nameElement = document.querySelector('h2[role="heading"] span');
        const bioElement = document.querySelector('[data-testid="UserDescription"]');
        const followingElement = document.querySelector(
          'a[href$="/following"] span span'
        );
        const followersElement = document.querySelector(
          'a[href$="/followers"] span span'
        );
        const profileImageElement = document.querySelector(
          'div[data-testid="UserAvatar-Container"] img'
        );

        return {
          username: window.location.pathname.slice(1),
          displayName: nameElement ? nameElement.textContent : '',
          bio: bioElement ? bioElement.textContent : '',
          following: followingElement ? followingElement.textContent : '0',
          followers: followersElement ? followersElement.textContent : '0',
          profileImageUrl: profileImageElement ? profileImageElement.src : '',
        };
      });

      if (!profileData) {
        logger.error(`Profile not found for username: ${username}`);
        return null;
      }

      // Clean up the follower and following counts
      const cleanNumber = (str) => {
        if (!str) return 0;
        // Remove commas and convert abbreviations (K, M) to numbers
        const multipliers = {
          K: 1000,
          M: 1000000,
        };

        str = str.replace(/,/g, '');
        const match = str.match(/^(\d+(\.\d+)?)([KM])?$/);
        if (match) {
          const num = parseFloat(match[1]);
          const multiplier = match[3] ? multipliers[match[3]] : 1;
          return Math.floor(num * multiplier);
        }
        return 0;
      };

      return {
        username: profileData.username,
        displayName: profileData.displayName,
        bio: profileData.bio,
        followingCount: cleanNumber(profileData.following),
        followerCount: cleanNumber(profileData.followers),
        profileImageUrl: profileData.profileImageUrl,
      };
    } catch (error) {
      logger.error(`Error scraping profile for ${username}: ${error.message}`);
      return null;
    }
  }

  async getPosts(username, count = 10) {
    if (!this.isLoggedIn) {
      logger.error('Not logged in. Please log in first.');
      return [];
    }

    try {
      await this.throttleRequest();

      // Navigate to the user's profile
      await this.page.goto(`https://twitter.com/${username}`, {
        waitUntil: 'networkidle2',
      });

      // Wait for tweets to load
      await this.page.waitForSelector('[data-testid="tweet"]');

      // Scroll down to load more tweets if needed
      const scrollsNeeded = Math.ceil(count / 5); // Approximately 5 tweets per scroll
      for (let i = 0; i < scrollsNeeded; i++) {
        await this.page.evaluate(() => {
          window.scrollBy(0, 1000);
        });
        await this.page.waitForTimeout(1000); // Wait for content to load
      }

      // Extract posts
      const posts = await this.page.evaluate((maxCount) => {
        const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
        const results = [];

        for (let i = 0; i < Math.min(tweetElements.length, maxCount); i++) {
          const tweetEl = tweetElements[i];
          
          // Skip promoted tweets
          if (tweetEl.textContent.includes('Promoted')) {
            continue;
          }

          // Get tweet ID from the link
          const linkEl = tweetEl.querySelector('a[href*="/status/"]');
          const postId = linkEl
            ? linkEl.href.match(/\/status\/(\d+)/)?.[1] || null
            : null;

          // Skip if no valid ID (probably not a regular tweet)
          if (!postId) {
            continue;
          }

          // Get tweet content
          const contentEl = tweetEl.querySelector('[data-testid="tweetText"]');
          const content = contentEl ? contentEl.textContent : '';

          // Get timestamp
          const timeEl = tweetEl.querySelector('time');
          const timestamp = timeEl ? timeEl.getAttribute('datetime') : null;

          // Get engagement stats
          const getStatValue = (testId) => {
            const statEl = tweetEl.querySelector(`[data-testid="${testId}"] span`);
            if (!statEl) return 0;
            const text = statEl.textContent.trim();
            if (!text || text === '') return 0;
            return parseInt(text.replace(/,/g, '')) || 0;
          };

          const replyCount = getStatValue('reply');
          const retweetCount = getStatValue('retweet');
          const likeCount = getStatValue('like');

          // Get media
          const mediaElements = tweetEl.querySelectorAll('img[src*="media"]');
          const mediaUrls = Array.from(mediaElements).map((img) => img.src);

          // Get hashtags
          const hashtags = content.match(/#\w+/g) || [];

          // Get mentions
          const mentions = content.match(/@\w+/g) || [];

          results.push({
            postId,
            content,
            postDate: timestamp,
            likeCount,
            retweetCount,
            replyCount,
            mediaUrls,
            hashtags,
            mentions,
            url: `https://twitter.com/status/${postId}`,
          });

          // Break if we've reached the desired count
          if (results.length >= maxCount) {
            break;
          }
        }

        return results;
      }, count);

      return posts;
    } catch (error) {
      logger.error(`Error scraping tweets for ${username}: ${error.message}`);
      return [];
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isLoggedIn = false;
      logger.info('Scraper closed successfully');
    }
  }
}

module.exports = new Scraper(); 