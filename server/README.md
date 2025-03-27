# X Account Tracking & Market Analysis System - Testing Suite

This directory contains the test suite for the X Account Tracking & Market Analysis System. The tests are designed to verify the functionality and performance of various components of the system.

## Available Tests

### Proxy Rotation Test
Tests the proxy rotation functionality to ensure proper handling of multiple proxies and rate limits.

### Monitor Pipeline Test
Tests the monitoring pipeline functionality, including metrics collection, analytics processing, and alert generation.

### Priority Scheduler Test
Tests the priority-based scheduling functionality to ensure accounts are scraped based on their priority.

### Browser Manager Test
Tests the browser management functionality, including browser creation, page management, and cleanup.

### Scraper Integration Test
Tests the integration between the Proxy Manager and Scraper Orchestrator to ensure proper scraping of X accounts.

### Load Test (50 Accounts)
Tests the system's performance with 50 X accounts to ensure it can handle a moderate load.

## Running the Tests

### Run All Tests
To run all tests in quick mode (shorter duration):

```bash
npm run test:all
```

### Run Individual Tests
To run a specific test, you can execute the corresponding test file directly:

```bash
node ./server/test-proxy-rotation.js
node ./server/test-monitor-pipeline.js
node ./server/test-priority-scheduler.js
node ./server/test-browser-manager.js
node ./server/test-scraper-integration.js
```

### Run Load Test
To run the load test with 50 accounts:

```bash
# Standard mode
npm run test:load

# Quick mode (shorter duration)
npm run test:load:quick
```

## Test Configuration

The tests can be configured using environment variables:

- `TEST_QUICK_MODE`: Set to "true" to run tests in quick mode with reduced durations (default: "false")
- `TEST_DURATION_SECONDS`: Set the duration of tests in seconds (default varies by test)

Example:

```bash
TEST_QUICK_MODE=true TEST_DURATION_SECONDS=30 node ./server/run-all-tests.js
```

## Test Reports

Test reports are generated in the `./server/test-reports` directory. These reports contain detailed information about the test runs, including timing, success/failure status, and other relevant metrics.

## Adding New Tests

To add a new test:

1. Create a new test file in the `./server` directory, following the naming convention `test-*.js`
2. Implement the test with a main `runTest()` function that returns test results
3. Add the test to the `run-all-tests.js` file to include it in the full test suite
4. Update this README to document the new test

## Testing Best Practices

1. Use the quick mode for development to get faster feedback
2. Always check the test reports for details on test failures
3. Monitor system resources during load tests to identify bottlenecks
4. Add detailed logging to tests to make debugging easier
5. Keep the tests independent to avoid dependencies between them 