const { logger } = require('../../utils/logger');
const crypto = require('crypto');

/**
 * Manages alerts for X account metrics
 */
class AlertManager {
  /**
   * Initialize the alert manager
   */
  constructor(config = {}) {
    this.log = logger.child({ module: 'AlertManager' });
    this.alerts = {};
    this.triggeredAlerts = [];
    this.storage = config.storageType || 'memory';
    this.initialized = false;
    
    this.log.info('Alert manager initialized', { storageType: this.storage });
  }

  /**
   * Initialize the alert storage
   */
  async initialize() {
    if (this.initialized) {
      this.log.warn('Alert manager already initialized');
      return;
    }

    try {
      // In a real implementation, this would connect to the database
      // or load from a file, etc.
      
      this.alerts = {}; // Reset alerts
      this.triggeredAlerts = []; // Reset triggered alerts
      
      // Add some test alerts if in memory mode and no alerts exist
      if (this.storage === 'memory') {
        await this.addTestAlerts();
      }
      
      this.initialized = true;
      this.log.info('Alert manager initialized successfully');
      return true;
    } catch (error) {
      this.log.error('Failed to initialize alert manager', { error });
      throw error;
    }
  }
  
  /**
   * Add test alerts for development
   */
  async addTestAlerts() {
    const testAlerts = [
      {
        accountId: 'fc501cc91cc2b9d7d296a4a2736f297c', // md5 of 'elonmusk'
        metricType: 'followers',
        condition: 'gt',
        threshold: 133000000,
        timeWindow: '24h',
        notificationType: 'log',
        notificationConfig: {},
        description: 'Alert when Elon Musk has more than 133M followers',
        active: true
      },
      {
        accountId: 'fc501cc91cc2b9d7d296a4a2736f297c', // md5 of 'elonmusk'
        metricType: 'engagement.avgLikes',
        condition: 'lt',
        threshold: 100000,
        timeWindow: '24h',
        notificationType: 'log',
        notificationConfig: {},
        description: 'Alert when Elon Musk average likes drops below 100k',
        active: true
      }
    ];
    
    for (const alert of testAlerts) {
      await this.createAlert(alert);
    }
    
    this.log.info('Added test alerts', { count: testAlerts.length });
  }
  
  /**
   * Create a new alert
   */
  async createAlert(alertData) {
    if (!alertData.accountId || !alertData.metricType || !alertData.condition || alertData.threshold === undefined) {
      throw new Error('accountId, metricType, condition, and threshold are required');
    }
    
    try {
      // Create the alert
      const now = new Date().toISOString();
      const alert = {
        id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        accountId: alertData.accountId,
        metricType: alertData.metricType,
        condition: alertData.condition,
        threshold: alertData.threshold,
        timeWindow: alertData.timeWindow || '24h',
        notificationType: alertData.notificationType || 'log',
        notificationConfig: alertData.notificationConfig || {},
        description: alertData.description || `Alert for ${alertData.metricType} ${alertData.condition} ${alertData.threshold}`,
        active: alertData.active !== undefined ? alertData.active : true,
        lastTriggered: null,
        createdAt: now,
        updatedAt: now
      };
      
      // Save the alert
      this.alerts[alert.id] = alert;
      
      this.log.info('Alert created', { 
        id: alert.id, 
        accountId: alert.accountId, 
        metricType: alert.metricType, 
        condition: alert.condition,
        threshold: alert.threshold
      });
      
      return alert;
    } catch (error) {
      this.log.error('Error creating alert', { error, alertData });
      throw error;
    }
  }
  
  /**
   * Update an existing alert
   */
  async updateAlert(id, updateData) {
    // Check if alert exists
    if (!this.alerts[id]) {
      this.log.warn('Alert not found for update', { id });
      throw new Error('Alert not found');
    }
    
    try {
      // Update allowed fields
      const allowedFields = [
        'accountId', 'metricType', 'condition', 'threshold', 
        'timeWindow', 'notificationType', 'notificationConfig', 
        'description', 'active'
      ];
      
      const alert = this.alerts[id];
      let updated = false;
      
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          alert[field] = updateData[field];
          updated = true;
        }
      }
      
