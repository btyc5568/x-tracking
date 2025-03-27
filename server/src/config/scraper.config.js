// X Account Tracking Scraper Configuration

module.exports = {
  system: {
    maxConcurrentWorkers: process.env.MAX_CONCURRENT_WORKERS || 5,
    maxBrowsers: process.env.MAX_BROWSERS || 5,
    logLevel: process.env.LOG_LEVEL || 'info'
  },
  
  scraping: {
    maxPostsToExtract: 20,
    pageTimeoutMs: 30000,
    maxPageRetries: 3,
    dataCacheTtlHours: 24,
    baseUrl: 'https://twitter.com'
  },
  
  priorityLevels: {
    1: { intervalHours: 24, jitterPercent: 10 },
    2: { intervalHours: 12, jitterPercent: 10 },
    3: { intervalHours: 6, jitterPercent: 10 },
    4: { intervalHours: 3, jitterPercent: 5 },
    5: { intervalHours: 1, jitterPercent: 5 }
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    prefix: 'scraper:'
  },
  
  proxies: {
    minProxies: 1, // Set to 1 for development, 20+ for production
    rateLimitCooldownMinutes: 15,
    list: [
      // For development, using localhost without proxy
      // Add actual proxies for production
    ]
  },
  
  authentication: {
    cookiesDir: './data/cookies',
    systemAccounts: [
      // Add system accounts for X authentication if needed
    ]
  },
  
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeoutMs: 300000,
    halfOpenMaxRequests: 1
  },
  
  alerts: {
    throttleWindowMs: 300000,
    channels: [
      { 
        type: 'log', 
        config: { 
          level: 'warn' 
        } 
      }
    ]
  },
  
  // Common user agents for rotation
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0'
  ],
  
  // X selectors (update these if Twitter's structure changes)
  selectors: {
    profile: {
      name: '[data-testid="UserName"]',
      bio: '[data-testid="UserDescription"]',
      following: '[data-testid="primaryColumn"] a[href$="/following"]',
      followers: '[data-testid="primaryColumn"] a[href$="/followers"]'
    },
    posts: {
      container: '[data-testid="tweet"]',
      text: '[data-testid="tweetText"]',
      time: 'time',
      metrics: {
        replies: '[data-testid="reply"]',
        retweets: '[data-testid="retweet"]',
        likes: '[data-testid="like"]'
      }
    }
  }
}; 