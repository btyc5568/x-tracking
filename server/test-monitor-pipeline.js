// Test script for the Account Monitoring Pipeline
// Purpose: Verify that the account monitoring pipeline works correctly

require('dotenv').config();
const { ScraperOrchestrator } = require('./src/services/scraper/scraper-orchestrator');
const { AccountManager } = require('./src/services/scraper/account-manager');
const { logger } = require('./src/utils/logger');

// Set logger to debug level for detailed output
logger.level = 'info';
const log = logger.child({ module: 'MonitorPipelineTest' });

/**
 * Add test accounts for monitoring
 */
async function addTestAccounts(accountManager) {
  const testAccounts = [
    {
      username: 'elonmusk',
      name: 'Elon Musk',
      priority: 1,
      active: true,
      tags: ['tech', 'space', 'ai']
    },
    {
      username: 'BillGates',
      name: 'Bill Gates',
      priority: 2,
      active: true,
      tags: ['tech', 'philanthropy']
    },
    {
      username: 'OpenAI',
      name: 'OpenAI',
      priority: 1,
      active: true,
      tags: ['ai', 'tech']
    }
  ];
  
  const results = [];
  for (const account of testAccounts) {
    const result = await accountManager.addAccount(account);
    results.push(result);
  }
  
  log.info(`Added ${results.length} test accounts`);
  return results;
}

/**
 * Main test function
 */
async function runTest() {
  try {
    log.info('Starting account monitoring pipeline test');
    
    // Create orchestrator with test configuration
    const orchestrator = new ScraperOrchestrator({
      maxConcurrentWorkers: 1,
      maxBrowsers: 1,
      alertsEnabled: true,
      useProxies: false  // Disable proxies for local testing
    });
    
    // Initialize the orchestrator
    await orchestrator.initialize();
    log.info('Orchestrator initialized');
    
    // Add test accounts
    const accounts = await addTestAccounts(orchestrator.accountManager);
    log.info('Test accounts added', { count: accounts.length });
    
    // Set up event listener for significant changes
    orchestrator.metricsCollector.on('significantChange', (data) => {
      log.info('SIGNIFICANT CHANGE DETECTED', {
        accountId: data.accountId,
        timestamp: data.timestamp,
        changes: JSON.stringify(data.changes)
      });
    });
    
    // Manually trigger a scrape for each account
    for (const account of accounts) {
      log.info(`Manually triggering scrape for ${account.username}`);
      
      try {
        const result = await orchestrator.scrapeAccount(account.id);
        log.info(`Scrape result for ${account.username}:`, result);
      } catch (error) {
        log.error(`Error scraping ${account.username}:`, error);
      }
      
      // Wait 5 seconds between accounts to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Get status
    const status = orchestrator.getStatus();
    log.info('Orchestrator status:', status);
    
    // Wait 2 seconds before stopping
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Stop the orchestrator
    await orchestrator.stop();
    log.info('Orchestrator stopped');
    
    log.info('Account monitoring pipeline test completed');
  } catch (error) {
    log.error('Test failed:', error);
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