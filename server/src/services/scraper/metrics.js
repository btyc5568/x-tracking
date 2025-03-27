const { logger } = require('../../utils/logger');

class MetricsCollector {
  constructor(config) {
    this.config = config;
    this.log = logger.logger.child({ module: 'MetricsCollector' });
    
    // Simple in-memory metrics storage
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    
    // Initialize timestamp
    this.startTime = Date.now();
  }
  
  // Counter methods (monotonically increasing values)
  registerCounter(name) {
    if (!this.counters.has(name)) {
      this.counters.set(name, 0);
      this.log.debug(`Registered counter: ${name}`);
    }
  }
  
  incrementCounter(name, value = 1) {
    if (!this.counters.has(name)) {
      this.registerCounter(name);
    }
    
    const newValue = this.counters.get(name) + value;
    this.counters.set(name, newValue);
    this.log.debug(`Incremented counter: ${name} = ${newValue}`);
    return newValue;
  }
  
  getCounter(name) {
    return this.counters.get(name) || 0;
  }
  
  // Gauge methods (values that can go up and down)
  registerGauge(name) {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, 0);
      this.log.debug(`Registered gauge: ${name}`);
    }
  }
  
  registerGauges(names) {
    for (const name of names) {
      this.registerGauge(name);
    }
  }
  
  setGauge(name, value) {
    if (!this.gauges.has(name)) {
      this.registerGauge(name);
    }
    
    this.gauges.set(name, value);
    this.log.debug(`Set gauge: ${name} = ${value}`);
    return value;
  }
  
  incrementGauge(name, value = 1) {
    if (!this.gauges.has(name)) {
      this.registerGauge(name);
    }
    
    const newValue = this.gauges.get(name) + value;
    this.gauges.set(name, newValue);
    this.log.debug(`Incremented gauge: ${name} = ${newValue}`);
    return newValue;
  }
  
  decrementGauge(name, value = 1) {
    if (!this.gauges.has(name)) {
      this.registerGauge(name);
    }
    
    const newValue = this.gauges.get(name) - value;
    this.gauges.set(name, newValue);
    this.log.debug(`Decremented gauge: ${name} = ${newValue}`);
    return newValue;
  }
  
  getGauge(name) {
    return this.gauges.get(name) || 0;
  }
  
  // Histogram methods (for tracking distributions of values)
  registerHistogram(name) {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, []);
      this.log.debug(`Registered histogram: ${name}`);
    }
  }
  
  observeHistogram(name, value) {
    if (!this.histograms.has(name)) {
      this.registerHistogram(name);
    }
    
    const values = this.histograms.get(name);
    values.push(value);
    
    // Keep only the last 1000 observations to avoid memory issues
    if (values.length > 1000) {
      values.shift();
    }
    
    this.log.debug(`Observed histogram: ${name} = ${value}`);
    return values.length;
  }
  
  getHistogram(name) {
    return this.histograms.get(name) || [];
  }
  
  getHistogramStats(name) {
    const values = this.getHistogram(name);
    
    if (values.length === 0) {
      return {
        count: 0,
        sum: 0,
        min: 0,
        max: 0,
        mean: 0,
        median: 0
      };
    }
    
    // Sort for calculating percentiles
    const sorted = [...values].sort((a, b) => a - b);
    
    // Calculate stats
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const min = sorted[0];
    const max = sorted[count - 1];
    const mean = sum / count;
    const median = count % 2 === 0
      ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
      : sorted[Math.floor(count / 2)];
    
    return { count, sum, min, max, mean, median };
  }
  
  // Get all metrics
  getAllMetrics() {
    // Calculate uptime
    const uptime = Date.now() - this.startTime;
    
    return {
      uptime,
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([name, values]) => [
          name,
          this.getHistogramStats(name)
        ])
      )
    };
  }
  
  // Reset all metrics
  resetMetrics() {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.startTime = Date.now();
    this.log.info('All metrics reset');
  }
}

module.exports = { MetricsCollector }; 