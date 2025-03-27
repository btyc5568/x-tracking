const express = require('express');
const { logger } = require('../../utils/logger');
const { MetricsCollector } = require('../../services/scraper/metrics-collector');
const Account = require('../../models/Account');

const router = express.Router();
const log = logger.child({ module: 'MetricsAPI' });

// Initialize metrics collector with memory storage to ensure it always works
// even if MongoDB connection fails
const metricsCollector = new MetricsCollector({ 
  storageType: process.env.METRICS_STORAGE_TYPE || 'memory'
});

// Initialize metrics collector
(async () => {
  try {
    await metricsCollector.initialize();
    log.info('Metrics collector initialized successfully');
  } catch (error) {
    log.error('Failed to initialize metrics collector', { error });
    
    // If initialization fails with MongoDB, try with memory storage as fallback
    if (metricsCollector.storage !== 'memory') {
      log.info('Attempting to initialize metrics collector with memory storage as fallback');
      metricsCollector.storage = 'memory';
      try {
        await metricsCollector.initialize();
        log.info('Metrics collector initialized with memory storage fallback');
      } catch (fallbackError) {
        log.error('Failed to initialize metrics collector with fallback', { error: fallbackError });
      }
    }
  }
})();

/**
 * @route   GET /api/metrics/account/:accountId
 * @desc    Get metrics for a specific account
 * @access  Public
 */
router.get('/account/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { from, to, limit, metrics } = req.query;
    
    // Parse date range if provided
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days ago
    const toDate = to ? new Date(to) : new Date(); // Default to now
    
    // Parse limit if provided
    const limitNum = limit ? parseInt(limit, 10) : 100;
    
    // Parse metrics if provided
    const metricsArray = metrics ? metrics.split(',') : null;
    
    const accountMetrics = await metricsCollector.getAccountMetrics(accountId, {
      from: fromDate,
      to: toDate,
      limit: limitNum,
      metrics: metricsArray
    });
    
    return res.json({ 
      success: true, 
      data: accountMetrics
    });
  } catch (error) {
    log.error('Error getting account metrics', { error, accountId: req.params.accountId, query: req.query });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error retrieving account metrics' 
    });
  }
});

/**
 * @route   GET /api/metrics/accounts
 * @desc    Get metrics for multiple accounts
 * @access  Public
 */
router.get('/accounts', async (req, res) => {
  try {
    const { ids, from, to, limit, metrics } = req.query;
    
    if (!ids) {
      return res.status(400).json({ 
        success: false, 
        error: 'Account IDs are required' 
      });
    }
    
    // Parse account IDs
    const accountIds = ids.split(',');
    
    // Parse date range if provided
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days ago
    const toDate = to ? new Date(to) : new Date(); // Default to now
    
    // Parse limit if provided
    const limitNum = limit ? parseInt(limit, 10) : 100;
    
    // Parse metrics if provided
    const metricsArray = metrics ? metrics.split(',') : null;
    
    const results = {};
    
    // Get metrics for each account
    await Promise.all(accountIds.map(async (accountId) => {
      try {
        const accountMetrics = await metricsCollector.getAccountMetrics(accountId, {
          from: fromDate,
          to: toDate,
          limit: limitNum,
          metrics: metricsArray
        });
        
        results[accountId] = accountMetrics;
      } catch (error) {
        log.error('Error getting metrics for account', { error, accountId });
        results[accountId] = { error: 'Failed to retrieve metrics' };
      }
    }));
    
    return res.json({ 
      success: true, 
      data: results
    });
  } catch (error) {
    log.error('Error getting metrics for multiple accounts', { error, query: req.query });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error retrieving account metrics' 
    });
  }
});

/**
 * @route   GET /api/metrics/username/:username
 * @desc    Get metrics for an account by username
 * @access  Public
 */
