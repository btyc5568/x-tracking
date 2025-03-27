const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
    },
    executiveSummary: {
      type: String,
      required: true,
    },
    overallSentiment: {
      score: {
        type: Number,
        min: -100,
        max: 100,
        default: 0,
      },
      trend24h: {
        type: Number,
        default: 0,
      },
      trend72h: {
        type: Number,
        default: 0,
      },
      trend7d: {
        type: Number,
        default: 0,
      },
      confidence: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
    },
    categorySentiments: [
      {
        category: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Category',
        },
        score: {
          type: Number,
          min: -100,
          max: 100,
          default: 0,
        },
        confidence: {
          type: Number,
          min: 0,
          max: 100,
          default: 0,
        },
        trend24h: {
          type: Number,
          default: 0,
        },
      },
    ],
    highlightedPosts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
      },
    ],
    trendingTopics: [
      {
        name: {
          type: String,
        },
        count: {
          type: Number,
          default: 0,
        },
        velocity: {
          type: Number,
          default: 0,
        },
        sentiment: {
          type: Number,
          min: -100,
          max: 100,
          default: 0,
        },
        relatedPosts: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Post',
          },
        ],
      },
    ],
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    type: {
      type: String,
      enum: ['brief', 'standard', 'comprehensive'],
      default: 'standard',
    },
    focusCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'published',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Report', ReportSchema); 