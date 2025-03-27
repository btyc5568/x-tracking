# Proxy Rotation Service for X Account Tracking

## Overview

The Proxy Rotation Service is a core component of the X Account Tracking system that enables scalable and resilient web scraping by managing a pool of proxy servers. This service is essential for:

1. **Avoiding IP-based Rate Limiting**: Distributing requests across multiple proxies to prevent hitting X's rate limits
2. **Avoiding Detection**: Making requests appear to come from different locations
3. **Improving Resilience**: Automatically falling back to alternative proxies if one fails
4. **Ensuring Compliance**: Respecting rate limits per IP address

## Features

- **Proxy Pool Management**: Maintains a collection of proxy servers with health tracking
- **Automatic Rotation**: Rotates proxies based on usage counts and cooling periods
- **Health Checking**: Regularly verifies proxy availability and marks unhealthy proxies
- **Request Throttling**: Enforces delays between requests to the same proxy
- **Load Balancing**: Distributes requests across available proxies
- **Proxy Cooling**: Implements cooling periods after maximum usage
- **Persistent Storage**: Saves proxy configurations to disk for restart resilience
- **Provider Integration**: Can fetch proxies from external proxy providers
- **Error Handling**: Detects and manages proxy-related errors

## Architecture

The Proxy Rotation Service consists of:

- **ProxyManager Class**: Core class that manages the proxy pool
- **Proxy Configuration**: JSON structure for each proxy with health metrics
- **Request Queuing**: Per-proxy request queues to enforce throttling
- **Health Monitoring**: Background health check process
- **Usage Tracking**: Monitoring request counts per proxy

## Configuration

The service can be configured through environment variables or directly in code:

```
# Proxy settings in .env
USE_PROXIES=true
MIN_PROXIES=20
PROXY_PROVIDER_URLS=https://provider1.com/proxies,https://provider2.com/proxies
MAX_USAGE_PER_PROXY=100
MIN_REQUEST_INTERVAL=3000
MAX_REQUEST_INTERVAL=5000
COOLING_PERIOD=600000
```

## Usage

### Basic Usage

```javascript
const { ProxyManager } = require('./proxy-manager');

// Initialize the proxy manager
const proxyManager = new ProxyManager({
  minProxies: 20,
  proxyProviderUrls: ['https://your-proxy-provider.com/proxies']
});

// Initialize (loads proxies, runs health checks)
await proxyManager.initialize();

// Use a proxy for a request
const result = await proxyManager.withProxy(async (proxy) => {
  // proxy contains host, port, protocol, auth information
  console.log(`Using proxy: ${proxy.host}:${proxy.port}`);
  
  // Use the proxy in your request
  const response = await makeRequestWithProxy(url, proxy);
  return response.data;
});

// Stop the proxy manager when done
await proxyManager.stop();
```

### Integration with Puppeteer

The Proxy Manager is integrated with Puppeteer in the `XScraper` class:

```javascript
// Launch a browser with a proxy
const { browser, proxyDetails } = await scraper.getBrowser();

// Puppeteer automatically uses the proxy for all requests
const page = await browser.newPage();

// If proxy requires authentication
if (proxyDetails && proxyDetails.auth) {
  await page.authenticate({
    username: proxyDetails.auth.username,
    password: proxyDetails.auth.password
  });
}
```

## Proxy Format

Each proxy is represented as a JavaScript object:

```javascript
{
  host: '123.45.67.89',  // Proxy hostname or IP
  port: 8080,            // Proxy port
  protocol: 'http',      // Protocol (http, https, socks4, socks5)
  auth: {                // Optional authentication
    username: 'user',
    password: 'pass'
  },
  id: '123.45.67.89:8080:user',  // Generated unique ID
  added: '2023-03-27T12:34:56Z', // Timestamp when added
  healthy: true,         // Current health status
  lastCheck: '2023-03-27T12:40:00Z', // Last health check time
  responseTime: 250,     // Last response time in ms
  lastError: null        // Last error message if any
}
```

## Obtaining Proxies

To use this service effectively, you need to obtain proxies from:

1. **Commercial Proxy Providers**: Services like Bright Data, Oxylabs, Smartproxy, etc.
2. **Data Center Proxies**: Less expensive but more likely to be detected
3. **Residential Proxies**: More expensive but less likely to be blocked
4. **Rotating Proxies**: Services that automatically rotate IPs

In the `.env` file, you can specify proxy provider URLs that return lists of proxies in various formats.

## Testing

A test script is provided to verify proxy rotation functionality:

```bash
npm run test:proxy
```

The test script (`test-proxy-rotation.js`) demonstrates:
- Initializing the proxy manager
- Adding test proxies
- Making multiple requests through different proxies
- Observing the rotation behavior

## Maintenance

Regular maintenance tasks:

1. **Update Proxy Sources**: Regularly update proxy provider URLs if they change
2. **Monitor Proxy Health**: Check logs for persistent proxy failures
3. **Adjust Throttling**: Fine-tune request intervals based on X's rate limiting
4. **Optimize Pool Size**: Adjust minimum proxy count based on scraping volume

## Troubleshooting

Common issues and solutions:

- **All Proxies Unhealthy**: Check proxy provider service or internet connectivity
- **High Error Rates**: May indicate X has changed their detection patterns
- **Slow Response Times**: May require adjusting proxy health check timeouts
- **Authentication Failures**: Verify proxy credentials are correct

## Extending

The Proxy Rotation Service can be extended in several ways:

1. **Additional Proxy Providers**: Implement custom provider support
2. **Geographic Filtering**: Select proxies based on geographic location
3. **Performance Metrics**: Track and optimize proxy performance
4. **Advanced Rotation Strategies**: Implement more sophisticated rotation algorithms

## Security Considerations

- Proxies with authentication credentials are stored in the proxies.json file
- Ensure this file has appropriate file permissions
- Consider encrypting sensitive proxy details
- Be cautious about sharing logs as they may contain proxy information

## Compliance

When using this service, ensure you're complying with:

1. X's Terms of Service
2. Proxy provider terms and conditions
3. Relevant laws regarding web scraping in your jurisdiction

## Dependencies

- `axios`: For making HTTP requests (health checks)
- `p-queue`: For request throttling
- `winston`: For logging
- `fs`: For proxy storage 