router.get('/username/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { from, to, limit, metrics } = req.query;
    
    // Find account by username
    let account;
    
    // Try first with the account manager if available
    const orchestrator = req.app.get('scraperOrchestrator');
    if (orchestrator && orchestrator.accountManager) {
      account = await orchestrator.accountManager.findAccountByUsername(username);
    }
    
    // If not found or account manager not available, try with the database
    if (!account) {
      account = await Account.findOne({ username }).lean();
    }
    
    if (!account) {
      return res.status(404).json({ 
        success: false, 
        error: 'Account not found' 
      });
    }
    
    // Get the account ID
    const accountId = account.id || account._id;
    
    // Parse date range if provided
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days ago
    const toDate = to ? new Date(to) : new Date(); // Default to now
    
    // Parse limit if provided
    const limitNum = limit ? parseInt(limit, 10) : 100;
    
    // Parse metrics if provided
    const metricsArray = metrics ? metrics.split(',') : null;
    
    const accountMetrics = await metricsCollector.getAccountMetrics(accountId, {
      from: fromDate,
      to: toDate,
      limit: limitNum,
      metrics: metricsArray
    });
    
    return res.json({ 
      success: true, 
      account,
      data: accountMetrics
    });
  } catch (error) {
    log.error('Error getting metrics by username', { 
      error, 
      username: req.params.username, 
      query: req.query 
    });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error retrieving account metrics' 
    });
  }
});

/**
 * @route   GET /api/metrics/latest
 * @desc    Get latest metrics for all accounts
 * @access  Public
 */
router.get('/latest', async (req, res) => {
  try {
    const { limit, metrics } = req.query;
    
    // Parse limit if provided
    const limitNum = limit ? parseInt(limit, 10) : 100;
    
    // Parse metrics if provided
    const metricsArray = metrics ? metrics.split(',') : null;
    
    const latestMetrics = await metricsCollector.getLatestMetrics({
      limit: limitNum,
      metrics: metricsArray
    });
    
    return res.json({ 
      success: true, 
      data: latestMetrics
    });
  } catch (error) {
    log.error('Error getting latest metrics', { error, query: req.query });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error retrieving latest metrics' 
    });
  }
});

/**
 * @route   GET /api/metrics/latest/:accountId
 * @desc    Get latest metrics for a specific account
 * @access  Public
 */
router.get('/latest/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    const latestMetrics = await metricsCollector.getLatestMetricsForAccount(accountId);
    
    if (!latestMetrics) {
      return res.status(404).json({ 
        success: false, 
        error: 'No metrics found for this account' 
      });
    }
    
    return res.json({ 
      success: true, 
      data: latestMetrics
    });
  } catch (error) {
    log.error('Error getting latest metrics for account', { 
      error, 
      accountId: req.params.accountId 
    });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error retrieving latest metrics' 
    });
  }
});

/**
 * @route   GET /api/metrics/analysis/growth
 * @desc    Analyze growth metrics for accounts
 * @access  Public
 */
router.get('/analysis/growth', async (req, res) => {
  try {
    const { ids, from, to, groupBy } = req.query;
    
    if (!ids) {
      return res.status(400).json({ 
        success: false, 
        error: 'Account IDs are required' 
      });
    }
    
    // Parse account IDs
    const accountIds = ids.split(',');
    
    // Parse date range if provided
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days ago
    const toDate = to ? new Date(to) : new Date(); // Default to now
    
    // Parse groupBy if provided
    const groupByValue = groupBy || 'day'; // Default to day
    
    const growthAnalysis = await metricsCollector.getMetricsAnalysis('growth', {
      accountIds,
      from: fromDate,
      to: toDate,
      groupBy: groupByValue
    });
    
    return res.json({ 
      success: true, 
      data: growthAnalysis
    });
  } catch (error) {
    log.error('Error analyzing growth metrics', { error, query: req.query });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error analyzing growth metrics' 
    });
  }
});

/**
 * @route   GET /api/metrics/analysis/engagement
 * @desc    Analyze engagement metrics for accounts
 * @access  Public
 */
