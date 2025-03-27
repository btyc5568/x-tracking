/**
 * Test script for Browser Manager
 * 
 * This script tests the Browser Manager's ability to:
 * 1. Create and manage multiple browser instances
 * 2. Recycle browsers to maintain memory efficiency
 * 3. Handle concurrent browsing sessions
 * 4. Properly clean up resources
 */

require('dotenv').config();
const { BrowserManager } = require('./src/services/scraper/browser-manager');
const { logger } = require('./src/utils/logger');
const os = require('os');

// Configure logger
logger.level = 'info';
const log = logger.child({ module: 'BrowserManagerTest' });

// Check for quick test mode
const isQuickMode = process.env.TEST_QUICK_MODE === 'true';
const testDurationSeconds = parseInt(process.env.TEST_DURATION_SECONDS || '60', 10);
log.info(`Running in ${isQuickMode ? 'quick' : 'standard'} mode, duration: ${testDurationSeconds}s`);

/**
 * Simulate a scraping action
 */
async function simulateScraping(browserManager, url, index) {
  log.info(`Starting scrape simulation ${index} for ${url}`);
  
  let page = null;
  let browser = null;
  
  try {
    // Get a browser instance
    browser = await browserManager.getBrowser();
    log.info(`Got browser instance for simulation ${index}`);
    
    // Create a new page
    page = await browserManager.getPage(browser);
    log.info(`Got page for simulation ${index}`);
    
    // In quick mode, don't actually navigate to real sites
    if (isQuickMode) {
      log.info(`[Quick Mode] Simulating navigation to ${url} for simulation ${index}`);
      
      // Just return fake data in quick mode
      return {
        success: true,
        title: `Simulated Page ${index}`,
        url,
        simulationIndex: index
      };
    }
    
    // Navigate to URL
    log.info(`Navigating to ${url} for simulation ${index}...`);
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 60000 // 60 second timeout
    });
    
    // Get page title
    const title = await page.title();
    log.info(`Successfully loaded ${url} - Title: ${title} (simulation ${index})`);
    
    // Simulate some interaction
    await page.waitForTimeout(500); // Wait briefly
    
    // Scroll down
    await page.evaluate(() => {
      window.scrollBy(0, 500);
    });
    
    await page.waitForTimeout(500); // Wait briefly
    
    // Get some content
    const content = await page.evaluate(() => {
      return document.body.innerText.substring(0, 100) + '...';
    });
    
    log.info(`Content from ${url} (simulation ${index}): ${content}`);
    
    return {
      success: true,
      title,
      url,
      simulationIndex: index
    };
  } catch (error) {
    log.error(`Error in scrape simulation ${index} for ${url}:`, error.message);
    return {
      success: false,
      error: error.message,
      url,
      simulationIndex: index
    };
  } finally {
    // Always release resources
    if (page) {
      try {
        await browserManager.closePage(page);
        log.info(`Closed page for simulation ${index}`);
      } catch (err) {
        log.error(`Error closing page for simulation ${index}:`, err.message);
      }
    }
    
    if (browser) {
      try {
        await browserManager.releaseBrowser(browser);
        log.info(`Released browser for simulation ${index}`);
      } catch (err) {
        log.error(`Error releasing browser for simulation ${index}:`, err.message);
      }
    }
  }
}

/**
 * Check memory usage
 */
function checkMemoryUsage() {
  const memoryUsage = process.memoryUsage();
  const formatMemory = (bytes) => `${Math.round(bytes / 1024 / 1024)} MB`;
  
  return {
    rss: formatMemory(memoryUsage.rss),
    heapTotal: formatMemory(memoryUsage.heapTotal),
    heapUsed: formatMemory(memoryUsage.heapUsed),
    external: formatMemory(memoryUsage.external),
    systemFree: formatMemory(os.freemem()),
    systemTotal: formatMemory(os.totalmem())
  };
}

/**
 * Main test function
 */
