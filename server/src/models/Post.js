const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema(
  {
    postId: {
      type: String,
      required: true,
      unique: true,
    },
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    postDate: {
      type: Date,
      required: true,
    },
    likeCount: {
      type: Number,
      default: 0,
    },
    retweetCount: {
      type: Number,
      default: 0,
    },
    replyCount: {
      type: Number,
      default: 0,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    mediaUrls: [
      {
        type: String,
      },
    ],
    hashtags: [
      {
        type: String,
      },
    ],
    mentions: [
      {
        type: String,
      },
    ],
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
    keywords: [
      {
        type: String,
      },
    ],
    topics: [
      {
        type: String,
      },
    ],
    entities: [
      {
        name: {
          type: String,
        },
        type: {
          type: String, // e.g., 'stock', 'crypto', 'company', 'person'
        },
      },
    ],
    url: {
      type: String,
    },
    isHighlighted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes for frequent queries
PostSchema.index({ account: 1, postDate: -1 });
PostSchema.index({ postDate: -1 });
PostSchema.index({ sentimentScore: -1 });

module.exports = mongoose.model('Post', PostSchema); 