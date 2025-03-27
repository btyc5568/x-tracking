module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000, // 30 seconds
  verbose: true,
  testMatch: ['**/performance/**/*.test.js', '**/performance/**/*.spec.js'],
  collectCoverage: false,
  moduleDirectories: ['node_modules'],
  modulePathIgnorePatterns: ['node_modules'],
  setupFilesAfterEnv: [],
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  }
}; 