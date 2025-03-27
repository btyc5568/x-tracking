module.exports = {
  testEnvironment: 'jsdom',
  testTimeout: 30000, // 30 seconds
  verbose: true,
  testMatch: ['**/*.test.js', '**/*.spec.js'],
  collectCoverage: false,
  moduleDirectories: ['node_modules'],
  modulePathIgnorePatterns: ['node_modules'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/mocks/styleMock.js',
    '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/tests/mocks/fileMock.js'
  }
}; 