router.get('/analysis/engagement', async (req, res) => {
  try {
    const { ids, from, to, groupBy } = req.query;
    
    if (!ids) {
      return res.status(400).json({ 
        success: false, 
        error: 'Account IDs are required' 
      });
    }
    
    // Parse account IDs
    const accountIds = ids.split(',');
    
    // Parse date range if provided
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days ago
    const toDate = to ? new Date(to) : new Date(); // Default to now
    
    // Parse groupBy if provided
    const groupByValue = groupBy || 'day'; // Default to day
    
    const engagementAnalysis = await metricsCollector.getMetricsAnalysis('engagement', {
      accountIds,
      from: fromDate,
      to: toDate,
      groupBy: groupByValue
    });
    
    return res.json({ 
      success: true, 
      data: engagementAnalysis
    });
  } catch (error) {
    log.error('Error analyzing engagement metrics', { error, query: req.query });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error analyzing engagement metrics' 
    });
  }
});

/**
 * @route   GET /api/metrics/analysis/reach
 * @desc    Analyze reach metrics for accounts
 * @access  Public
 */
router.get('/analysis/reach', async (req, res) => {
  try {
    const { ids, from, to, groupBy } = req.query;
    
    if (!ids) {
      return res.status(400).json({ 
        success: false, 
        error: 'Account IDs are required' 
      });
    }
    
    // Parse account IDs
    const accountIds = ids.split(',');
    
    // Parse date range if provided
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days ago
    const toDate = to ? new Date(to) : new Date(); // Default to now
    
    // Parse groupBy if provided
    const groupByValue = groupBy || 'day'; // Default to day
    
    const reachAnalysis = await metricsCollector.getMetricsAnalysis('reach', {
      accountIds,
      from: fromDate,
      to: toDate,
      groupBy: groupByValue
    });
    
    return res.json({ 
      success: true, 
      data: reachAnalysis
    });
  } catch (error) {
    log.error('Error analyzing reach metrics', { error, query: req.query });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error analyzing reach metrics' 
    });
  }
});

/**
 * @route   GET /api/metrics/analysis/summary
 * @desc    Get a summary of metrics for accounts
 * @access  Public
 */
router.get('/analysis/summary', async (req, res) => {
  try {
    const { ids, from, to } = req.query;
    
    if (!ids) {
      return res.status(400).json({ 
        success: false, 
        error: 'Account IDs are required' 
      });
    }
    
    // Parse account IDs
    const accountIds = ids.split(',');
    
    // Parse date range if provided
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days ago
    const toDate = to ? new Date(to) : new Date(); // Default to now
    
    const summary = await metricsCollector.getMetricsAnalysis('summary', {
      accountIds,
      from: fromDate,
      to: toDate
    });
    
    return res.json({ 
      success: true, 
      data: summary
    });
  } catch (error) {
    log.error('Error getting metrics summary', { error, query: req.query });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error retrieving metrics summary' 
    });
  }
});

/**
 * @route   POST /api/metrics
 * @desc    Manually add metrics for an account
 * @access  Public
 */
router.post('/', async (req, res) => {
  try {
    const { accountId, metrics, timestamp } = req.body;
    
    if (!accountId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Account ID is required' 
      });
    }
    
    if (!metrics) {
      return res.status(400).json({ 
        success: false, 
        error: 'Metrics data is required' 
      });
    }
    
    // Create metrics timestamp if not provided
    const metricsTimestamp = timestamp ? new Date(timestamp) : new Date();
    
    const savedMetrics = await metricsCollector.saveMetrics(
      accountId,
      metrics,
      metricsTimestamp
    );
    
    return res.json({ 
      success: true, 
      data: savedMetrics
    });
  } catch (error) {
    log.error('Error saving metrics', { error, body: req.body });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error saving metrics' 
    });
  }
});

module.exports = router; 