      if (updated) {
        alert.updatedAt = new Date().toISOString();
        this.log.info('Alert updated', { id, accountId: alert.accountId });
      } else {
        this.log.debug('No changes to alert', { id });
      }
      
      return alert;
    } catch (error) {
      this.log.error('Error updating alert', { error, id, updateData });
      throw error;
    }
  }
  
  /**
   * Delete an alert
   */
  async deleteAlert(id) {
    // Check if alert exists
    if (!this.alerts[id]) {
      this.log.warn('Alert not found for deletion', { id });
      throw new Error('Alert not found');
    }
    
    try {
      // Delete the alert
      const accountId = this.alerts[id].accountId;
      delete this.alerts[id];
      
      this.log.info('Alert deleted', { id, accountId });
      
      return { success: true, id, accountId };
    } catch (error) {
      this.log.error('Error deleting alert', { error, id });
      throw error;
    }
  }
  
  /**
   * Get an alert by ID
   */
  async getAlertById(id) {
    return this.alerts[id] || null;
  }
  
  /**
   * Get all alerts with optional filtering
   */
  async getAlerts(filters = {}) {
    let alerts = Object.values(this.alerts);
    
    // Filter by active status
    if (filters.active !== undefined) {
      alerts = alerts.filter(alert => alert.active === filters.active);
    }
    
    // Filter by account ID
    if (filters.accountId) {
      alerts = alerts.filter(alert => alert.accountId === filters.accountId);
    }
    
    return alerts;
  }
  
  /**
   * Process metrics against all active alerts
   */
  async processMetrics(metricsData) {
    if (!Array.isArray(metricsData) || metricsData.length === 0) {
      this.log.debug('No metrics to process');
      return [];
    }
    
    try {
      // Get all active alerts
      const activeAlerts = await this.getAlerts({ active: true });
      
      if (activeAlerts.length === 0) {
        this.log.debug('No active alerts to process');
        return [];
      }
      
      const triggeredAlerts = [];
      
      // Check each metric against all matching alerts
      for (const metric of metricsData) {
        const accountId = metric.accountId;
        
        // Get alerts for this account
        const accountAlerts = activeAlerts.filter(alert => alert.accountId === accountId);
        
        if (accountAlerts.length === 0) {
          continue;
        }
        
        // Check each alert against the metrics
        for (const alert of accountAlerts) {
          const isTriggered = this.checkAlertCondition(alert, metric);
          
          if (isTriggered) {
            // Alert is triggered, record it
            const triggeredAlert = {
              id: `triggered-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              alertId: alert.id,
              accountId: alert.accountId,
              metricType: alert.metricType,
              condition: alert.condition,
              threshold: alert.threshold,
              actualValue: this.getMetricValue(metric, alert.metricType),
              timestamp: new Date().toISOString(),
              metricTimestamp: metric.timestamp
            };
            
            // Update the alert's lastTriggered timestamp
            alert.lastTriggered = triggeredAlert.timestamp;
            
            // Add to triggered alerts list
            this.triggeredAlerts.push(triggeredAlert);
            triggeredAlerts.push(triggeredAlert);
            
            // Send the alert notification
            await this.sendAlertNotification(alert, triggeredAlert);
          }
        }
      }
      
      if (triggeredAlerts.length > 0) {
        this.log.info('Alerts triggered', { count: triggeredAlerts.length });
      } else {
        this.log.debug('No alerts triggered');
      }
      
      return triggeredAlerts;
    } catch (error) {
      this.log.error('Error processing metrics against alerts', { error });
      throw error;
    }
  }
  
  /**
   * Check if an alert condition is met
   */
  checkAlertCondition(alert, metric) {
    try {
      const metricValue = this.getMetricValue(metric, alert.metricType);
      
      if (metricValue === undefined || metricValue === null) {
        return false;
      }
      
      const threshold = alert.threshold;
      
      // Check the condition
      switch (alert.condition) {
        case 'gt':
          return metricValue > threshold;
        case 'lt':
          return metricValue < threshold;
        case 'gte':
          return metricValue >= threshold;
        case 'lte':
          return metricValue <= threshold;
        case 'eq':
          return metricValue === threshold;
        case 'ne':
          return metricValue !== threshold;
        default:
          this.log.warn('Unknown alert condition', { condition: alert.condition });
          return false;
      }
    } catch (error) {
      this.log.error('Error checking alert condition', { 
        error, 
        alertId: alert.id, 
        metricType: alert.metricType 
      });
      return false;
    }
  }
  
  /**
   * Extract a metric value from the metrics data
   */
  getMetricValue(metric, metricType) {
    if (!metric || !metric.metrics) {
      return null;
    }
    
    // Handle dotted notation for nested properties
    if (metricType.includes('.')) {
      const parts = metricType.split('.');
      let value = metric.metrics;
      
      for (const part of parts) {
        if (value && value[part] !== undefined) {
          value = value[part];
        } else {
          return null;
        }
      }
      
      return value;
    }
    
    return metric.metrics[metricType];
  }
  
  /**
   * Send alert notification
   */
  async sendAlertNotification(alert, triggeredAlert) {
    try {
      // Get notification type
      const notificationType = alert.notificationType || 'log';
      
      // Format the alert message
      const message = `Alert: ${alert.description}. Value: ${triggeredAlert.actualValue} ${alert.condition} ${alert.threshold} for account ${triggeredAlert.accountId}`;
      
      // Send notification based on type
      switch (notificationType) {
        case 'log':
          this.log.warn('Alert triggered', { 
            alertId: alert.id,
            message,
            accountId: triggeredAlert.accountId,
            metricType: triggeredAlert.metricType,
            condition: triggeredAlert.condition,
            threshold: triggeredAlert.threshold,
            actualValue: triggeredAlert.actualValue
          });
          break;
        case 'email':
          // In a real implementation, this would send an email
          this.log.info('Would send email alert', { 
            to: alert.notificationConfig.email,
            subject: 'X Tracker Alert',
            message
          });
          break;
        case 'webhook':
          // In a real implementation, this would call a webhook
          this.log.info('Would call webhook', { 
            url: alert.notificationConfig.url,
            method: 'POST',
            payload: {
              alert,
              triggered: triggeredAlert,
              message
            }
          });
          break;
        default:
          this.log.warn('Unknown notification type', { notificationType });
      }
      
      return true;
    } catch (error) {
      this.log.error('Error sending alert notification', { 
        error, 
        alertId: alert.id,
        triggeredAlertId: triggeredAlert.id
      });
      return false;
    }
  }
  
  /**
   * Get triggered alerts history
   */
  async getTriggeredAlerts(filters = {}, limit = 100) {
    try {
      let triggered = [...this.triggeredAlerts];
      
      // Filter by account ID
      if (filters.accountId) {
        triggered = triggered.filter(alert => alert.accountId === filters.accountId);
      }
      
      // Filter by alert ID
      if (filters.alertId) {
        triggered = triggered.filter(alert => alert.alertId === filters.alertId);
      }
      
      // Filter by date range
      if (filters.from) {
        triggered = triggered.filter(alert => new Date(alert.timestamp) >= filters.from);
      }
      
      if (filters.to) {
        triggered = triggered.filter(alert => new Date(alert.timestamp) <= filters.to);
      }
      
      // Sort by timestamp (newest first)
      triggered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Limit the results
      return triggered.slice(0, limit);
    } catch (error) {
      this.log.error('Error getting triggered alerts', { error, filters });
      throw error;
    }
  }
}

module.exports = { AlertManager }; 