const express = require('express');
const { logger } = require('../../utils/logger');

const router = express.Router();
const log = logger.child({ module: 'ScraperAPI' });

/**
 * @route   GET /api/scraper/status
 * @desc    Get scraper status
 * @access  Public
 */
router.get('/status', async (req, res) => {
  try {
    const orchestrator = req.app.get('scraperOrchestrator');
    if (!orchestrator) {
      return res.status(500).json({ 
        success: false, 
        error: 'Scraper orchestrator not available' 
      });
    }
    
    const status = await orchestrator.getStatus();
    
    return res.json({ 
      success: true, 
      data: status
    });
  } catch (error) {
    log.error('Error getting scraper status', { error });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error retrieving scraper status' 
    });
  }
});

/**
 * @route   POST /api/scraper/start
 * @desc    Start scraper
 * @access  Public
 */
router.post('/start', async (req, res) => {
  try {
    const orchestrator = req.app.get('scraperOrchestrator');
    if (!orchestrator) {
      return res.status(500).json({ 
        success: false, 
        error: 'Scraper orchestrator not available' 
      });
    }
    
    // Initialize if not already initialized
    if (!orchestrator.isInitialized) {
      await orchestrator.initialize();
      log.info('Scraper initialized successfully');
    }
    
    // Start the scraper (even if already initialized)
    if (!orchestrator.isRunning) {
      await orchestrator.start();
      log.info('Scraper started successfully');
    } else {
      log.info('Scraper already running');
    }
    
    const status = await orchestrator.getStatus();
    
    return res.json({ 
      success: true, 
      message: 'Scraper started successfully',
      data: status
    });
  } catch (error) {
    log.error('Error starting scraper', { error });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error starting scraper' 
    });
  }
});

/**
 * @route   POST /api/scraper/stop
 * @desc    Stop scraper
 * @access  Public
 */
router.post('/stop', async (req, res) => {
  try {
    const orchestrator = req.app.get('scraperOrchestrator');
    if (!orchestrator) {
      return res.status(500).json({ 
        success: false, 
        error: 'Scraper orchestrator not available' 
      });
    }
    
    // Stop scraper if running
    if (orchestrator.isRunning) {
      await orchestrator.stop();
      log.info('Scraper stopped successfully');
    } else {
      log.info('Scraper not running');
    }
    
    const status = await orchestrator.getStatus();
    
    return res.json({ 
      success: true, 
      message: 'Scraper stopped successfully',
      data: status
    });
  } catch (error) {
    log.error('Error stopping scraper', { error });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error stopping scraper' 
    });
  }
});

/**
 * @route   POST /api/scraper/pause
 * @desc    Pause scraper processing
 * @access  Public
 */
router.post('/pause', async (req, res) => {
  try {
    const orchestrator = req.app.get('scraperOrchestrator');
    if (!orchestrator) {
      return res.status(500).json({ 
        success: false, 
        error: 'Scraper orchestrator not available' 
      });
    }
    
    // Pause scraper if running
    if (orchestrator.isInitialized) {
      await orchestrator.pause();
      log.info('Scraper paused successfully');
    } else {
      log.info('Scraper not running');
    }
    
    const status = await orchestrator.getStatus();
    
    return res.json({ 
      success: true, 
      message: 'Scraper paused successfully',
      data: status
    });
  } catch (error) {
    log.error('Error pausing scraper', { error });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error pausing scraper' 
    });
  }
});

/**
 * @route   POST /api/scraper/resume
 * @desc    Resume scraper processing
 * @access  Public
 */
router.post('/resume', async (req, res) => {
  try {
    const orchestrator = req.app.get('scraperOrchestrator');
    if (!orchestrator) {
      return res.status(500).json({ 
        success: false, 
        error: 'Scraper orchestrator not available' 
      });
    }
    
    // Resume scraper if running
    if (orchestrator.isInitialized) {
      await orchestrator.resume();
      log.info('Scraper resumed successfully');
    } else {
      log.info('Scraper not running');
    }
    
    const status = await orchestrator.getStatus();
    
    return res.json({ 
      success: true, 
      message: 'Scraper resumed successfully',
      data: status
    });
  } catch (error) {
    log.error('Error resuming scraper', { error });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error resuming scraper' 
    });
  }
});

