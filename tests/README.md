# Test Suite

This directory contains tests for the application. The tests are organized into three categories:

## Test Types

- **Performance Tests**: Measure the performance of the application, such as page load times and API response times.
- **E2E Tests**: End-to-end tests that simulate user interactions.
- **Integration Tests**: Tests that check the integration between different components of the application.

## Running Tests

You can run the tests using the following commands:

```bash
# Run all tests
npm test

# Run performance tests
npm run test:performance

# Run E2E tests
npm run test:e2e

# Run integration tests
npm run test:integration
```

## Test Structure

Each test type has its own directory:

- `performance/`: Contains performance tests.
- `e2e/`: Contains end-to-end tests.
- `integration/`: Contains integration tests.

## Writing Tests

Test files should be named with the `.test.js` or `.spec.js` suffix.

Example:
- `api.performance.test.js`
- `login.e2e.test.js`
- `user.integration.test.js`

## Configuration

The test configuration is defined in the `jest.config.js` file in the root directory. 