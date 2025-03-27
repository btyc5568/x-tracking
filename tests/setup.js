// Add TextEncoder/TextDecoder polyfill for jsdom
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Add React Testing Library setup
try {
  require('@testing-library/jest-dom');
} catch (e) {
  console.log('Testing library not available for this test');
}

// Add other global polyfills here as needed 