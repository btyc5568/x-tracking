const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define format for logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create console format for readability
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, module, ...meta }) => {
    const moduleTag = module ? `[${module}]` : '';
    const metaStr = Object.keys(meta).length ? 
      `\n${JSON.stringify(meta, null, 2)}` : '';
    
    return `${timestamp} ${level}: ${moduleTag} ${message}${metaStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'x-tracker' },
  transports: [
    // Write logs to files
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ],
});

// Add console transport in development environment
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Utility functions for logger
const setLogLevel = (level) => {
  if (['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'].includes(level)) {
    logger.level = level;
    logger.info(`Log level set to ${level}`);
    return true;
  }
  logger.warn(`Invalid log level: ${level}`);
  return false;
};

// Export logger and utilities
module.exports = {
  logger,
  setLogLevel
}; 