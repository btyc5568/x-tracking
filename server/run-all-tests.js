/**
 * Test Runner for X Account Tracking & Market Analysis System
 * 
 * This script runs all test files in sequence and provides a summary report.
 * For quick testing, the tests are configured to run with shortened durations.
 */

require('dotenv').config();
const { logger } = require('./src/utils/logger');
const fs = require('fs').promises;
const path = require('path');

// Configure logger
logger.level = 'info';
const log = logger.child({ module: 'TestRunner' });

// Import test modules
const proxyRotationTest = require('./test-proxy-rotation');
const monitorPipelineTest = require('./test-monitor-pipeline');
const prioritySchedulerTest = require('./test-priority-scheduler');
const browserManagerTest = require('./test-browser-manager');
const scraperIntegrationTest = require('./test-scraper-integration');
const loadTest50 = require('./test-load-50-accounts');

// Configure shorter durations for tests
process.env.TEST_QUICK_MODE = 'true';
process.env.TEST_DURATION_SECONDS = '30';  // Use shorter duration for tests

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
async function saveTestReport(testName, success, startTime, endTime, error = null) {
  const reportDir = await createReportDir();
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const reportFile = path.join(reportDir, `${testName}-${timestamp}.log`);
  
  const duration = endTime - startTime;
  const report = {
    test: testName,
    success,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    durationMs: duration,
    durationFormatted: `${(duration / 1000).toFixed(2)} seconds`,
    error: error ? error.toString() : null
  };
  
  try {
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
    log.info(`Test report saved to ${reportFile}`);
  } catch (error) {
    log.error('Failed to save test report:', error);
  }
  
  return report;
}

/**
 * Run a test with error handling and timing
 */
async function runTestWithReport(testName, testFn) {
  log.info(`Running test: ${testName}`);
  console.log('\n' + '='.repeat(80));
  console.log(`STARTING TEST: ${testName}`);
  console.log('='.repeat(80) + '\n');
  
  const startTime = Date.now();
  let success = false;
  let error = null;
  
  try {
    await testFn();
    success = true;
    log.info(`Test ${testName} completed successfully`);
  } catch (err) {
    error = err;
    log.error(`Test ${testName} failed:`, err);
  }
  
  const endTime = Date.now();
  
  console.log('\n' + '='.repeat(80));
  console.log(`TEST COMPLETE: ${testName} - ${success ? 'PASSED' : 'FAILED'}`);
  console.log(`Duration: ${((endTime - startTime) / 1000).toFixed(2)} seconds`);
  console.log('='.repeat(80) + '\n');
  
  // Save report
  return await saveTestReport(testName, success, startTime, endTime, error);
}

/**
 * Main function to run all tests
 */
async function runAllTests() {
  log.info('Starting all tests (quick mode)');
  
  const testResults = [];
  const testsToRun = [
    { name: 'ProxyRotation', fn: proxyRotationTest.runTest },
    { name: 'MonitorPipeline', fn: monitorPipelineTest.runTest },
    { name: 'PriorityScheduler', fn: prioritySchedulerTest.runTest },
    { name: 'BrowserManager', fn: browserManagerTest.runTest },
    { name: 'ScraperIntegration', fn: scraperIntegrationTest.runTest },
    { name: 'LoadTest50Accounts', fn: loadTest50.runTest }
  ];
  
  const startTime = Date.now();
  
  for (const test of testsToRun) {
    const result = await runTestWithReport(test.name, test.fn);
    testResults.push(result);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  const endTime = Date.now();
  const totalDuration = endTime - startTime;
  
  // Print summary
  console.log('\n' + '#'.repeat(80));
  console.log('TEST SUMMARY');
  console.log('#'.repeat(80));
  console.log(`Total Duration: ${(totalDuration / 1000 / 60).toFixed(2)} minutes`);
  console.log(`Tests Run: ${testResults.length}`);
  console.log(`Successful: ${testResults.filter(r => r.success).length}`);
  console.log(`Failed: ${testResults.filter(r => !r.success).length}`);
  console.log('\nTest Results:');
  
  testResults.forEach(result => {
    console.log(`- ${result.test}: ${result.success ? '✅ PASS' : '❌ FAIL'} (${result.durationFormatted})`);
  });
  
  console.log('#'.repeat(80) + '\n');
  
  // Return summary data
  return {
    testsRun: testResults.length,
    successful: testResults.filter(r => r.success).length,
    failed: testResults.filter(r => !r.success).length,
    totalDuration,
    results: testResults
  };
}

// Run all tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Unhandled error in test runner:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests }; 