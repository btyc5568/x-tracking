const express = require('express');
const { logger } = require('../utils/logger');
const scraperConfig = require('../config/scraper.config');
const { ScraperOrchestrator } = require('../services/scraper/orchestrator');

// Create singleton orchestrator instance
let orchestrator = null;

async function getOrchestrator() {
  if (!orchestrator) {
    orchestrator = new ScraperOrchestrator(scraperConfig);
    await orchestrator.initialize();
  }
  return orchestrator;
}

const router = express.Router();
const log = logger.logger.child({ module: 'ScraperRoutes' });

// Start the scraper
router.post('/start', async (req, res) => {
  try {
    const scraper = await getOrchestrator();
    await scraper.start();
    
    res.json({ 
      success: true, 
      message: 'Scraper started successfully' 
    });
  } catch (error) {
    log.error('Failed to start scraper', { error });
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Stop the scraper
router.post('/stop', async (req, res) => {
  try {
    if (!orchestrator) {
      return res.json({ 
        success: true, 
        message: 'Scraper is not running' 
      });
    }
    
    await orchestrator.shutdown();
    
    res.json({ 
      success: true, 
      message: 'Scraper stopped successfully' 
    });
  } catch (error) {
    log.error('Failed to stop scraper', { error });
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get scraper status
router.get('/status', async (req, res) => {
  try {
    if (!orchestrator) {
      return res.json({ 
        success: true, 
        status: {
          isRunning: false,
          message: 'Scraper not initialized'
        }
      });
    }
    
    const status = await orchestrator.getStatus();
    
    res.json({ 
      success: true, 
      status
    });
  } catch (error) {
    log.error('Failed to get scraper status', { error });
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Manually trigger a scrape for a specific account
router.post('/accounts/:id/scrape', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!orchestrator) {
      return res.status(400).json({ 
        success: false, 
        error: 'Scraper not initialized'
      });
    }
    
    // Get account details
    const account = await orchestrator.accounts.getAccount(id);
    
    if (!account) {
      return res.status(404).json({ 
        success: false, 
        error: 'Account not found'
      });
    }
    
    // Schedule account for immediate scraping
    await orchestrator.scheduler.scheduleAtTime(account, Date.now());
    
    res.json({ 
      success: true, 
      message: `Scheduled account ${id} for immediate scraping`
    });
  } catch (error) {
    log.error('Failed to trigger account scrape', { error });
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get account list with status
router.get('/accounts', async (req, res) => {
  try {
    if (!orchestrator) {
      return res.status(400).json({ 
        success: false, 
        error: 'Scraper not initialized'
      });
    }
    
    // Get all accounts
    const accounts = await orchestrator.accounts.getAllAccounts();
    
    // Get scheduled times for each account
    const scheduledTimes = {}; // { accountId: nextRunTime }
    
    // Convert to response format
    const accountsWithStatus = accounts.map(account => ({
      id: account.id,
      username: account.username,
      priority: account.priority,
      categories: account.categories,
      nextRun: scheduledTimes[account.id] ? new Date(scheduledTimes[account.id]) : null
    }));
    
    res.json({ 
      success: true, 
      accounts: accountsWithStatus
    });
  } catch (error) {
    log.error('Failed to get account list', { error });
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Manage accounts
router.post('/accounts', async (req, res) => {
  try {
    if (!orchestrator) {
      return res.status(400).json({ 
        success: false, 
        error: 'Scraper not initialized'
      });
    }
    
    const { username, priority, categories } = req.body;
    
    if (!username) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username is required'
      });
    }
    
    // Add account
    const account = await orchestrator.accounts.addAccount({
      username,
      priority,
      categories
    });
    
    // Schedule for scraping
    await orchestrator.scheduler.scheduleAccount(account);
    
    res.json({ 
      success: true, 
      account
    });
  } catch (error) {
    log.error('Failed to add account', { error });
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.put('/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!orchestrator) {
      return res.status(400).json({ 
        success: false, 
        error: 'Scraper not initialized'
      });
    }
    
    // Update account
    const account = await orchestrator.accounts.updateAccount(id, req.body);
    
    if (!account) {
      return res.status(404).json({ 
        success: false, 
        error: 'Account not found'
      });
    }
    
    // Reschedule if needed
    if (req.body.priority) {
      await orchestrator.scheduler.scheduleAccount(account);
    }
    
    res.json({ 
      success: true, 
      account
    });
  } catch (error) {
    log.error('Failed to update account', { error });
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.delete('/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!orchestrator) {
      return res.status(400).json({ 
        success: false, 
        error: 'Scraper not initialized'
      });
    }
    
    // Remove account
    const success = await orchestrator.accounts.removeAccount(id);
    
    if (!success) {
      return res.status(404).json({ 
        success: false, 
        error: 'Account not found'
      });
    }
    
    res.json({ 
      success: true, 
      message: `Account ${id} removed successfully`
    });
  } catch (error) {
    log.error('Failed to remove account', { error });
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Export singleton and router
module.exports = { router, getOrchestrator }; 