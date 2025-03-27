const Account = require('../models/Account');
const Post = require('../models/Post');
const scraper = require('../services/scraper');
const { SentimentAnalyzer } = require('node-nlp');
const logger = require('../utils/logger');

const nlp = new SentimentAnalyzer({ language: 'en' });

/**
 * @desc    Scrape a single account
 * @route   POST /api/scraper/account/:id
 * @access  Private
 */
exports.scrapeAccount = async (req, res) => {
  try {
    // Find account
    const account = await Account.findById(req.params.id);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
      });
    }

    // Ensure scraper is logged in
    if (!scraper.isLoggedIn) {
      const loginSuccess = await scraper.login(
        process.env.X_USERNAME,
        process.env.X_PASSWORD
      );
      if (!loginSuccess) {
        return res.status(500).json({
          success: false,
          error: 'Failed to log in to X',
        });
      }
    }

    // Scrape profile
    const profileData = await scraper.getProfile(account.username);
    if (!profileData) {
      return res.status(404).json({
        success: false,
        error: 'Account not found on X',
      });
    }

    // Update account with profile data
    account.displayName = profileData.displayName;
    account.profileImageUrl = profileData.profileImageUrl;
    account.bio = profileData.bio;
    account.followerCount = profileData.followerCount;
    account.followingCount = profileData.followingCount;
    account.lastScraped = new Date();
    await account.save();

    // Scrape posts
    const posts = await scraper.getPosts(account.username, 20);
    const savedPosts = [];
    
    // Process and save each post
    for (const post of posts) {
      // Check if post already exists
      const existingPost = await Post.findOne({ postId: post.postId });
      if (existingPost) {
        // Update engagement counts
        existingPost.likeCount = post.likeCount;
        existingPost.retweetCount = post.retweetCount;
        existingPost.replyCount = post.replyCount;
        await existingPost.save();
        savedPosts.push(existingPost);
        continue;
      }

      // Analyze sentiment
      const sentiment = await analyzeSentiment(post.content);

      // Create new post
      const newPost = await Post.create({
        postId: post.postId,
        account: account._id,
        content: post.content,
        postDate: new Date(post.postDate),
        likeCount: post.likeCount,
        retweetCount: post.retweetCount,
        replyCount: post.replyCount,
        mediaUrls: post.mediaUrls,
        hashtags: post.hashtags,
        mentions: post.mentions,
        sentimentScore: sentiment.score,
        sentimentConfidence: sentiment.confidence,
        keywords: extractKeywords(post.content),
        url: post.url,
      });

      savedPosts.push(newPost);
    }

    res.json({
      success: true,
      data: {
        account,
        posts: savedPosts,
      },
    });
  } catch (err) {
    logger.error(`Error scraping account: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server Error',
    });
  }
};

/**
 * @desc    Scrape all active accounts
 * @route   POST /api/scraper/accounts
 * @access  Private/Admin
 */
exports.scrapeAllAccounts = async (req, res) => {
  try {
    // Get all active accounts that need scraping
    const accounts = await Account.find({
      active: true,
      $or: [
        { lastScraped: null },
        {
          $expr: {
            $gt: [
              { $subtract: [new Date(), '$lastScraped'] },
              { $multiply: ['$scrapingFrequency', 60 * 1000] }, // Convert minutes to ms
            ],
          },
        },
      ],
    }).sort({ priority: -1 });

    if (accounts.length === 0) {
      return res.json({
        success: true,
        message: 'No accounts need scraping at this time',
      });
    }

    // Ensure scraper is logged in
    if (!scraper.isLoggedIn) {
      const loginSuccess = await scraper.login(
        process.env.X_USERNAME,
        process.env.X_PASSWORD
      );
      if (!loginSuccess) {
        return res.status(500).json({
          success: false,
          error: 'Failed to log in to X',
        });
      }
    }

    // Track results
    const results = {
      total: accounts.length,
      processed: 0,
      successful: 0,
      failed: 0,
      newPosts: 0,
    };

    // Process accounts sequentially to avoid rate limiting
    for (const account of accounts) {
      try {
        // Scrape profile
        const profileData = await scraper.getProfile(account.username);
        if (!profileData) {
          results.failed++;
          logger.error(`Account not found on X: ${account.username}`);
          continue;
        }

        // Update account with profile data
        account.displayName = profileData.displayName;
        account.profileImageUrl = profileData.profileImageUrl;
        account.bio = profileData.bio;
        account.followerCount = profileData.followerCount;
        account.followingCount = profileData.followingCount;
        account.lastScraped = new Date();
        await account.save();

        // Scrape posts
        const posts = await scraper.getPosts(account.username, 20);
        
        // Process and save each post
        for (const post of posts) {
          // Check if post already exists
          const existingPost = await Post.findOne({ postId: post.postId });
          if (existingPost) {
            // Update engagement counts
            existingPost.likeCount = post.likeCount;
            existingPost.retweetCount = post.retweetCount;
            existingPost.replyCount = post.replyCount;
            await existingPost.save();
            continue;
          }

          // Analyze sentiment
          const sentiment = await analyzeSentiment(post.content);

          // Create new post
          await Post.create({
            postId: post.postId,
            account: account._id,
            content: post.content,
            postDate: new Date(post.postDate),
            likeCount: post.likeCount,
            retweetCount: post.retweetCount,
            replyCount: post.replyCount,
            mediaUrls: post.mediaUrls,
            hashtags: post.hashtags,
            mentions: post.mentions,
            sentimentScore: sentiment.score,
            sentimentConfidence: sentiment.confidence,
            keywords: extractKeywords(post.content),
            url: post.url,
          });

          results.newPosts++;
        }

        results.successful++;
      } catch (error) {
        logger.error(`Error processing account ${account.username}: ${error.message}`);
        results.failed++;
      }

      results.processed++;
    }

    res.json({
      success: true,
      data: results,
    });
  } catch (err) {
    logger.error(`Error bulk scraping accounts: ${err.message}`);
    res.status(500).json({
      success: false,
      error: 'Server Error',
    });
  }
};

/**
 * Analyze sentiment of text
 * @param {string} text - Text to analyze
 * @returns {Object} - Sentiment score and confidence
 */
async function analyzeSentiment(text) {
  try {
    const result = await nlp.sentiment(text);
    
    // Convert to a -100 to +100 score
    const score = Math.round((result.score * 2 - 1) * 100);
    
    return {
      score,
      confidence: Math.round(result.numWords > 0 ? Math.min(100, 30 + result.numWords * 5) : 30),
    };
  } catch (error) {
    logger.error(`Error analyzing sentiment: ${error.message}`);
    return { score: 0, confidence: 0 };
  }
}

/**
 * Extract keywords from text
 * @param {string} text - Text to extract keywords from
 * @returns {string[]} - Array of keywords
 */
function extractKeywords(text) {
  // Simple keyword extraction based on word frequency
  // Remove common stopwords, punctuation, mentions, and hashtags
  const stopwords = [
    'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'of', 'this',
    'that', 'these', 'those', 'it', 'its', 'i', 'you', 'he', 'she', 'we', 'they',
    'my', 'your', 'his', 'her', 'our', 'their',
  ];

  const cleanText = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '') // Remove URLs
    .replace(/@\w+/g, '') // Remove mentions
    .replace(/#\w+/g, '') // Remove hashtags
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();

  // Split into words
  const words = cleanText.split(' ');
  
  // Count word frequency (excluding stopwords and short words)
  const wordCount = {};
  words.forEach((word) => {
    if (word.length > 3 && !stopwords.includes(word)) {
      wordCount[word] = (wordCount[word] || 0) + 1;
    }
  });

  // Convert to array and sort by frequency
  const sortedWords = Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .map((entry) => entry[0])
    .slice(0, 5); // Take top 5 keywords

  return sortedWords;
}

module.exports = exports; 