const mongoose = require('mongoose');
const { Pool } = require('pg');
const { logger } = require('../utils/logger');

// MongoDB Connection
const connectDB = async () => {
  try {
    // Check if MongoDB URI is provided
    if (!process.env.MONGO_URI) {
      logger.warn('MongoDB URI not provided, using in-memory mock data');
      return { connection: { host: 'mock' } };
    }

    // Try to connect to MongoDB
    logger.info(`Attempting to connect to MongoDB at ${process.env.MONGO_URI}`);
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000, // Shorter timeout for testing
      connectTimeoutMS: 5000,
      socketTimeoutMS: 10000,
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    logger.error(`MongoDB Connection Error: ${err.message}`);
    logger.info('Continuing with in-memory mock data');
    return { connection: { host: 'mock-fallback' } };
  }
};

// PostgreSQL Connection
let pgPool = null;

if (process.env.POSTGRES_URI) {
  pgPool = new Pool({
    connectionString: process.env.POSTGRES_URI,
  });

  pgPool.on('connect', () => {
    logger.info('PostgreSQL Connected');
  });

  pgPool.on('error', (err) => {
    logger.error(`PostgreSQL Error: ${err.message}`);
    // Don't exit process on error
  });
}

const connectPostgres = async () => {
  // Skip PostgreSQL connection if URI is not provided
  if (!process.env.POSTGRES_URI || !pgPool) {
    logger.warn('PostgreSQL URI not provided or pool not initialized, skipping connection');
    return null;
  }
  
  try {
    await pgPool.query('SELECT NOW()');
    logger.info('PostgreSQL connection verified');
    return pgPool;
  } catch (error) {
    logger.error(`Error connecting to PostgreSQL: ${error.message}`);
    // Don't exit process, just log the error
    return null;
  }
};

module.exports = connectDB; 