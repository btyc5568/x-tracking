/**
 * Test script for Priority-based Scheduling
 * 
 * This script tests that the priority scheduler correctly schedules accounts
 * based on their priority level, with higher priority accounts being
 * scraped more frequently than lower priority ones.
 */

require('dotenv').config();
const { PriorityScheduler } = require('./src/services/scraper/priority-scheduler');
const { AccountManager } = require('./src/services/scraper/account-manager');
const { logger } = require('./src/utils/logger');

// Set logger to info level for better visibility
logger.level = 'info';
const log = logger.child({ module: 'PrioritySchedulerTest' });

// Check for quick test mode
const isQuickMode = process.env.TEST_QUICK_MODE === 'true';
const testDurationSeconds = parseInt(process.env.TEST_DURATION_SECONDS || '300', 10);
log.info(`Running in ${isQuickMode ? 'quick' : 'standard'} mode, duration: ${testDurationSeconds}s`);

// Mock scraper for testing
class MockScraper {
  constructor() {
    this.log = logger.child({ module: 'MockScraper' });
    this.scrapedAccounts = [];
    this.scrapeResults = new Map();
  }
  
  async initialize() {
    this.log.info('MockScraper initialized');
    return true;
  }
  
  async scrapeAccount(accountId, account) {
    this.log.info(`Scraping account: ${account.username} (Priority: ${account.priority})`);
    
    // Record the scrape
    this.scrapedAccounts.push({
      accountId,
      username: account.username,
      priority: account.priority,
      timestamp: Date.now()
    });
    
    // Simulate successful scrape with mock data
    const result = {
      success: true,
      posts: [
        {
          id: `post_${Date.now()}`,
          text: `Test post from ${account.username}`,
          timestamp: new Date().toISOString(),
          likes: Math.floor(Math.random() * 1000),
          retweets: Math.floor(Math.random() * 500)
        }
      ],
      scrapedAt: new Date().toISOString()
    };
    
    // Store the result
    if (!this.scrapeResults.has(accountId)) {
      this.scrapeResults.set(accountId, []);
    }
    this.scrapeResults.get(accountId).push(result);
    
    return result;
  }
  
  // Add the missing scrapeUserProfile method
  async scrapeUserProfile(accountId, username) {
    this.log.info(`Scraping user profile for: ${username} (ID: ${accountId})`);
    
    // Simulate successful profile scrape with mock data
    return {
      success: true,
      profile: {
        username: username,
        displayName: username.charAt(0).toUpperCase() + username.slice(1),
        bio: `This is a mock bio for ${username}`,
        followersCount: Math.floor(Math.random() * 10000),
        followingCount: Math.floor(Math.random() * 1000),
        verified: Math.random() > 0.7,
        joinDate: new Date().toISOString()
      },
      scrapedAt: new Date().toISOString()
    };
  }
  
  // Get statistics about which accounts were scraped
  getScrapingStats() {
    // Count scrapes per account
    const scrapesPerAccount = {};
    for (const scrape of this.scrapedAccounts) {
      if (!scrapesPerAccount[scrape.username]) {
        scrapesPerAccount[scrape.username] = 0;
      }
      scrapesPerAccount[scrape.username]++;
    }
    
    // Count scrapes per priority level
    const scrapesPerPriority = {};
    for (const scrape of this.scrapedAccounts) {
      if (!scrapesPerPriority[scrape.priority]) {
        scrapesPerPriority[scrape.priority] = 0;
      }
      scrapesPerPriority[scrape.priority]++;
    }
    
    return {
      totalScrapes: this.scrapedAccounts.length,
      scrapesPerAccount,
      scrapesPerPriority,
      scrapeHistory: this.scrapedAccounts
    };
  }
}

/**
 * Add test accounts with different priorities
 */
async function addTestAccounts(accountManager) {
  // Create a mix of accounts with different priorities
  const testAccounts = [
    // High priority accounts (5)
    {
      username: 'high_priority_1',
      name: 'High Priority 1',
      priority: 5,
      active: true,
      categories: ['Important']
    },
    {
      username: 'high_priority_2',
      name: 'High Priority 2',
      priority: 5,
      active: true,
      categories: ['Important']
    },
    
    // Medium priority accounts (3)
    {
      username: 'medium_priority_1',
      name: 'Medium Priority 1',
      priority: 3,
      active: true,
      categories: ['Regular']
    },
    {
      username: 'medium_priority_2',
      name: 'Medium Priority 2',
      priority: 3,
      active: true,
      categories: ['Regular']
    },
    
    // Low priority accounts (1)
    {
      username: 'low_priority_1',
      name: 'Low Priority 1',
      priority: 1,
      active: true,
      categories: ['Background']
    },
    {
      username: 'low_priority_2',
      name: 'Low Priority 2',
      priority: 1,
      active: true,
      categories: ['Background']
    }
  ];
  
  const results = [];
  for (const account of testAccounts) {
    log.info(`Adding test account: ${account.username} (Priority: ${account.priority})`);
    const result = await accountManager.addAccount(account);
    results.push(result);
  }
  
  log.info(`Added ${results.length} test accounts`);
  return results;
}

/**
 * Accelerate scheduler intervals for testing
 * This simulates faster scheduling to see results quickly
 */
