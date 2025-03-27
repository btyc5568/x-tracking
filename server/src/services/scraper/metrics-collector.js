const { logger } = require('../../utils/logger');
const Metric = require('../../models/Metric');
const Account = require('../../models/Account');

/**
 * Collects and stores metrics from X account scraping
 */
class MetricsCollector {
  /**
   * Initialize the metrics collector
   */
  constructor(config = {}) {
    this.log = logger.child({ module: 'MetricsCollector' });
    this.metrics = {};
    this.storage = config.storageType || 'mongodb';
    this.initialized = false;
    
    this.log.info('Metrics collector initialized', { storageType: this.storage });
  }

  /**
   * Initialize the metrics storage
   */
  async initialize() {
    if (this.initialized) {
      this.log.warn('Metrics collector already initialized');
      return;
    }

    try {
      // If using in-memory storage, set up the metrics object
      if (this.storage === 'memory') {
        this.metrics = {}; // Reset metrics
        
        // Add some test metrics if in memory mode
        await this.addTestMetrics();
        this.initialized = true;
        this.log.info('Metrics collector initialized with memory storage');
        return true;
      } else if (this.storage === 'mongodb') {
        try {
          // Check if MongoDB is available by making a simple query
          const count = await Metric.estimatedDocumentCount();
          this.log.info('MongoDB connection successful', { count });
          
          // Add test metrics if no metrics exist
          if (count === 0) {
            this.log.info('No metrics found in MongoDB, adding test metrics');
            await this.addTestMetrics();
          }
          
          this.initialized = true;
          this.log.info('Metrics collector initialized with MongoDB storage');
          return true;
        } catch (dbError) {
          this.log.error('MongoDB connection failed, falling back to memory storage', { error: dbError });
          this.storage = 'memory';
          this.metrics = {};
          await this.addTestMetrics();
          this.initialized = true;
          return true;
        }
      }
      
      this.initialized = true;
      this.log.info('Metrics collector initialized successfully');
      return true;
    } catch (error) {
      this.log.error('Failed to initialize metrics collector', { error });
      throw error;
    }
  }
  
  /**
   * Add test metrics for development
   */
  async addTestMetrics() {
    const testMetrics = [
      {
        accountId: 'fc501cc91cc2b9d7d296a4a2736f297c', // md5 of 'elonmusk'
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        metrics: {
          followers: 132500000,
          following: 150,
          tweets: 45000,
          engagement: {
            avgLikes: 125000,
            avgRetweets: 15000,
            avgReplies: 8000
          }
        }
      },
      {
        accountId: 'fc501cc91cc2b9d7d296a4a2736f297c', // md5 of 'elonmusk'
        timestamp: new Date().toISOString(),
        metrics: {
          followers: 132650000,
          following: 151,
          tweets: 45100,
          engagement: {
            avgLikes: 130000,
            avgRetweets: 16500,
            avgReplies: 8500
          }
        }
      }
    ];
    
    for (const metric of testMetrics) {
      await this.saveMetrics(metric.accountId, metric.metrics, new Date(metric.timestamp));
    }
    
    this.log.info('Added test metrics', { count: testMetrics.length });
  }
  
