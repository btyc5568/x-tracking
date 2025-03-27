const Category = require('../models/Category');
const { logger } = require('./logger');
const mongoose = require('mongoose');

/**
 * Check if MongoDB is connected
 */
const isMongoConnected = () => {
  try {
    return mongoose.connection.readyState === 1;
  } catch (error) {
    return false;
  }
};

/**
 * Seed default categories into the database if they don't exist
 */
const seedDefaultCategories = async () => {
  try {
    // Skip if not connected to MongoDB
    if (!isMongoConnected()) {
      logger.info('MongoDB not connected, skipping category seeding');
      return;
    }

    const defaultCategories = [
      {
        name: 'Crypto Experts',
        description: 'Cryptocurrency and blockchain professionals',
        color: '#F7931A', // Bitcoin orange
        isDefault: true
      },
      {
        name: 'News',
        description: 'Financial news sources',
        color: '#3498DB', // Blue
        isDefault: true
      },
      {
        name: 'Stock Analysts',
        description: 'Stock market analysts and professionals',
        color: '#2ECC71', // Green
        isDefault: true
      },
      {
        name: 'Economy Experts',
        description: 'Macroeconomic commentators and economists',
        color: '#9B59B6', // Purple
        isDefault: true
      },
      {
        name: 'Financial Analysts',
        description: 'General financial analysis',
        color: '#E74C3C', // Red
        isDefault: true
      }
    ];

    logger.info('Checking for default categories...');
    
    // Check existing categories
    const existingCategories = await Category.find({ isDefault: true });
    const existingNames = existingCategories.map(cat => cat.name.toLowerCase());
    
    // Filter out categories that already exist
    const categoriesToCreate = defaultCategories.filter(
      cat => !existingNames.includes(cat.name.toLowerCase())
    );
    
    if (categoriesToCreate.length === 0) {
      logger.info('All default categories already exist');
      return;
    }
    
    // Create missing categories
    await Category.insertMany(categoriesToCreate);
    
    logger.info(`Created ${categoriesToCreate.length} default categories`);
  } catch (error) {
    logger.error('Error seeding default categories', { error });
  }
};

module.exports = seedDefaultCategories; 