const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Please add a username'],
      unique: true,
      trim: true,
    },
    displayName: {
      type: String,
      trim: true,
    },
    profileImageUrl: {
      type: String,
    },
    bio: {
      type: String,
    },
    followerCount: {
      type: Number,
      default: 0,
    },
    followingCount: {
      type: Number,
      default: 0,
    },
    priority: {
      type: Number,
      required: [true, 'Please add a priority level'],
      min: 1,
      max: 5,
      default: 3,
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    lastScraped: {
      type: Date,
      default: null,
    },
    scrapingFrequency: {
      type: Number, // in minutes
      default: 360, // default 6 hours
    },
    active: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
    },
    accuracyScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50, // start with neutral score
    },
  },
  {
    timestamps: true,
  }
);

// Calculate scraping frequency based on priority
AccountSchema.pre('save', function (next) {
  if (this.isModified('priority')) {
    switch (this.priority) {
      case 5:
        this.scrapingFrequency = 60; // 1 hour
        break;
      case 4:
        this.scrapingFrequency = 180; // 3 hours
        break;
      case 3:
        this.scrapingFrequency = 360; // 6 hours
        break;
      case 2:
        this.scrapingFrequency = 720; // 12 hours
        break;
      case 1:
        this.scrapingFrequency = 1440; // 24 hours
        break;
      default:
        this.scrapingFrequency = 360; // default 6 hours
    }
  }
  next();
});

module.exports = mongoose.model('Account', AccountSchema); 