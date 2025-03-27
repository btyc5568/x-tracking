/**
 * Test script for the Proxy Rotation Service
 * 
 * This script demonstrates how the proxy rotation service works by:
 * 1. Initializing the ProxyManager
 * 2. Adding test proxies
 * 3. Running multiple requests through different proxies
 * 4. Observing the rotation behavior
 */

require('dotenv').config();
const { ProxyManager } = require('./src/services/scraper/proxy-manager');
const { logger } = require('./src/utils/logger');
const axios = require('axios');

// Configure the logger for this test
logger.level = 'debug';
const log = logger.child({ module: 'ProxyRotationTest' });

/**
 * Test function that uses a proxy to make a request
 */
async function testProxyRequest(proxyManager, index) {
  try {
    log.info(`Starting test request ${index}`);
    
    const result = await proxyManager.withProxy(async (proxy) => {
      log.info(`Using proxy ${proxy.host}:${proxy.port} for request ${index}`);
      
      // Create test URL with request index
      const testUrl = `https://httpbin.org/ip?request=${index}`;
      
      // Configure axios with the proxy
      const config = {
        timeout: 10000,
        proxy: proxyManager.createAxiosProxyConfig(proxy)
      };
      
      // Make the request
      const response = await axios.get(testUrl, config);
      
      // Log the response
      log.info(`Request ${index} completed with status ${response.status}`);
      log.info(`Request ${index} response data:`, response.data);
      
      return {
        success: true,
        requestIndex: index,
        proxyId: proxy.id,
        proxyHost: proxy.host,
        proxyPort: proxy.port,
        responseData: response.data
      };
    });
    
    return result;
  } catch (error) {
    log.error(`Request ${index} failed:`, error.message);
    return {
      success: false,
      requestIndex: index,
      error: error.message
    };
  }
}

/**
 * Add test proxies to the manager
 */
async function addTestProxies(proxyManager) {
  // These are public proxies that might work for testing
  // Note: Public proxies are often unreliable and may stop working
  // For production, you should use paid proxy providers
  const testProxies = [
    {
      host: '8.219.176.202',
      port: 8080,
      protocol: 'http'
    },
    {
      host: '103.88.35.200',
      port: 83,
      protocol: 'http'
    },
    {
      host: '43.153.171.39',
      port: 8080,
      protocol: 'http'
    },
    {
      host: '45.95.147.156',
      port: 3128,
      protocol: 'http'
    },
    {
      host: '203.17.127.176',
      port: 80,
      protocol: 'http'
    }
  ];
  
  // For production, you would load real proxies from a provider or list
  // This is just for demonstration purposes
  
  for (const proxy of testProxies) {
    await proxyManager.addProxy(proxy);
  }
  
  return testProxies.length;
}

/**
 * Main test function
 */
async function runTest() {
  log.info('Starting proxy rotation test');
  
  // Initialize the proxy manager
  const proxyManager = new ProxyManager({
    minProxies: 3,
    healthCheckInterval: 60 * 1000, // 1 minute for testing
    maxUsagePerProxy: 3, // Set low for testing rotation
    minRequestInterval: 1000, // 1 second for testing
    maxRequestInterval: 2000, // 2 seconds for testing
    coolingPeriod: 30 * 1000, // 30 seconds for testing
    // For testing, use a more lightweight health check URL
    healthCheckUrl: 'https://httpbin.org/status/200',
    healthCheckTimeout: 5000 // 5 seconds timeout for testing
  });
  
  try {
    // Initialize
    await proxyManager.initialize();
    
    // Add test proxies
    const proxyCount = await addTestProxies(proxyManager);
    log.info(`Added ${proxyCount} test proxies`);
    
    // Get status before test
    const initialStatus = proxyManager.getStatus();
    log.info('Initial proxy manager status:', initialStatus);
    
    // Run 10 test requests to demonstrate rotation
    const requestCount = 10;
    log.info(`Running ${requestCount} test requests...`);
    
    const results = [];
    
    // Run requests in sequence to better observe rotation
    for (let i = 1; i <= requestCount; i++) {
      const result = await testProxyRequest(proxyManager, i);
      results.push(result);
      
      // Small delay between requests to see the logs more clearly
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Get status after test
    const finalStatus = proxyManager.getStatus();
    log.info('Final proxy manager status:', finalStatus);
    
    // Show results summary
    log.info('Test results summary:');
    log.info(`- Total requests: ${results.length}`);
    log.info(`- Successful requests: ${results.filter(r => r.success).length}`);
    log.info(`- Failed requests: ${results.filter(r => !r.success).length}`);
    
    // Show proxy usage distribution
    const proxyUsage = {};
    for (const result of results) {
      if (result.success) {
        const proxyId = result.proxyId;
        proxyUsage[proxyId] = (proxyUsage[proxyId] || 0) + 1;
      }
    }
    
    log.info('Proxy usage distribution:');
    for (const [proxyId, count] of Object.entries(proxyUsage)) {
      log.info(`- Proxy ${proxyId}: ${count} requests`);
    }
    
    // Check if rotation occurred
    const uniqueProxiesUsed = Object.keys(proxyUsage).length;
    log.info(`Unique proxies used: ${uniqueProxiesUsed}`);
    
    if (uniqueProxiesUsed > 1) {
      log.info('✅ PASS: Proxy rotation is working correctly!');
    } else if (uniqueProxiesUsed === 1) {
      log.warn('⚠️ WARN: Only one proxy was used. The test may need to run longer to trigger rotation.');
    } else {
      log.error('❌ FAIL: No proxies were used successfully.');
    }
    
  } catch (error) {
    log.error('Test failed with error:', error);
  } finally {
    // Stop the proxy manager
    await proxyManager.stop();
    log.info('Proxy rotation test completed');
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  runTest().catch(error => {
    console.error('Unhandled error in test:', error);
    process.exit(1);
  });
}

module.exports = { runTest }; 