const { ScraperOrchestrator } = require('./orchestrator');
const { logger } = require('../../utils/logger');
const scraperConfig = require('../../config/scraper.config');

async function main() {
  const log = logger.logger.child({ module: 'ScraperMain' });
  
  try {
    log.info('Starting X Account Tracking scraper');
    
    // Initialize and start the orchestrator
    const orchestrator = new ScraperOrchestrator(scraperConfig);
    await orchestrator.initialize();
    await orchestrator.start();
    
    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      log.info('Received SIGTERM signal, shutting down');
      await orchestrator.shutdown();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      log.info('Received SIGINT signal, shutting down');
      await orchestrator.shutdown();
      process.exit(0);
    });
    
    log.info('X Account Tracking scraper started successfully');
  } catch (error) {
    log.error('Failed to start X Account Tracking scraper', { 
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Start the scraper if this file is run directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error in main process:', error);
    process.exit(1);
  });
}

module.exports = { main }; 