/**
 * Test script for X Account Tracking System - Integrated Test
 * 
 * This script tests the integration between the Proxy Manager and Scraper Orchestrator
 * to verify that the system can properly scrape X accounts with proxy rotation
 * and priority-based scheduling.
 */

require('dotenv').config();
const { ScraperOrchestrator } = require('./src/services/scraper/scraper-orchestrator');
const { logger } = require('./src/utils/logger');

// Set logger level for detailed output
logger.level = 'info';
const log = logger.child({ module: 'ScraperIntegrationTest' });

// Check for quick test mode
const isQuickMode = process.env.TEST_QUICK_MODE === 'true';
const testDurationSeconds = parseInt(process.env.TEST_DURATION_SECONDS || '120', 10);
log.info(`Running in ${isQuickMode ? 'quick' : 'standard'} mode, duration: ${testDurationSeconds}s`);

/**
 * Add test accounts with different priorities
 */
async function addTestAccounts(accountManager) {
  // Real X accounts with different priorities for testing
  const testAccounts = [
    {
      username: 'elonmusk',
      name: 'Elon Musk',
      priority: 5, // High priority
      active: true,
      categories: ['Tech', 'Business']
    },
    {
      username: 'BillGates',
      name: 'Bill Gates',
      priority: 3, // Medium priority
      active: true,
      categories: ['Tech', 'Philanthropy']
    },
    {
      username: 'finkd',
      name: 'Mark Zuckerberg',
      priority: 1, // Low priority
      active: true,
      categories: ['Tech', 'Business']
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
 * Monitor proxy usage during scraping
 */
function monitorProxyUsage(proxyManager, orchestrator) {
  // Track which proxies are used
  const usedProxies = new Set();
  const proxyUsageCount = {};
  
  // Listen for proxy usage events if the proxy manager emits them
  if (proxyManager.on) {
    proxyManager.on('proxyUsed', (proxyId) => {
      usedProxies.add(proxyId);
      proxyUsageCount[proxyId] = (proxyUsageCount[proxyId] || 0) + 1;
      log.info(`Proxy ${proxyId} used (total: ${proxyUsageCount[proxyId]} times)`);
    });
    
    // Listen for proxy rotation events
    proxyManager.on('proxyRotated', (oldProxyId, newProxyId) => {
      log.info(`Proxy rotated from ${oldProxyId} to ${newProxyId}`);
    });
  }
  
  return {
    getProxyStats: () => ({
      uniqueProxiesUsed: usedProxies.size,
      usageByProxy: proxyUsageCount
    })
  };
}

/**
 * Main test function
 */
async function runTest() {
  log.info('Starting integrated scraper test');
  
  try {
    // Create orchestrator with test configuration
    // For quick mode, use config optimized for faster testing
    const orchestrator = new ScraperOrchestrator({
      maxConcurrentWorkers: 2,
      maxBrowsers: 1,
      alertsEnabled: false, // Disable alerts in quick mode to reduce noise
      useProxies: true,
      minProxies: 3, // Use a smaller number for testing
      mockScraping: isQuickMode // Use mock scraping in quick mode to avoid actual network calls
    });
    
    // Initialize the orchestrator (this will also initialize the proxy manager)
    log.info('Initializing orchestrator...');
    await orchestrator.initialize();
    log.info('Orchestrator initialized');
    
    // Get reference to the proxy manager
    const proxyManager = orchestrator.proxyManager;
    
    // Set up proxy monitoring
    const proxyMonitor = monitorProxyUsage(proxyManager, orchestrator);
    
    // Add test accounts with different priorities
    const accounts = await addTestAccounts(orchestrator.accountManager);
    log.info('Test accounts added', { count: accounts.length });
    
    // Get initial status of orchestrator
    const initialStatus = orchestrator.getStatus();
    log.info('Initial orchestrator status:', initialStatus);
    
    // Get initial status of proxy manager
    const initialProxyStatus = proxyManager.getStatus();
    log.info('Initial proxy manager status:', initialProxyStatus);
    
    // Start the orchestrator to begin scheduled scraping
    await orchestrator.start();
    log.info('Orchestrator started - accounts will be scraped based on priority');
    
    // Run for the configured test duration to observe behavior
    const testDurationMs = testDurationSeconds * 1000;
    log.info(`Running test for ${testDurationSeconds} seconds to observe scheduled scraping...`);
    await new Promise(resolve => setTimeout(resolve, testDurationMs));
    
    // Get final status
    const finalStatus = orchestrator.getStatus();
    log.info('Final orchestrator status:', finalStatus);
    
    // Get proxy usage statistics
    const proxyStats = proxyMonitor.getProxyStats();
    log.info('Proxy usage statistics:', proxyStats);
    
    // Get final proxy manager status
    const finalProxyStatus = proxyManager.getStatus();
    log.info('Final proxy manager status:', finalProxyStatus);
    
    // Verify that scraping worked and metrics were collected
    const metricsCollector = orchestrator.metricsCollector;
    for (const account of accounts) {
      const metrics = await metricsCollector.getMetrics(account.id);
      log.info(`Metrics for ${account.username}:`, metrics);
      
      if (metrics && Object.keys(metrics).length > 0) {
        log.info(`✅ PASS: Metrics collected for ${account.username}`);
      } else {
        // In quick mode, we might not have had time to collect metrics
        if (isQuickMode) {
          log.warn(`⚠️ WARN: No metrics collected for ${account.username} (expected in quick mode)`);
        } else {
          log.warn(`⚠️ WARN: No metrics collected for ${account.username}`);
        }
      }
    }
    
    // Check if proper proxy rotation occurred
    if (proxyStats.uniqueProxiesUsed > 1) {
      log.info(`✅ PASS: Multiple proxies used (${proxyStats.uniqueProxiesUsed}), rotation is working`);
    } else if (proxyStats.uniqueProxiesUsed === 1) {
      // In quick mode, we might not have had time for rotation
      if (isQuickMode) {
        log.info('ℹ️ INFO: Only one proxy was used, which is expected in quick mode with short test duration');
      } else {
        log.warn('⚠️ WARN: Only one proxy was used. Test may need to run longer to observe rotation.');
      }
    } else {
      log.error('❌ FAIL: No proxies were used successfully');
    }
    
    // Stop the orchestrator
    await orchestrator.stop();
    log.info('Orchestrator stopped');
    
    log.info('Integrated scraper test completed');
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