async function runTest() {
  log.info('Starting browser manager test');
  
  try {
    // Initial memory usage
    const initialMemory = checkMemoryUsage();
    log.info('Initial memory usage:', initialMemory);
    
    // Create browser manager with test configuration
    const browserManager = new BrowserManager({
      maxConcurrentBrowsers: 2, // Limit to 2 concurrent browsers
      maxPagesPerBrowser: 3,    // Limit to 3 pages per browser
      maxBrowserAgeMs: isQuickMode ? 10000 : 60000,   // Recycle browsers after 10s in quick mode, 1 minute in standard
      browserResetCount: 5      // Recycle browser after 5 uses
    });
    
    // Initialize browser manager
    await browserManager.initialize();
    log.info('Browser manager initialized');
    
    // URLs to test with (simple URLs for quick testing)
    const testUrls = isQuickMode ? 
      ['about:blank', 'about:blank', 'about:blank', 'about:blank', 'about:blank'] :
      [
        'https://www.google.com',
        'https://www.github.com',
        'https://www.wikipedia.org',
        'https://www.reddit.com',
        'https://news.ycombinator.com'
      ];
    
    // Run multiple scrapes in sequence to test browser reuse
    const sequentialCount = isQuickMode ? 5 : 10;
    log.info(`Running ${sequentialCount} sequential scrape operations...`);
    for (let i = 1; i <= sequentialCount; i++) {
      const url = testUrls[i % testUrls.length];
      await simulateScraping(browserManager, url, i);
      
      // Check browser manager status
      const status = browserManager.getStatus();
      log.info(`Browser manager status after simulation ${i}:`, status);
      
      // Check memory usage periodically
      if (i % 3 === 0) {
        const currentMemory = checkMemoryUsage();
        log.info(`Memory usage after simulation ${i}:`, currentMemory);
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, isQuickMode ? 200 : 1000));
    }
    
    // Run concurrent scrapes to test multiple browser management
    const concurrentCount = isQuickMode ? 3 : 5;
    log.info(`Running ${concurrentCount} concurrent scrape operations...`);
    const promises = [];
    for (let i = sequentialCount + 1; i <= sequentialCount + concurrentCount; i++) {
      const url = testUrls[i % testUrls.length];
      promises.push(simulateScraping(browserManager, url, i));
    }
    
    // Wait for all concurrent scrapes to complete
    const concurrentResults = await Promise.allSettled(promises);
    
    // Check results from concurrent scraping
    log.info('Concurrent scrape results:');
    concurrentResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        log.info(`Concurrent scrape ${index + sequentialCount + 1} ${result.value.success ? 'succeeded' : 'failed'}`);
      } else {
        log.error(`Concurrent scrape ${index + sequentialCount + 1} rejected:`, result.reason);
      }
    });
    
    // Check browser manager status after concurrent scrapes
    const statusAfterConcurrent = browserManager.getStatus();
    log.info('Browser manager status after concurrent simulations:', statusAfterConcurrent);
    
    // Check memory usage after concurrent scrapes
    const memoryAfterConcurrent = checkMemoryUsage();
    log.info('Memory usage after concurrent scrapes:', memoryAfterConcurrent);
    
    // Test browser recycling
    log.info('Testing browser recycling...');
    const recycleWaitTime = isQuickMode ? 15000 : 70000; // 15s in quick mode, 70s in standard
    log.info(`Waiting ${recycleWaitTime/1000}s to trigger age-based recycling...`);
    await new Promise(resolve => setTimeout(resolve, recycleWaitTime));
    
    // Check if browsers were recycled
    const statusAfterRecycle = browserManager.getStatus();
    log.info('Browser manager status after waiting for recycling:', statusAfterRecycle);
    
    // Run one more scrape to check if new browsers are created when needed
    log.info('Running one final scrape to test new browser creation...');
    await simulateScraping(browserManager, isQuickMode ? 'about:blank' : 'https://www.example.com', sequentialCount + concurrentCount + 1);
    
    // Final status check
    const finalStatus = browserManager.getStatus();
    log.info('Final browser manager status:', finalStatus);
    
    // Final memory usage
    const finalMemory = checkMemoryUsage();
    log.info('Final memory usage:', finalMemory);
    
    // Cleanup
    log.info('Cleaning up browser manager...');
    await browserManager.cleanup();
    log.info('Browser manager cleaned up');
    
    // Final results analysis
    log.info('Test results analysis:');
    
    // Check if browsers were properly managed
    if (finalStatus.totalBrowsersCreated > 0 && finalStatus.activeBrowsers === 0) {
      log.info('✅ PASS: All browsers were properly cleaned up');
    } else {
      log.error('❌ FAIL: Browser cleanup may not have worked properly');
    }
    
    // Check if pages were properly managed
    if (finalStatus.totalPagesCreated > 0 && finalStatus.activePages === 0) {
      log.info('✅ PASS: All pages were properly closed');
    } else {
      log.error('❌ FAIL: Page cleanup may not have worked properly');
    }
    
    // Check browser recycling
    if (finalStatus.totalBrowsersCreated > finalStatus.maxConcurrentBrowsers) {
      log.info('✅ PASS: Browsers were recycled during the test');
    } else {
      log.warn('⚠️ WARN: No evidence of browser recycling during the test');
    }
    
    // Memory check
    const initialHeapMB = parseInt(initialMemory.heapUsed.replace(' MB', ''));
    const finalHeapMB = parseInt(finalMemory.heapUsed.replace(' MB', ''));
    const memoryDiff = finalHeapMB - initialHeapMB;
    
    log.info(`Memory usage difference: ${memoryDiff} MB`);
    if (memoryDiff < 100) {
      log.info('✅ PASS: Memory usage increase is reasonable');
    } else {
      log.warn(`⚠️ WARN: Significant memory increase (${memoryDiff} MB) - may indicate memory leaks`);
    }
    
    log.info('Browser manager test completed');
  } catch (error) {
    log.error('Test failed with error:', error);
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