const express = require('express');
const { logger } = require('../../utils/logger');
const { AlertManager } = require('../../services/scraper/alert-manager');

const router = express.Router();
const log = logger.child({ module: 'AlertsAPI' });

// Initialize alert manager
const alertManager = new AlertManager({
  // Config would be passed from the orchestrator in a real implementation
  storageType: process.env.ALERTS_STORAGE_TYPE || 'memory'
});

// Initialize alert manager
(async () => {
  try {
    await alertManager.initialize();
    log.info('Alert manager initialized successfully');
  } catch (error) {
    log.error('Failed to initialize alert manager', { error });
  }
})();

/**
 * @route   GET /api/alerts
 * @desc    Get all alerts
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const { accountId, active } = req.query;
    
    let filters = {};
    
    if (accountId) {
      filters.accountId = accountId;
    }
    
    if (active !== undefined) {
      filters.active = active === 'true';
    }
    
    const alerts = await alertManager.getAlerts(filters);
    
    return res.json({ 
      success: true, 
      data: alerts
    });
  } catch (error) {
    log.error('Error getting alerts', { error, query: req.query });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error retrieving alerts'
    });
  }
});

/**
 * @route   GET /api/alerts/:alertId
 * @desc    Get alert by ID
 * @access  Public
 */
router.get('/:alertId', async (req, res) => {
  try {
    const { alertId } = req.params;
    
    const alert = await alertManager.getAlertById(alertId);
    
    if (!alert) {
      return res.status(404).json({ 
        success: false, 
        error: 'Alert not found'
      });
    }
    
    return res.json({ 
      success: true, 
      data: alert
    });
  } catch (error) {
    log.error('Error getting alert by ID', { error, alertId: req.params.alertId });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error retrieving alert'
    });
  }
});

/**
 * @route   POST /api/alerts
 * @desc    Create a new alert
 * @access  Public
 */
router.post('/', async (req, res) => {
  try {
    const {
      accountId,
      metricType,
      condition,
      threshold,
      timeWindow,
      notificationType,
      notificationConfig,
      description,
      active
    } = req.body;
    
    // Validate required fields
    if (!accountId || !metricType || !condition || threshold === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: accountId, metricType, condition, and threshold are required'
      });
    }
    
    // Create the alert
    const alertData = {
      accountId,
      metricType,
      condition,
      threshold,
      timeWindow: timeWindow || '24h', // Default to 24 hours
      notificationType: notificationType || 'log', // Default to log
      notificationConfig: notificationConfig || {},
      description: description || `Alert for ${metricType} ${condition} ${threshold}`,
      active: active !== undefined ? active : true // Default to active
    };
    
    const newAlert = await alertManager.createAlert(alertData);
    
    return res.status(201).json({
      success: true,
      data: newAlert
    });
  } catch (error) {
    log.error('Error creating alert', { error, body: req.body });
    return res.status(500).json({
      success: false,
      error: 'Server error creating alert'
    });
  }
});

/**
 * @route   PUT /api/alerts/:alertId
 * @desc    Update an alert
 * @access  Public
 */
router.put('/:alertId', async (req, res) => {
  try {
    const { alertId } = req.params;
    const updateData = req.body;
    
    // Check if alert exists
    const existingAlert = await alertManager.getAlertById(alertId);
    
    if (!existingAlert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }
    
    // Update the alert
    const updatedAlert = await alertManager.updateAlert(alertId, updateData);
    
    return res.json({
      success: true,
      data: updatedAlert
    });
  } catch (error) {
    log.error('Error updating alert', { error, alertId: req.params.alertId, body: req.body });
    return res.status(500).json({
      success: false,
      error: 'Server error updating alert'
    });
  }
});

/**
 * @route   DELETE /api/alerts/:alertId
 * @desc    Delete an alert
 * @access  Public
 */
router.delete('/:alertId', async (req, res) => {
  try {
    const { alertId } = req.params;
    
    // Check if alert exists
    const existingAlert = await alertManager.getAlertById(alertId);
    
    if (!existingAlert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }
    
    // Delete the alert
    await alertManager.deleteAlert(alertId);
    
    return res.json({
      success: true,
      message: 'Alert deleted successfully'
    });
  } catch (error) {
    log.error('Error deleting alert', { error, alertId: req.params.alertId });
    return res.status(500).json({
      success: false,
      error: 'Server error deleting alert'
    });
  }
});