/**
 * @route   POST /api/scraper/run-account/:accountId
 * @desc    Run scraper for a specific account immediately
 * @access  Public
 */
router.post('/run-account/:accountId', async (req, res) => {
  try {
    const orchestrator = req.app.get('scraperOrchestrator');
    if (!orchestrator) {
      return res.status(500).json({ 
        success: false, 
        error: 'Scraper orchestrator not available' 
      });
    }
    
    // Initialize orchestrator if necessary
    if (!orchestrator.isInitialized) {
      log.info('Initializing scraper for account scrape');
      await orchestrator.initialize();
    }
    
    // Get account
    const account = await orchestrator.accountManager.getAccount(req.params.accountId);
    
    if (!account) {
      return res.status(404).json({ 
        success: false, 
        error: 'Account not found' 
      });
    }
    
    // Run account scraper
    log.info('Starting immediate scrape for account', { accountId: req.params.accountId });
    const result = await orchestrator.scrapeAccount(req.params.accountId);
    
    return res.json({ 
      success: true, 
      message: 'Account scrape started',
      data: result
    });
  } catch (error) {
    log.error('Error running account scraper', { 
      error, 
      accountId: req.params.accountId 
    });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error running account scraper' 
    });
  }
});

/**
 * @route   GET /api/scraper/config
 * @desc    Get scraper configuration
 * @access  Public
 */
router.get('/config', async (req, res) => {
  try {
    const orchestrator = req.app.get('scraperOrchestrator');
    if (!orchestrator) {
      return res.status(500).json({ 
        success: false, 
        error: 'Scraper orchestrator not available' 
      });
    }
    
    const config = orchestrator.getConfig();
    
    return res.json({ 
      success: true, 
      data: config
    });
  } catch (error) {
    log.error('Error getting scraper configuration', { error });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error retrieving scraper configuration' 
    });
  }
});

/**
 * @route   PUT /api/scraper/config
 * @desc    Update scraper configuration
 * @access  Public
 */
router.put('/config', async (req, res) => {
  try {
    const orchestrator = req.app.get('scraperOrchestrator');
    if (!orchestrator) {
      return res.status(500).json({ 
        success: false, 
        error: 'Scraper orchestrator not available' 
      });
    }
    
    const { maxConcurrentWorkers, maxBrowsers, logLevel } = req.body;
    
    // Update config
    const updatedConfig = await orchestrator.updateConfig({
      maxConcurrentWorkers,
      maxBrowsers,
      logLevel
    });
    
    return res.json({ 
      success: true, 
      message: 'Scraper configuration updated',
      data: updatedConfig
    });
  } catch (error) {
    log.error('Error updating scraper configuration', { error, body: req.body });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error updating scraper configuration' 
    });
  }
});

/**
 * @route   GET /api/scraper/stats
 * @desc    Get scraper statistics
 * @access  Public
 */
router.get('/stats', async (req, res) => {
  try {
    const orchestrator = req.app.get('scraperOrchestrator');
    if (!orchestrator) {
      return res.status(500).json({ 
        success: false, 
        error: 'Scraper orchestrator not available' 
      });
    }
    
    const stats = await orchestrator.getStats();
    
    return res.json({ 
      success: true, 
      data: stats
    });
  } catch (error) {
    log.error('Error getting scraper statistics', { error });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error retrieving scraper statistics' 
    });
  }
});

/**
 * @route   GET /api/scraper/queue
 * @desc    Get scraper queue status
 * @access  Public
 */
router.get('/queue', async (req, res) => {
  try {
    const orchestrator = req.app.get('scraperOrchestrator');
    if (!orchestrator) {
      return res.status(500).json({ 
        success: false, 
        error: 'Scraper orchestrator not available' 
      });
    }
    
    const queueStatus = await orchestrator.getQueueStatus();
    
    return res.json({ 
      success: true, 
      data: queueStatus
    });
  } catch (error) {
    log.error('Error getting scraper queue status', { error });
    return res.status(500).json({ 
      success: false, 
      error: 'Server error retrieving scraper queue status' 
    });
  }
});

module.exports = router; 