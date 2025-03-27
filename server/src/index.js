const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/database');
const { logger } = require('./utils/logger');
const seedDefaultCategories = require('./utils/seedCategories');

// Load environment variables
dotenv.config();

// Initialize express
const app = express();

// Connect to database
connectDB().then(() => {
  // Seed default categories after DB connection
  seedDefaultCategories();
});

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());

// Routes
app.use('/api/categories', require('./routes/categories'));
app.use('/api/accounts', require('./routes/accounts'));
// app.use('/api/reports', require('./routes/reports'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/scraper', require('./routes/scraper'));

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({
    success: false,
    error: err.message || 'Server Error',
  });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
}); 