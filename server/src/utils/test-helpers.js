/**
 * Test Utility Helpers
 * 
 * A collection of helper functions for testing the X Account Tracking System
 */

/**
 * Generates a random X account for testing
 * @param {number} index - Index number to use in username generation
 * @returns {Object} A random account object
 */
function generateRandomAccount(index) {
  // Prefixes for different types of accounts
  const businessPrefixes = ['company', 'brand', 'tech', 'store', 'shop', 'app', 'service', 'product'];
  const individualPrefixes = ['user', 'person', 'prof', 'dr', 'coach', 'expert', 'fan', 'enthusiast'];
  const mediaPrefixes = ['news', 'media', 'magazine', 'channel', 'podcast', 'blog', 'radio', 'tv'];
  
  // Account types
  const accountTypes = ['individual', 'business', 'media', 'organization'];
  
  // Categories
  const categories = [
    'tech', 'business', 'politics', 'entertainment', 'sports',
    'science', 'health', 'gaming', 'fashion', 'food',
    'travel', 'art', 'music', 'finance', 'education'
  ];
  
  // Random selection helpers
  const randomElement = (array) => array[Math.floor(Math.random() * array.length)];
  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  
  // Determine account type
  const accountType = randomElement(accountTypes);
  
  // Choose appropriate prefix based on account type
  let prefix;
  switch (accountType) {
    case 'business':
      prefix = randomElement(businessPrefixes);
      break;
    case 'media':
      prefix = randomElement(mediaPrefixes);
      break;
    default:
      prefix = randomElement(individualPrefixes);
  }
  
  // Generate username
  const username = `${prefix}${index}`;
  
  // Generate random name
  const names = [
    'Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller',
    'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson'
  ];
  const name = `${randomElement(names)} ${accountType.charAt(0).toUpperCase() + accountType.slice(1)}`;
  
  // Select random categories (1-3)
  const numCategories = randomInt(1, 3);
  const accountCategories = [];
  const categoryPool = [...categories]; // Create a copy to draw from
  
  for (let i = 0; i < numCategories; i++) {
    if (categoryPool.length === 0) break;
    
    const randomIndex = randomInt(0, categoryPool.length - 1);
    accountCategories.push(categoryPool[randomIndex]);
    categoryPool.splice(randomIndex, 1); // Remove selected category
  }
  
  // Generate random metrics
  const followersCount = randomInt(100, 1000000);
  const followingCount = randomInt(10, 1000);
  const tweetCount = randomInt(50, 10000);
  
  // Assign random priority (1-5)
  const priority = randomInt(1, 5);
  
  // Build the account object
  return {
    username,
    name,
    accountType,
    categories: accountCategories,
    priority,
    active: true,
    metrics: {
      followersCount,
      followingCount,
      tweetCount
    }
  };
}

/**
 * Generates random profile data for testing
 * @param {string} username - Username for the profile
 * @returns {Object} Random profile data
 */
function generateRandomProfileData(username) {
  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const randomBool = () => Math.random() > 0.5;
  
  return {
    username,
    displayName: username.charAt(0).toUpperCase() + username.slice(1),
    bio: `This is a test bio for ${username}`,
    location: randomBool() ? 'New York, NY' : 'San Francisco, CA',
    website: randomBool() ? `https://${username}.com` : null,
    profileImage: `https://example.com/${username}.jpg`,
    followersCount: randomInt(100, 1000000),
    followingCount: randomInt(10, 1000),
    tweetCount: randomInt(50, 10000),
    listedCount: randomInt(0, 100),
    createdAt: new Date(Date.now() - randomInt(1, 365 * 3) * 24 * 60 * 60 * 1000).toISOString(),
    verified: randomBool(),
    protected: randomBool() && Math.random() > 0.8, // Less likely to be protected
    recentTweets: []
  };
}

/**
 * Generates a simple random tweet for testing
 * @param {string} username - Username of the tweet author
 * @returns {Object} Random tweet data
 */
function generateRandomTweet(username) {
  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  
  const tweetTexts = [
    'Just posted a new update!',
    'Check out our latest product release',
    'Having a great day today',
    'What do you think about the news?',
    'Excited to announce a new partnership',
    'Thanks for all your support',
    'Working hard on new features',
    'Interesting development in the industry today',
    'Happy to be part of this community',
    'Looking forward to the weekend'
  ];
  
  const randomText = tweetTexts[Math.floor(Math.random() * tweetTexts.length)];
  
  return {
    id: `tweet_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
    text: randomText,
    createdAt: new Date().toISOString(),
    author: username,
    replyCount: randomInt(0, 100),
    retweetCount: randomInt(0, 500),
    likeCount: randomInt(0, 1000),
    quoteCount: randomInt(0, 50),
    viewCount: randomInt(100, 10000)
  };
}

/**
 * Wait for a specified time period
 * @param {number} ms - Time to wait in milliseconds
 * @returns {Promise} Promise that resolves after the wait period
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a mock function that tracks calls and can be configured for testing
 * @param {Function} implementation - Optional implementation of the mock function
 * @returns {Function} Mock function with tracking capabilities
 */
function createMockFunction(implementation = () => {}) {
  const mockFn = (...args) => {
    mockFn.calls.push(args);
    mockFn.callCount++;
    return implementation(...args);
  };
  
  mockFn.calls = [];
  mockFn.callCount = 0;
  mockFn.mockImplementation = (newImplementation) => {
    implementation = newImplementation;
    return mockFn;
  };
  mockFn.mockReset = () => {
    mockFn.calls = [];
    mockFn.callCount = 0;
    return mockFn;
  };
  
  return mockFn;
}

/**
 * Creates a simple event emitter for testing
 * @returns {Object} An event emitter with on, emit, and off methods
 */
function createEventEmitter() {
  const listeners = {};
  
  return {
    on(event, callback) {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(callback);
      return this;
    },
    
    off(event, callback) {
      if (!listeners[event]) return this;
      
      if (callback) {
        listeners[event] = listeners[event].filter(cb => cb !== callback);
      } else {
        delete listeners[event];
      }
      return this;
    },
    
    emit(event, ...args) {
      if (!listeners[event]) return false;
      
      listeners[event].forEach(callback => {
        callback(...args);
      });
      return true;
    },
    
    // Get the number of listeners for a specific event
    listenerCount(event) {
      return listeners[event] ? listeners[event].length : 0;
    }
  };
}

module.exports = {
  generateRandomAccount,
  generateRandomProfileData,
  generateRandomTweet,
  sleep,
  createMockFunction,
  createEventEmitter
}; 