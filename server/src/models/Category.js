const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a category name'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    color: {
      type: String,
      default: '#3498db', // Default blue color
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    accountCount: {
      type: Number,
      default: 0,
    },
    sentimentScore: {
      type: Number,
      min: -100,
      max: 100,
      default: 0,
    },
    sentimentConfidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Category', CategorySchema); 