/**
 * @route   POST /api/alerts/:alertId/toggle
 * @desc    Toggle alert active status
 * @access  Public
 */
router.post('/:alertId/toggle', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { active } = req.body;
    
    if (active === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Active status is required'
      });
    }
    
    // Check if alert exists
    const existingAlert = await alertManager.getAlertById(alertId);
    
    if (!existingAlert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }
    
    // Update just the active status
    const updatedAlert = await alertManager.updateAlert(alertId, { active });
    
    return res.json({
      success: true,
      data: updatedAlert
    });
  } catch (error) {
    log.error('Error toggling alert status', { error, alertId: req.params.alertId, body: req.body });
    return res.status(500).json({
      success: false,
      error: 'Server error toggling alert status'
    });
  }
});

/**
 * @route   GET /api/alerts/account/:accountId
 * @desc    Get alerts for a specific account
 * @access  Public
 */
router.get('/account/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { active } = req.query;
    
    let filters = { accountId };
    
    if (active !== undefined) {
      filters.active = active === 'true';
    }
    
    const alerts = await alertManager.getAlerts(filters);
    
    return res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    log.error('Error getting alerts for account', { 
      error, 
      accountId: req.params.accountId, 
      query: req.query 
    });
    return res.status(500).json({
      success: false,
      error: 'Server error retrieving alerts for account'
    });
  }
});

/**
 * @route   POST /api/alerts/process
 * @desc    Manually process alerts against latest metrics
 * @access  Public
 */
router.post('/process', async (req, res) => {
  try {
    const { accountId } = req.body;
    
    // Get the orchestrator
    const orchestrator = req.app.get('scraperOrchestrator');
    
    if (!orchestrator || !orchestrator.metricsCollector) {
      return res.status(500).json({
        success: false,
        error: 'Metrics collector not available'
      });
    }
    
    let metrics;
    
    if (accountId) {
      // Get latest metrics for specific account
      metrics = await orchestrator.metricsCollector.getLatestMetricsForAccount(accountId);
      
      if (!metrics) {
        return res.status(404).json({
          success: false,
          error: 'No metrics found for account'
        });
      }
      
      // Process alerts for the account
      const triggered = await alertManager.processMetrics([metrics]);
      
      return res.json({
        success: true,
        data: {
          processed: 1,
          triggered
        }
      });
    } else {
      // Get latest metrics for all accounts
      metrics = await orchestrator.metricsCollector.getLatestMetrics();
      
      // Process alerts for all accounts
      const triggered = await alertManager.processMetrics(metrics);
      
      return res.json({
        success: true,
        data: {
          processed: metrics.length,
          triggered
        }
      });
    }
  } catch (error) {
    log.error('Error processing alerts', { error, body: req.body });
    return res.status(500).json({
      success: false,
      error: 'Server error processing alerts'
    });
  }
});

/**
 * @route   GET /api/alerts/triggered
 * @desc    Get triggered alert history
 * @access  Public
 */
router.get('/triggered', async (req, res) => {
  try {
    const { accountId, alertId, from, to, limit } = req.query;
    
    // Parse filters
    let filters = {};
    
    if (accountId) {
      filters.accountId = accountId;
    }
    
    if (alertId) {
      filters.alertId = alertId;
    }
    
    // Parse date range if provided
    if (from) {
      filters.from = new Date(from);
    }
    
    if (to) {
      filters.to = new Date(to);
    }
    
    // Parse limit if provided
    const limitNum = limit ? parseInt(limit, 10) : 100;
    
    const triggeredAlerts = await alertManager.getTriggeredAlerts(filters, limitNum);
    
    return res.json({
      success: true,
      data: triggeredAlerts
    });
  } catch (error) {
    log.error('Error getting triggered alerts', { error, query: req.query });
    return res.status(500).json({
      success: false,
      error: 'Server error retrieving triggered alerts'
    });
  }
});

module.exports = router; 