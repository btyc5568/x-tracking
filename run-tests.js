#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);
const testType = args.includes('--performance') ? 'performance' : 
                 args.includes('--e2e') ? 'e2e' : 
                 args.includes('--integration') ? 'integration' : null;

// Check if test type was specified
if (!testType) {
  console.error('Please specify a test type: --performance, --e2e, or --integration');
  process.exit(1);
}

// Path to the test directory
const testDir = path.join(__dirname, 'tests', testType);

// Check if the test directory exists
if (!fs.existsSync(testDir)) {
  console.error(`Test directory '${testDir}' does not exist`);
  process.exit(1);
}

// Get all test files
const testFiles = fs.readdirSync(testDir)
  .filter(file => file.endsWith('.test.js') || file.endsWith('.spec.js'));

if (testFiles.length === 0) {
  console.error(`No test files found in '${testDir}'`);
  process.exit(1);
}

console.log(`Running ${testType} tests...`);

// Use node environment for performance tests, jsdom for others
const configFile = testType === 'performance' 
  ? 'jest.node.config.js'
  : 'jest.config.js';

// Run tests using Jest with the appropriate config
const jestProcess = spawn('npx', [
  'jest',
  ...testFiles.map(file => path.join(testDir, file)),
  '--verbose',
  '--config',
  configFile
], { stdio: 'inherit' });

jestProcess.on('close', code => {
  process.exit(code);
}); 