function configureSchedulerForTesting(scheduler) {
  // Override the getFrequencyForPriority method for testing
  // Use faster intervals in quick mode
  scheduler._getFrequencyForPriority = function(priority) {
    if (isQuickMode) {
      // Super fast intervals for quick mode
      switch(priority) {
        case 5: return 3 * 1000;  // 3 seconds
        case 4: return 5 * 1000;  // 5 seconds
        case 3: return 7 * 1000;  // 7 seconds
        case 2: return 9 * 1000;  // 9 seconds
        case 1: return 12 * 1000; // 12 seconds
        default: return 7 * 1000; // Default to 7 seconds
      }
    } else {
      // Standard testing intervals
      switch(priority) {
        case 5: return 30 * 1000; // 30 seconds
        case 4: return 40 * 1000; // 40 seconds
        case 3: return 60 * 1000; // 60 seconds
        case 2: return 90 * 1000; // 90 seconds
        case 1: return 120 * 1000; // 120 seconds
        default: return 60 * 1000; // Default to 60 seconds
      }
    }
  };
  
  return scheduler;
}

/**
 * Main test function
 */
async function runTest() {
  log.info('Starting priority scheduler test');
  
  try {
    // Create scheduler with test configuration
    const scheduler = new PriorityScheduler({
      maxConcurrent: 1, // Process one account at a time for clearer results
      minInterval: isQuickMode ? 1000 : 5000 // Shorter interval in quick mode
    });
    
    // Configure scheduler for faster testing
    configureSchedulerForTesting(scheduler);
    
    // Create mock components
    const accountManager = new AccountManager({ storageType: 'memory' });
    const mockScraper = new MockScraper();
    
    // Initialize components
    await accountManager.initialize();
    await mockScraper.initialize();
    
    // Add test accounts
    const accounts = await addTestAccounts(accountManager);
    log.info(`Added ${accounts.length} test accounts`);
    
    // Set up scheduler
    scheduler.setup({
      accountManager,
      scraper: mockScraper,
      metricsCollector: {
        recordScrapingResult: () => Promise.resolve(), // Dummy metrics collector
        getLastScrapeTime: () => Promise.resolve(null) // No previous scrapes
      }
    });
    
    // Start the scheduler
    log.info('Starting scheduler');
    scheduler.start();
    
    // Run for the configured test duration to observe prioritization
    const testDurationMs = testDurationSeconds * 1000;
    log.info(`Running scheduler for ${testDurationSeconds} seconds to observe priority-based scheduling...`);
    await new Promise(resolve => setTimeout(resolve, testDurationMs));
    
    // Stop the scheduler
    log.info('Stopping scheduler');
    scheduler.stop();
    
    // Get scraping statistics
    const stats = mockScraper.getScrapingStats();
    log.info('Scraping statistics:', stats);
    
    // Analyze results to verify priority-based scheduling
    analyzeResults(stats);
    
    log.info('Priority scheduler test completed');
  } catch (error) {
    log.error('Test failed with error:', error);
  }
}

/**
 * Analyze results to verify priority-based scheduling
 */
function analyzeResults(stats) {
  log.info('Analyzing priority-based scheduling results:');
  
  // Validate that high priority accounts were scraped more than medium, and medium more than low
  const highPriorityScrapes = stats.scrapesPerPriority[5] || 0;
  const mediumPriorityScrapes = stats.scrapesPerPriority[3] || 0;
  const lowPriorityScrapes = stats.scrapesPerPriority[1] || 0;
  
  log.info(`Scrapes by priority: High(5): ${highPriorityScrapes}, Medium(3): ${mediumPriorityScrapes}, Low(1): ${lowPriorityScrapes}`);
  
  // In quick mode, we might not have enough time to see a clear pattern
  if (isQuickMode && stats.totalScrapes < 10) {
    log.warn('⚠️ WARN: Test ran in quick mode with few total scrapes, results may not show clear patterns');
  }
  
  // Perform validation
  if (highPriorityScrapes > mediumPriorityScrapes && mediumPriorityScrapes > lowPriorityScrapes) {
    log.info('✅ PASS: High priority accounts were scraped more frequently than medium, and medium more than low');
  } else if (highPriorityScrapes <= mediumPriorityScrapes) {
    log.error('❌ FAIL: High priority accounts were not scraped more than medium priority accounts');
  } else if (mediumPriorityScrapes <= lowPriorityScrapes) {
    log.error('❌ FAIL: Medium priority accounts were not scraped more than low priority accounts');
  }
  
  // Calculate scraping ratios
  if (lowPriorityScrapes > 0) {
    const highToLowRatio = highPriorityScrapes / lowPriorityScrapes;
    // In quick mode, we expect a lower ratio due to shortened test time
    const expectedHighToLowRatio = isQuickMode ? 2 : 4; 
    
    log.info(`High to low priority ratio: ${highToLowRatio.toFixed(2)}x (Expected ~${expectedHighToLowRatio}x)`);
    
    // Allow wider margins in quick mode
    const marginOfError = isQuickMode ? 0.5 : 0.7;
    if (highToLowRatio >= expectedHighToLowRatio * marginOfError) {
      log.info('✅ PASS: High priority to low priority scraping ratio is close to expected');
    } else {
      log.warn(`⚠️ WARN: High to low scraping ratio (${highToLowRatio.toFixed(2)}x) is lower than expected (${expectedHighToLowRatio}x)`);
    }
  }
  
  // Check individual accounts
  log.info('Individual account scrape counts:');
  for (const [username, count] of Object.entries(stats.scrapesPerAccount)) {
    log.info(`- ${username}: ${count} scrapes`);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  runTest().catch(error => {
    console.error('Unhandled error in test:', error);
    process.exit(1);
  });
}

module.exports = { runTest }; 