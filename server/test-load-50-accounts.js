/**
 * Load Test: 50 Account Simulation
 * 
 * This test simulates a moderate load of 50 accounts being tracked in the system.
 * It measures performance metrics including memory usage, CPU usage, and response times.
 */

require('dotenv').config();
const { MonitoringPipeline } = require('./src/services/monitoring/monitoring-pipeline');
const { generateRandomAccount } = require('./src/utils/test-helpers');
const { logger } = require('./src/utils/logger');
const os = require('os');

// Set logger level
logger.level = 'info';
const log = logger.child({ module: 'LoadTest50' });

// Check for quick test mode
const isQuickMode = process.env.TEST_QUICK_MODE === 'true';
const testDurationSeconds = parseInt(process.env.TEST_DURATION_SECONDS || '300', 10);
log.info(`Running in ${isQuickMode ? 'quick' : 'standard'} mode, duration: ${testDurationSeconds}s`);

// Determine number of test accounts based on mode
const NUM_ACCOUNTS = isQuickMode ? 20 : 50;
log.info(`Will generate ${NUM_ACCOUNTS} test accounts`);

// Performance metrics tracking
const metrics = {
  startTime: 0,
  endTime: 0,
  memoryUsage: [],
  cpuUsage: [],
  accountAddTimes: [],
  accountScrapeTimes: [],
  totalAccounts: 0,
  successfulScrapes: 0,
  failedScrapes: 0
};

/**
 * Monitor system resources during the test
 */
function startResourceMonitoring() {
  const monitoringInterval = isQuickMode ? 2000 : 5000; // Shorter interval in quick mode
  
  // Record baseline
  const baselineCpuInfo = os.cpus().map(cpu => cpu.times);
  let lastCpuInfo = baselineCpuInfo;
  
  // Start recording
  metrics.startTime = Date.now();
  
  // Set up interval for monitoring
  const intervalId = setInterval(() => {
    // Memory metrics
    const memUsage = process.memoryUsage();
    metrics.memoryUsage.push({
      timestamp: Date.now(),
      rss: memUsage.rss / 1024 / 1024, // Convert to MB
      heapTotal: memUsage.heapTotal / 1024 / 1024,
      heapUsed: memUsage.heapUsed / 1024 / 1024,
      external: memUsage.external / 1024 / 1024
    });
    
    // CPU metrics
    const currentCpuInfo = os.cpus().map(cpu => cpu.times);
    const cpuUsage = currentCpuInfo.map((cpu, i) => {
      const lastCpu = lastCpuInfo[i];
      const totalDiff = Object.values(cpu).reduce((sum, value, j) => {
        const lastValue = Object.values(lastCpu)[j];
        return sum + (value - lastValue);
      }, 0);
      
      const idleDiff = cpu.idle - lastCpu.idle;
      const usedPercentage = (1 - idleDiff / totalDiff) * 100;
      
      return usedPercentage;
    });
    
    metrics.cpuUsage.push({
      timestamp: Date.now(),
      average: cpuUsage.reduce((sum, value) => sum + value, 0) / cpuUsage.length,
      cores: cpuUsage
    });
    
    // Update reference for next calculation
    lastCpuInfo = currentCpuInfo;
    
    // Log current usage every few intervals
    if (metrics.memoryUsage.length % 5 === 0) {
      const lastMemory = metrics.memoryUsage[metrics.memoryUsage.length - 1];
      const lastCpu = metrics.cpuUsage[metrics.cpuUsage.length - 1];
      
      log.info(`Resource usage - Memory: ${lastMemory.heapUsed.toFixed(2)}MB, CPU: ${lastCpu.average.toFixed(2)}%`);
    }
  }, monitoringInterval);
  
  // Return a function to stop monitoring
  return () => {
    clearInterval(intervalId);
    metrics.endTime = Date.now();
  };
}

/**
 * Generate test accounts in batches
 */
async function generateTestAccounts(pipeline, numAccounts) {
  log.info(`Generating ${numAccounts} test accounts...`);
  
  // Add accounts in batches to avoid overwhelming the system
  const batchSize = isQuickMode ? 10 : 20;
  const batches = Math.ceil(numAccounts / batchSize);
  
  let accountsAdded = 0;
  
  for (let i = 0; i < batches; i++) {
    // Generate a batch of accounts
    const batch = [];
    const currentBatchSize = Math.min(batchSize, numAccounts - accountsAdded);
    
    for (let j = 0; j < currentBatchSize; j++) {
      const account = generateRandomAccount(accountsAdded + j + 1);
      batch.push(account);
    }
    
    // Add the batch
    log.info(`Adding batch ${i + 1}/${batches} (${batch.length} accounts)...`);
    
    const startTime = Date.now();
    const accountPromises = batch.map(account => pipeline.accountManager.addAccount(account));
    const results = await Promise.all(accountPromises);
    const endTime = Date.now();
    
    // Record metrics
    metrics.accountAddTimes.push({
      batchIndex: i,
      batchSize: batch.length,
      totalTime: endTime - startTime,
      avgTimePerAccount: (endTime - startTime) / batch.length
    });
    
    accountsAdded += batch.length;
    metrics.totalAccounts = accountsAdded;
    
    log.info(`Added ${accountsAdded}/${numAccounts} accounts`);
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, isQuickMode ? 100 : 500));
  }
  
  log.info(`Completed adding ${accountsAdded} accounts`);
  return accountsAdded;
}

