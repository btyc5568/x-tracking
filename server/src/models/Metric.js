const mongoose = require('mongoose');

const MetricSchema = new mongoose.Schema(
  {
    accountId: {
      type: String,
      required: [true, 'Account ID is required'],
      index: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    followers: {
      type: Number,
      default: 0
    },
    following: {
      type: Number,
      default: 0
    },
    tweets: {
      type: Number,
      default: 0
    },
    engagement: {
      avgLikes: {
        type: Number,
        default: 0
      },
      avgRetweets: {
        type: Number,
        default: 0
      },
      avgReplies: {
        type: Number,
        default: 0
      },
      avgViews: {
        type: Number,
        default: 0
      }
    },
    sentiment: {
      overall: {
        type: Number,
        min: -1,
        max: 1,
        default: 0
      },
      recent: {
        type: Number,
        min: -1,
        max: 1,
        default: 0
      }
    },
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account'
    },
    metadata: {
      source: {
        type: String,
        default: 'scraper'
      },
      version: {
        type: String,
        default: '1.0'
      },
      raw: {
        type: Object
      }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for query performance
MetricSchema.index({ accountId: 1, timestamp: -1 });
MetricSchema.index({ account: 1, timestamp: -1 });
MetricSchema.index({ timestamp: -1 });

// Virtual for calculated fields
MetricSchema.virtual('growth').get(function() {
  return {
    followersRate: this.metadata?.previousMetrics?.followers 
      ? (this.followers - this.metadata.previousMetrics.followers) / this.metadata.previousMetrics.followers 
      : 0,
    tweetsRate: this.metadata?.previousMetrics?.tweets
      ? (this.tweets - this.metadata.previousMetrics.tweets) / this.metadata.previousMetrics.tweets
      : 0
  };
});

module.exports = mongoose.model('Metric', MetricSchema); 