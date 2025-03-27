const mongoose = require('mongoose');
const { Pool } = require('pg');
const logger = require('../utils/logger');

// MongoDB Connection
const connectMongoDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

// PostgreSQL Connection
const pgPool = new Pool({
  connectionString: process.env.POSTGRES_URI,
});

pgPool.on('connect', () => {
  logger.info('PostgreSQL Connected');
});

pgPool.on('error', (err) => {
  logger.error(`PostgreSQL Error: ${err.message}`);
  process.exit(1);
});

const connectPostgres = async () => {
  try {
    await pgPool.query('SELECT NOW()');
    logger.info('PostgreSQL connection verified');
    return pgPool;
  } catch (error) {
    logger.error(`Error connecting to PostgreSQL: ${error.message}`);
    process.exit(1);
  }
};

module.exports = {
  connectMongoDB,
  connectPostgres,
  pgPool,
}; 