/**
 * Simulate account scraping
 */
async function simulateAccountScraping(pipeline, durationSeconds) {
  log.info(`Simulating account scraping for ${durationSeconds} seconds...`);
  
  // End time for the simulation
  const endTime = Date.now() + (durationSeconds * 1000);
  
  // Get all accounts
  const accounts = await pipeline.accountManager.getAllAccounts();
  log.info(`Retrieved ${accounts.length} accounts for scraping simulation`);
  
  // Counter for scraping operations
  let scrapeCount = 0;
  
  // Perform scraping operations until time runs out
  while (Date.now() < endTime) {
    // Select a batch of random accounts to scrape
    const batchSize = isQuickMode ? 5 : 10;
    const accountBatch = [];
    
    for (let i = 0; i < batchSize; i++) {
      const randomIndex = Math.floor(Math.random() * accounts.length);
      accountBatch.push(accounts[randomIndex]);
    }
    
    // Track scrape time
    const startTime = Date.now();
    
    // Scrape the batch
    const scrapePromises = accountBatch.map(async (account) => {
      try {
        // In quick mode, just pretend to scrape by generating fake metrics
        if (isQuickMode) {
          const fakeMetrics = {
            timestamp: new Date().toISOString(),
            accountId: account.id,
            username: account.username,
            followersCount: account.metrics?.followersCount || 1000 + Math.floor(Math.random() * 1000),
            tweetCount: account.metrics?.tweetCount || 100 + Math.floor(Math.random() * 50),
            engagementRate: 0.05 + (Math.random() * 0.02),
            sentimentScore: Math.random() * 2 - 1
          };
          
          await pipeline.processMetrics(fakeMetrics);
          return { success: true, accountId: account.id };
        } else {
          // Normal mode - use actual scraper
          const result = await pipeline.scrapeAccount(account.id);
          return { success: true, accountId: account.id, result };
        }
      } catch (error) {
        metrics.failedScrapes++;
        return { success: false, accountId: account.id, error: error.message };
      }
    });
    
    const results = await Promise.all(scrapePromises);
    const endTime = Date.now();
    
    // Record metrics
    metrics.accountScrapeTimes.push({
      batchIndex: scrapeCount,
      batchSize: accountBatch.length,
      totalTime: endTime - startTime,
      avgTimePerAccount: (endTime - startTime) / accountBatch.length
    });
    
    // Count successful scrapes
    const successfulInBatch = results.filter(r => r.success).length;
    metrics.successfulScrapes += successfulInBatch;
    metrics.failedScrapes += (accountBatch.length - successfulInBatch);
    
    scrapeCount++;
    
    // Log every few batches
    if (scrapeCount % 5 === 0) {
      log.info(`Completed ${scrapeCount} scrape batches, ${metrics.successfulScrapes} successful, ${metrics.failedScrapes} failed`);
    }
    
    // Small delay between batches - smaller in quick mode
    await new Promise(resolve => setTimeout(resolve, isQuickMode ? 200 : 1000));
  }
  
  log.info(`Completed ${scrapeCount} scrape batches`);
  return {
    batchesCompleted: scrapeCount,
    successfulScrapes: metrics.successfulScrapes,
    failedScrapes: metrics.failedScrapes
  };
}

/**
 * Analyze and report test results
 */