  /**
   * Save metrics for an account
   */
  async saveMetrics(accountId, metricsData, timestamp = new Date()) {
    if (!accountId) {
      throw new Error('Account ID is required');
    }
    
    if (!metricsData) {
      throw new Error('Metrics data is required');
    }
    
    try {
      const timestampStr = timestamp.toISOString();
      
      // Create the metrics entry
      let metricsEntry;
      
      if (this.storage === 'memory') {
        // Initialize account metrics object if it doesn't exist
        if (!this.metrics[accountId]) {
          this.metrics[accountId] = [];
        }
        
        // Create the metrics entry for memory storage
        metricsEntry = {
          id: `${accountId}-${Date.now()}`,
          accountId,
          timestamp: timestampStr,
          metrics: metricsData
        };
        
        // Add to the metrics array
        this.metrics[accountId].push(metricsEntry);
        
        // Sort by timestamp (newest first)
        this.metrics[accountId].sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        );
      } else {
        // Find the latest metrics for this account to calculate growth
        let previousMetrics = null;
        
        if (this.storage === 'mongodb') {
          previousMetrics = await Metric.findOne({ accountId })
            .sort({ timestamp: -1 })
            .lean();
        }
        
        // Find the account document to link metrics to account
        let accountDoc = null;
        try {
          accountDoc = await Account.findOne({ id: accountId });
        } catch (error) {
          this.log.warn('Could not find account document', { accountId, error: error.message });
        }
        
        // Create metrics document for MongoDB
        const metricDoc = new Metric({
          accountId,
          timestamp,
          followers: metricsData.followers || 0,
          following: metricsData.following || 0,
          tweets: metricsData.tweets || 0,
          engagement: {
            avgLikes: metricsData.engagement?.avgLikes || 0,
            avgRetweets: metricsData.engagement?.avgRetweets || 0,
            avgReplies: metricsData.engagement?.avgReplies || 0,
            avgViews: metricsData.engagement?.avgViews || 0
          },
          account: accountDoc?._id || null,
          metadata: {
            source: 'scraper',
            version: '1.0',
            previousMetrics: previousMetrics 
              ? {
                  followers: previousMetrics.followers,
                  tweets: previousMetrics.tweets,
                  timestamp: previousMetrics.timestamp
                }
              : null,
            raw: metricsData
          }
        });
        
        // Save to MongoDB
        await metricDoc.save();
        
        // Format the response
        metricsEntry = {
          id: metricDoc._id.toString(),
          accountId,
          timestamp: metricDoc.timestamp.toISOString(),
          metrics: {
            followers: metricDoc.followers,
            following: metricDoc.following,
            tweets: metricDoc.tweets,
            engagement: metricDoc.engagement
          }
        };
      }
      
      this.log.info('Metrics saved', { 
        accountId, 
        timestamp: timestampStr,
        storage: this.storage
      });
      
      return metricsEntry;
    } catch (error) {
      this.log.error('Error saving metrics', { error, accountId });
      throw error;
    }
  }
  
  /**
   * Get metrics for an account
   */
  async getAccountMetrics(accountId, options = {}) {
    if (!accountId) {
      throw new Error('Account ID is required');
    }
    
    const { 
      from = new Date(0), 
      to = new Date(), 
      limit = 100,
      metrics = null 
    } = options;
    
    try {
      let results = [];
      
      if (this.storage === 'memory') {
        // Check if we have metrics for this account
        if (!this.metrics[accountId] || this.metrics[accountId].length === 0) {
          return [];
        }
        
        // Filter metrics by date range
        const filteredMetrics = this.metrics[accountId].filter(entry => {
          const entryDate = new Date(entry.timestamp);
          return entryDate >= from && entryDate <= to;
        });
        
        // Sort by timestamp (newest first)
        filteredMetrics.sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        // Limit the number of results
        results = filteredMetrics.slice(0, limit);
        
        // Filter specific metrics if requested
        if (metrics && Array.isArray(metrics) && metrics.length > 0) {
          return results.map(entry => ({
            id: entry.id,
            accountId: entry.accountId,
            timestamp: entry.timestamp,
            metrics: this.filterMetricsFields(entry.metrics, metrics)
          }));
        }
      } else if (this.storage === 'mongodb') {
        // Build MongoDB query
        const query = {
          accountId,
          timestamp: { $gte: from, $lte: to }
        };
        
        // Execute query
        const metricDocs = await Metric.find(query)
          .sort({ timestamp: -1 })
          .limit(limit)
          .lean();
        
        // Format the results
        results = metricDocs.map(doc => ({
          id: doc._id.toString(),
          accountId: doc.accountId,
          timestamp: doc.timestamp.toISOString(),
          metrics: {
            followers: doc.followers,
            following: doc.following,
            tweets: doc.tweets,
            engagement: doc.engagement,
            sentiment: doc.sentiment
          },
          growth: doc.growth
        }));
        
        // Filter specific metrics if requested
        if (metrics && Array.isArray(metrics) && metrics.length > 0) {
          return results.map(entry => ({
            id: entry.id,
            accountId: entry.accountId,
            timestamp: entry.timestamp,
            metrics: this.filterMetricsFields(entry.metrics, metrics)
          }));
        }
      }
      
      return results;
    } catch (error) {
      this.log.error('Error getting account metrics', { error, accountId, options });
      throw error;
    }
  }
  
  /**
   * Get the latest metrics for an account
   */
  async getLatestMetricsForAccount(accountId) {
    if (!accountId) {
      throw new Error('Account ID is required');
    }
    
    try {
      if (this.storage === 'memory') {
        // Check if we have metrics for this account
        if (!this.metrics[accountId] || this.metrics[accountId].length === 0) {
          return null;
        }
        
        // Sort by timestamp (newest first)
        const sortedMetrics = [...this.metrics[accountId]].sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        // Return the latest metrics
        return sortedMetrics[0];
      } else if (this.storage === 'mongodb') {
        // Get the latest metrics from MongoDB
        const latestMetric = await Metric.findOne({ accountId })
          .sort({ timestamp: -1 })
          .lean();
        
        if (!latestMetric) {
          return null;
        }
        
        // Format the response
        return {
          id: latestMetric._id.toString(),
          accountId: latestMetric.accountId,
          timestamp: latestMetric.timestamp.toISOString(),
          metrics: {
            followers: latestMetric.followers,
            following: latestMetric.following,
            tweets: latestMetric.tweets,
            engagement: latestMetric.engagement,
            sentiment: latestMetric.sentiment
          },
          growth: {
            followersRate: latestMetric.metadata?.previousMetrics?.followers 
              ? (latestMetric.followers - latestMetric.metadata.previousMetrics.followers) / latestMetric.metadata.previousMetrics.followers 
              : 0,
            tweetsRate: latestMetric.metadata?.previousMetrics?.tweets
              ? (latestMetric.tweets - latestMetric.metadata.previousMetrics.tweets) / latestMetric.metadata.previousMetrics.tweets
              : 0
          }
        };
      }
      
      return null;
    } catch (error) {
      this.log.error('Error getting latest metrics for account', { error, accountId });
      throw error;
    }
  }
  
  /**
   * Get the latest metrics for all accounts
   */
  async getLatestMetrics(options = {}) {
    const { limit = 100, metrics = null } = options;
    
    try {
      let latestMetrics = [];
      
      if (this.storage === 'memory') {
        // Get all account IDs
        const accountIds = Object.keys(this.metrics);
        
        // Get latest metrics for each account
        for (const accountId of accountIds) {
          const latest = await this.getLatestMetricsForAccount(accountId);
          
          if (latest) {
            latestMetrics.push(latest);
          }
        }
      } else if (this.storage === 'mongodb') {
        // Get all unique accountIds
        const uniqueAccounts = await Metric.aggregate([
          { $sort: { timestamp: -1 } },
          { $group: { _id: "$accountId", doc: { $first: "$$ROOT" } } },
          { $replaceRoot: { newRoot: "$doc" } },
          { $limit: limit }
        ]);
        
        // Format the results
        latestMetrics = uniqueAccounts.map(doc => ({
          id: doc._id.toString(),
          accountId: doc.accountId,
          timestamp: doc.timestamp.toISOString(),
          metrics: {
            followers: doc.followers,
            following: doc.following,
            tweets: doc.tweets,
            engagement: doc.engagement,
            sentiment: doc.sentiment
          },
          growth: {
            followersRate: doc.metadata?.previousMetrics?.followers 
              ? (doc.followers - doc.metadata.previousMetrics.followers) / doc.metadata.previousMetrics.followers 
              : 0,
            tweetsRate: doc.metadata?.previousMetrics?.tweets
              ? (doc.tweets - doc.metadata.previousMetrics.tweets) / doc.metadata.previousMetrics.tweets
              : 0
          }
        }));
      }
      
      // Sort by timestamp (newest first)
      latestMetrics.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
      
      // Limit the number of results
      const limitedMetrics = latestMetrics.slice(0, limit);
      
      // Filter specific metrics if requested
      if (metrics && Array.isArray(metrics) && metrics.length > 0) {
        return limitedMetrics.map(entry => ({
          id: entry.id,
          accountId: entry.accountId,
          timestamp: entry.timestamp,
          metrics: this.filterMetricsFields(entry.metrics, metrics)
        }));
      }
      
      return limitedMetrics;
    } catch (error) {
      this.log.error('Error getting latest metrics', { error });
      throw error;
    }
  }
  
  /**
   * Get metrics analysis (growth, engagement, etc)
   */
  async getMetricsAnalysis(type, options = {}) {
    const { accountIds = null, from = new Date(0), to = new Date(), groupBy = 'day' } = options;
    
    try {
      // Validate analysis type
      const validTypes = ['growth', 'engagement', 'reach', 'summary'];
      if (!validTypes.includes(type)) {
        throw new Error(`Invalid analysis type. Valid types: ${validTypes.join(', ')}`);
      }
      
      // Get account IDs to analyze
      const idsToAnalyze = accountIds || Object.keys(this.metrics);
      
      if (idsToAnalyze.length === 0) {
        return { results: [] };
      }
      
      // Determine the analysis method based on type
      switch (type) {
        case 'growth':
          return this.analyzeGrowth(idsToAnalyze, from, to, groupBy);
        case 'engagement':
          return this.analyzeEngagement(idsToAnalyze, from, to, groupBy);
        case 'reach':
          return this.analyzeReach(idsToAnalyze, from, to, groupBy);
        case 'summary':
          return this.analyzeSummary(idsToAnalyze, from, to);
        default:
          throw new Error(`Analysis type not implemented: ${type}`);
      }
    } catch (error) {
      this.log.error('Error getting metrics analysis', { error, type, options });
      throw error;
    }
  }
  
  /**
   * Analyze account growth (followers, following, tweets)
   */
  async analyzeGrowth(accountIds, from, to, groupBy) {
    try {
      const results = {};
      
      for (const accountId of accountIds) {
        // Get metrics for the account within the time range
        const metrics = await this.getAccountMetrics(accountId, { 
          from, 
          to,
          limit: 1000 // Increase limit to get more data points
        });
        
        if (metrics.length < 2) {
          // Skip accounts with insufficient data points
          continue;
        }
        
        // Group metrics by the specified interval
        const groupedMetrics = this.groupMetricsByInterval(metrics, groupBy);
        
        // Calculate growth rates
        const growthAnalysis = {
          accountId,
          followers: this.calculateGrowthRate(groupedMetrics, 'followers'),
          following: this.calculateGrowthRate(groupedMetrics, 'following'),
          tweets: this.calculateGrowthRate(groupedMetrics, 'tweets'),
          timeline: groupedMetrics.map(group => ({
            date: group.date,
            metrics: {
              followers: group.metrics.followers,
              following: group.metrics.following,
              tweets: group.metrics.tweets
            }
          }))
        };
        
        results[accountId] = growthAnalysis;
      }
      
      return { results };
    } catch (error) {
      this.log.error('Error analyzing growth', { error, accountIds });
      throw error;
    }
  }
  
  /**
   * Analyze engagement metrics (likes, retweets, replies)
   */
  async analyzeEngagement(accountIds, from, to, groupBy) {
    try {
      const results = {};
      
      for (const accountId of accountIds) {
        // Get metrics for the account within the time range
        const metrics = await this.getAccountMetrics(accountId, { 
          from, 
          to,
          limit: 1000 // Increase limit to get more data points
        });
        
        if (metrics.length === 0) {
          // Skip accounts with no data points
          continue;
        }
        
        // Group metrics by the specified interval
        const groupedMetrics = this.groupMetricsByInterval(metrics, groupBy);
        
        // Calculate engagement metrics
        const engagementAnalysis = {
          accountId,
          avgLikes: this.calculateAverageEngagement(groupedMetrics, 'avgLikes'),
          avgRetweets: this.calculateAverageEngagement(groupedMetrics, 'avgRetweets'),
          avgReplies: this.calculateAverageEngagement(groupedMetrics, 'avgReplies'),
          timeline: groupedMetrics.map(group => ({
            date: group.date,
            metrics: {
              avgLikes: group.metrics.engagement?.avgLikes,
              avgRetweets: group.metrics.engagement?.avgRetweets,
              avgReplies: group.metrics.engagement?.avgReplies
            }
          }))
        };
        
        results[accountId] = engagementAnalysis;
      }
      
      return { results };
    } catch (error) {
      this.log.error('Error analyzing engagement', { error, accountIds });
      throw error;
    }
  }
  
  /**
   * Analyze reach metrics (impressions, profile visits)
   */
  async analyzeReach(accountIds, from, to, groupBy) {
    try {
      const results = {};
      
      for (const accountId of accountIds) {
        // Get metrics for the account within the time range
        const metrics = await this.getAccountMetrics(accountId, { 
          from, 
          to,
          limit: 1000 // Increase limit to get more data points
        });
        
        if (metrics.length === 0) {
          // Skip accounts with no data points
          continue;
        }
        
        // Group metrics by the specified interval
        const groupedMetrics = this.groupMetricsByInterval(metrics, groupBy);
        
        // For now, return dummy reach metrics as Twitter API doesn't provide this
        // In a real implementation, this would use actual reach metrics
        const reachAnalysis = {
          accountId,
          timeline: groupedMetrics.map(group => ({
            date: group.date,
            metrics: {
              impressions: Math.floor((group.metrics.followers || 0) * 0.1),
              profileVisits: Math.floor((group.metrics.followers || 0) * 0.05)
            }
          }))
        };
        
        results[accountId] = reachAnalysis;
      }
      
      return { results };
    } catch (error) {
      this.log.error('Error analyzing reach', { error, accountIds });
      throw error;
    }
  }
  
  /**
   * Generate summary statistics for accounts
   */
  async analyzeSummary(accountIds, from, to) {
    try {
      const results = {};
      
      for (const accountId of accountIds) {
        // Get earliest and latest metrics within the time range
        const allMetrics = await this.getAccountMetrics(accountId, { 
          from, 
          to,
          limit: 1000 // Increase limit to get more data points
        });
        
        if (allMetrics.length < 2) {
          // Skip accounts with insufficient data points
          continue;
        }
        
        // Get earliest and latest metrics in the range
        const earliest = allMetrics[allMetrics.length - 1];
        const latest = allMetrics[0];
        
        // Calculate growth and changes
        const followerGrowth = (latest.metrics.followers || 0) - (earliest.metrics.followers || 0);
        const followerGrowthPercent = earliest.metrics.followers 
          ? (followerGrowth / earliest.metrics.followers) * 100 
          : 0;
        
        const tweetGrowth = (latest.metrics.tweets || 0) - (earliest.metrics.tweets || 0);
        
        // Calculate average engagement
        const avgLikes = allMetrics.reduce((sum, m) => sum + (m.metrics.engagement?.avgLikes || 0), 0) / allMetrics.length;
        const avgRetweets = allMetrics.reduce((sum, m) => sum + (m.metrics.engagement?.avgRetweets || 0), 0) / allMetrics.length;
        const avgReplies = allMetrics.reduce((sum, m) => sum + (m.metrics.engagement?.avgReplies || 0), 0) / allMetrics.length;
        
        results[accountId] = {
          accountId,
          period: {
            from: earliest.timestamp,
            to: latest.timestamp,
            daysInRange: Math.round((new Date(latest.timestamp) - new Date(earliest.timestamp)) / (1000 * 60 * 60 * 24))
          },
          currentMetrics: {
            followers: latest.metrics.followers,
            following: latest.metrics.following,
            tweets: latest.metrics.tweets
          },
          growth: {
            followers: {
              absolute: followerGrowth,
              percent: followerGrowthPercent.toFixed(2) + '%',
              perDay: Math.round(followerGrowth / Math.max(1, (new Date(latest.timestamp) - new Date(earliest.timestamp)) / (1000 * 60 * 60 * 24)))
            },
            tweets: {
              absolute: tweetGrowth,
              perDay: Math.round(tweetGrowth / Math.max(1, (new Date(latest.timestamp) - new Date(earliest.timestamp)) / (1000 * 60 * 60 * 24)))
            }
          },
          engagement: {
            avgLikes: Math.round(avgLikes),
            avgRetweets: Math.round(avgRetweets),
            avgReplies: Math.round(avgReplies),
            engagementRate: Math.round((avgLikes + avgRetweets + avgReplies) / Math.max(1, latest.metrics.followers) * 100 * 100) / 100 + '%'
          }
        };
      }
      
      return { results };
    } catch (error) {
      this.log.error('Error generating summary', { error, accountIds });
      throw error;
    }
  }
  
  /**
   * Group metrics by a time interval (hour, day, week, month)
   */
  groupMetricsByInterval(metrics, interval) {
    if (!metrics || metrics.length === 0) {
      return [];
    }
    
    const grouped = {};
    
    for (const metric of metrics) {
      const date = new Date(metric.timestamp);
      let groupKey;
      
      switch (interval) {
        case 'hour':
          groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
          break;
        case 'day':
          groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          break;
        case 'week':
          // Get the Monday of the week
          const day = date.getDay();
          const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
          const monday = new Date(date);
          monday.setDate(diff);
          groupKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
          break;
        case 'month':
          groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }
      
      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          date: groupKey,
          metrics: { ...metric.metrics }
        };
      }
    }
    
    // Convert to array and sort by date
    return Object.values(grouped).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );
  }
  
  /**
   * Calculate growth rate for a specific metric
   */
  calculateGrowthRate(groupedMetrics, metricKey) {
    if (groupedMetrics.length < 2) {
      return {
        absolute: 0,
        percent: "0%",
        avgPerDay: 0
      };
    }
    
    const first = groupedMetrics[0];
    const last = groupedMetrics[groupedMetrics.length - 1];
    
    const firstValue = first.metrics[metricKey] || 0;
    const lastValue = last.metrics[metricKey] || 0;
    
    const growth = lastValue - firstValue;
    const percentGrowth = firstValue !== 0 ? (growth / firstValue) * 100 : 0;
    
    const firstDate = new Date(first.date);
    const lastDate = new Date(last.date);
    const daysInRange = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
    
    return {
      absolute: growth,
      percent: percentGrowth.toFixed(2) + '%',
      avgPerDay: Math.round(growth / daysInRange)
    };
  }
  
  /**
   * Calculate average engagement for a specific metric
   */
  calculateAverageEngagement(groupedMetrics, metricKey) {
    if (groupedMetrics.length === 0) {
      return 0;
    }
    
    let sum = 0;
    let count = 0;
    
    for (const group of groupedMetrics) {
      const value = group.metrics.engagement?.[metricKey];
      if (value !== undefined) {
        sum += value;
        count++;
      }
    }
    
    return count > 0 ? Math.round(sum / count) : 0;
  }
  
  /**
   * Filter metrics to only include specified fields
   */
  filterMetricsFields(metricsData, fields) {
    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      return metricsData;
    }
    
    const result = {};
    
    fields.forEach(field => {
      if (field.includes('.')) {
        // Handle nested fields
        const [parent, child] = field.split('.');
        
        if (metricsData[parent] && metricsData[parent][child] !== undefined) {
          if (!result[parent]) {
            result[parent] = {};
          }
          
          result[parent][child] = metricsData[parent][child];
        }
      } else if (metricsData[field] !== undefined) {
        // Handle top-level fields
        result[field] = metricsData[field];
      }
    });
    
    return result;
  }
}

module.exports = { MetricsCollector }; 