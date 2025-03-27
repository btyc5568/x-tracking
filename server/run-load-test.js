/**
 * Load Test Runner for X Account Tracking System
 * 
 * This script runs the load test with 50 accounts and displays the results.
 */

require('dotenv').config();
const { logger } = require('./src/utils/logger');
const fs = require('fs').promises;
const path = require('path');
const loadTest50 = require('./test-load-50-accounts');

// Configure logger
logger.level = 'info';
const log = logger.child({ module: 'LoadTestRunner' });

// Set environment variables for test configuration
process.env.TEST_QUICK_MODE = process.env.TEST_QUICK_MODE || 'false';
process.env.TEST_DURATION_SECONDS = process.env.TEST_DURATION_SECONDS || '60';

const isQuickMode = process.env.TEST_QUICK_MODE === 'true';
const testDuration = parseInt(process.env.TEST_DURATION_SECONDS, 10);

/**
 * Create a test report directory
 */
async function createReportDir() {
  const reportDir = path.join(__dirname, 'test-reports');
  try {
    await fs.mkdir(reportDir, { recursive: true });
    return reportDir;
  } catch (error) {
    log.error('Failed to create report directory:', error);
    throw error;
  }
}

/**
 * Save test results to a log file
 */
async function saveTestReport(results) {
  const reportDir = await createReportDir();
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const reportFile = path.join(reportDir, `LoadTest50-${timestamp}.json`);
  
  try {
    await fs.writeFile(reportFile, JSON.stringify(results, null, 2));
    log.info(`Test report saved to ${reportFile}`);
  } catch (error) {
    log.error('Failed to save test report:', error);
  }
  
  return reportFile;
}

/**
 * Run the load test and save results
 */
async function runLoadTest() {
  log.info(`Starting load test with 50 accounts (${isQuickMode ? 'quick' : 'standard'} mode, ${testDuration}s)`);
  
  try {
    const startTime = Date.now();
    
    // Run the load test
    const results = await loadTest50.runTest();
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    // Save the results
    const reportFile = await saveTestReport(results);
    
    log.info(`Load test completed in ${duration.toFixed(2)} seconds`);
    log.info(`Accounts tested: ${results.accounts.total}`);
    log.info(`Memory usage: Max ${results.memory.max}MB, Avg ${results.memory.avg}MB`);
    log.info(`CPU usage: Max ${results.cpu.max}%, Avg ${results.cpu.avg}%`);
    
    return {
      success: true,
      duration,
      results,
      reportFile
    };
  } catch (error) {
    log.error('Load test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the load test if this script is executed directly
if (require.main === module) {
  runLoadTest().catch(error => {
    console.error('Unhandled error in load test runner:', error);
    process.exit(1);
  });
}

module.exports = { runLoadTest }; 