function analyzeResults() {
  log.info('Analyzing test results...');
  
  // Calculate test duration
  const totalDurationMs = metrics.endTime - metrics.startTime;
  const totalDurationMin = totalDurationMs / 1000 / 60;
  
  // Memory stats
  const maxMemory = Math.max(...metrics.memoryUsage.map(m => m.heapUsed));
  const avgMemory = metrics.memoryUsage.reduce((sum, m) => sum + m.heapUsed, 0) / metrics.memoryUsage.length;
  
  // CPU stats
  const maxCpu = Math.max(...metrics.cpuUsage.map(c => c.average));
  const avgCpu = metrics.cpuUsage.reduce((sum, c) => sum + c.average, 0) / metrics.cpuUsage.length;
  
  // Account operations
  const avgAccountAddTime = metrics.accountAddTimes.reduce((sum, m) => sum + m.avgTimePerAccount, 0) / metrics.accountAddTimes.length;
  
  const avgAccountScrapeTime = metrics.accountScrapeTimes.length > 0
    ? metrics.accountScrapeTimes.reduce((sum, m) => sum + m.avgTimePerAccount, 0) / metrics.accountScrapeTimes.length
    : 0;
  
  // Memory per account
  const memoryPerAccount = metrics.totalAccounts > 0 ? maxMemory / metrics.totalAccounts : 0;
  
  // Prepare results object
  const results = {
    testMode: isQuickMode ? 'quick' : 'standard',
    accounts: {
      total: metrics.totalAccounts,
      targetCount: NUM_ACCOUNTS
    },
    duration: {
      ms: totalDurationMs,
      minutes: totalDurationMin.toFixed(2),
      formattedTime: `${Math.floor(totalDurationMin)}m ${Math.round((totalDurationMin % 1) * 60)}s`
    },
    memory: {
      max: maxMemory.toFixed(2),
      avg: avgMemory.toFixed(2),
      perAccount: memoryPerAccount.toFixed(4),
      unit: 'MB'
    },
    cpu: {
      max: maxCpu.toFixed(2),
      avg: avgCpu.toFixed(2),
      unit: '%'
    },
    performance: {
      avgAccountAddTime: avgAccountAddTime.toFixed(2),
      avgAccountScrapeTime: avgAccountScrapeTime.toFixed(2),
      successfulScrapes: metrics.successfulScrapes,
      failedScrapes: metrics.failedScrapes,
      scrapeSuccessRate: metrics.successfulScrapes + metrics.failedScrapes > 0
        ? (metrics.successfulScrapes / (metrics.successfulScrapes + metrics.failedScrapes) * 100).toFixed(2)
        : '0.00',
      unit: 'ms'
    }
  };
  
  // Log summary
  log.info('================================');
  log.info(`LOAD TEST SUMMARY (${results.testMode} mode)`);
  log.info('================================');
  log.info(`ACCOUNTS: ${results.accounts.total} (Target: ${results.accounts.targetCount})`);
  log.info(`DURATION: ${results.duration.formattedTime}`);
  log.info(`MEMORY: Max ${results.memory.max}MB, Avg ${results.memory.avg}MB, Per Account ${results.memory.perAccount}MB`);
  log.info(`CPU: Max ${results.cpu.max}%, Avg ${results.cpu.avg}%`);
  log.info(`PERFORMANCE:`);
  log.info(`  - Avg Account Add Time: ${results.performance.avgAccountAddTime}ms`);
  log.info(`  - Avg Account Scrape Time: ${results.performance.avgAccountScrapeTime}ms`);
  log.info(`  - Scrape Success Rate: ${results.performance.scrapeSuccessRate}% (${results.performance.successfulScrapes} successful, ${results.performance.failedScrapes} failed)`);
  
  return results;
}

/**
 * Main test function
 */
async function runTest() {
  log.info(`Starting load test with ${NUM_ACCOUNTS} accounts`);
  
  try {
    // Start resource monitoring
    const stopMonitoring = startResourceMonitoring();
    
    // Create the pipeline with configuration for load testing
    const pipeline = new MonitoringPipeline({
      // Configure for load testing - faster intervals in quick mode
      metricsProcessingInterval: isQuickMode ? 5000 : 20000,
      analyticsProcessingInterval: isQuickMode ? 10000 : 30000,
      alertCheckInterval: isQuickMode ? 10000 : 30000,
      databasePath: ':memory:', // Use in-memory DB for testing
      enableRealTimeUpdates: false, // Disable realtime updates for performance
      mockScraping: true, // Don't do real scraping for load test
      batchSize: isQuickMode ? 10 : 20, // Batch size appropriate for 50 accounts
      logLevel: 'info'
    });
    
    // Initialize the pipeline
    log.info('Initializing monitoring pipeline...');
    await pipeline.initialize();
    log.info('Pipeline initialized');
    
    // Generate test accounts
    await generateTestAccounts(pipeline, NUM_ACCOUNTS);
    
    // Start the pipeline
    await pipeline.start();
    log.info('Pipeline started');
    
    // Calculate simulation duration
    const simulationDuration = isQuickMode ? 
      Math.min(testDurationSeconds, 60) : 
      Math.min(testDurationSeconds, 180);
    
    // Run simulated scraping
    await simulateAccountScraping(pipeline, simulationDuration);
    
    // Get final database stats
    if (pipeline.dbStats) {
      const dbStats = await pipeline.dbStats();
      log.info('Database stats:', dbStats);
    }
    
    // Stop monitoring
    stopMonitoring();
    
    // Analyze results
    const results = analyzeResults();
    
    // Stop the pipeline
    await pipeline.stop();
    log.info('Pipeline stopped');
    
    log.info('Load test completed');
    
    return results;
  } catch (error) {
    log.error('Test failed with error:', error);
    return {
      error: error.message,
      passed: false
    };
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