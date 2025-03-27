const express = require('express');
const path = require('path');
const cors = require('cors');
const { logger } = require('./src/utils/logger');
const { ScraperOrchestrator } = require('./src/services/scraper/orchestrator');

// Initialize logger for server
const log = logger.child({ module: 'Server' });

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// CORS middleware
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, '../client'), {
  fallthrough: true
}));

// Error handler for static files
app.use((err, req, res, next) => {
  if (err) {
    log.error('Static file error', { error: err.message, url: req.url });
    return res.status(500).json({ error: 'Error serving static files' });
  }
  next();
});

// API routes
app.use('/api/scraper', require('./src/routes/api/scraper'));
app.use('/api/accounts', require('./src/routes/api/accounts'));
app.use('/api/metrics', require('./src/routes/api/metrics'));
app.use('/api/alerts', require('./src/routes/api/alerts'));

// Initialize scraper orchestrator
const scraperOrchestrator = new ScraperOrchestrator();
app.set('scraperOrchestrator', scraperOrchestrator);

// Start the server
const server = app.listen(PORT, () => {
  log.info(`Server running on port ${PORT}`);
  
  // Initialize and start the scraper if auto-start is enabled
  if (process.env.AUTO_START_SCRAPER === 'true') {
    scraperOrchestrator.initialize()
      .then(() => {
        log.info('Starting scraper orchestrator automatically');
        return scraperOrchestrator.start();
      })
      .catch(error => {
        log.error('Failed to auto-start scraper', { error });
      });
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down server');
  server.close(() => {
    log.info('Server shut down');
    
    // Shut down scraper
    if (scraperOrchestrator.isRunning) {
      scraperOrchestrator.stop()
        .then(() => {
          log.info('Scraper shut down successfully');
          process.exit(0);
        })
        .catch(error => {
          log.error('Error shutting down scraper', { error });
          process.exit(1);
        });
    } else {
      process.exit(0);
    }
  });
});

module.exports = app; 