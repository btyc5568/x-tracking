const express = require('express');
const {
  scrapeAccount,
  scrapeAllAccounts,
} = require('../controllers/scraperController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// Protect all routes
router.use(protect);

// Scrape a single account
router.post('/account/:id', scrapeAccount);

// Scrape all accounts (admin only)
router.post('/accounts', authorize('admin'), scrapeAllAccounts);

module.exports = router; 