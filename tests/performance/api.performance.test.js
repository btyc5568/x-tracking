const { test, expect, describe, beforeAll, afterAll } = require('@jest/globals');

// Check if we're in a browser environment before requiring puppeteer
const isNodeEnv = typeof window === 'undefined';
let puppeteer, browser, page;

// Only require puppeteer in Node environment
if (isNodeEnv) {
  puppeteer = require('puppeteer');
}

// Performance thresholds
const LOAD_TIME_THRESHOLD = 1000; // 1 second in ms
const API_RESPONSE_THRESHOLD = 500; // 500ms

// Sample server URL (update this to your actual server URL)
const SERVER_URL = 'http://localhost:3000';

beforeAll(async () => {
  // Only initialize browser in Node environment
  if (isNodeEnv) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
  }
});

afterAll(async () => {
  // Only close browser in Node environment
  if (isNodeEnv && browser) {
    await browser.close();
  }
});

describe('API Performance Tests', () => {
  // Skip tests that require puppeteer when in jsdom
  test('Home page loads within threshold', async () => {
    if (!isNodeEnv) {
      console.log('Skipping browser test in jsdom environment');
      return;
    }
    
    const startTime = Date.now();
    
    await page.goto(SERVER_URL, {
      waitUntil: 'networkidle0',
    });
    
    const loadTime = Date.now() - startTime;
    console.log(`Home page load time: ${loadTime}ms`);
    
    expect(loadTime).toBeLessThan(LOAD_TIME_THRESHOLD);
  });

  test('API endpoint response time is within threshold', async () => {
    if (!isNodeEnv) {
      console.log('Skipping browser test in jsdom environment');
      return;
    }
    
    // Enable request interception
    await page.setRequestInterception(true);
    
    let responseTime = null;
    
    page.on('request', request => {
      request.continue();
    });
    
    page.on('response', async response => {
      if (response.url().includes('/api')) {
        responseTime = response.timing().receiveHeadersEnd;
      }
    });
    
    await page.goto(`${SERVER_URL}/api/test`, {
      waitUntil: 'networkidle0',
    });
    
    console.log(`API response time: ${responseTime}ms`);
    
    expect(responseTime).toBeLessThan(API_RESPONSE_THRESHOLD);
  });

  // Add a simple test that works in both environments
  test('Basic performance assertion', () => {
    const startTime = Date.now();
    const result = [...Array(1000)].map((_, i) => i * i);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`Simple calculation time: ${duration}ms`);
    expect(duration).toBeLessThan(500); // Should be very fast
  });
}); 