const mongoose = require('mongoose');
const tokenManager = require('../utils/tokenManager');
const logger = require('../utils/logger');
const { getUserServices, setUserServices, clearUserCache } = require('../utils/cache');
const { asyncHandler } = require('../middleware/errorHandler');

// ✅ Enhanced DetectedService Schema with proper validation
const DetectedServiceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true // Performance optimization
  },
  
  // ✅ Enhanced platform information
  platform: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true // For search queries
  },
  
  domain: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true // Critical for deduplication
  },
  
  sender: {
    type: String,
    required: true,
    trim: true
  },
  
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  
  subject: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  date: {
    type: Date,
    default: Date.now,
    index: true // For time-based queries
  },
  
  // ✅ Enhanced metadata for better service management
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },
  
  category: {
    type: String,
    enum: ['social', 'ecommerce', 'newsletter', 'entertainment', 'productivity', 
           'financial', 'education', 'communication', 'marketing', 'other'],
    default: 'other',
    index: true // For category filtering
  },
  
  suspicious: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // ✅ User management fields
  unsubscribed: {
    type: Boolean,
    default: false,
    index: true
  },
  
  unsubscribedAt: Date,
  unsubscribeMethod: {
    type: String,
    enum: ['manual', 'automatic', 'bulk'],
    default: 'manual'
  },
  
  ignored: {
    type: Boolean,
    default: false,
    index: true
  },
  
  ignoredAt: Date,
  
  // ✅ Detection metadata
  messageId: String,
  threadId: String,
  snippet: {
    type: String,
    maxlength: 200
  },
  
  lastSeen: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  detectedAt: {
    type: Date,
    default: Date.now
  },
  
  detectorVersion: {
    type: String,
    default: '2.0'
  }
}, {
  timestamps: true,
  versionKey: false
});

// ✅ Enhanced indexes for production performance
DetectedServiceSchema.index({ user: 1, domain: 1 }, { unique: true });
DetectedServiceSchema.index({ user: 1, platform: 1 });
DetectedServiceSchema.index({ user: 1, category: 1 });
DetectedServiceSchema.index({ user: 1, unsubscribed: 1, ignored: 1 });
DetectedServiceSchema.index({ user: 1, lastSeen: -1 });
DetectedServiceSchema.index({ user: 1, confidence: -1 });

// Compound indexes for complex queries
DetectedServiceSchema.index({ user: 1, category: 1, unsubscribed: 1 });
DetectedServiceSchema.index({ user: 1, suspicious: 1, confidence: -1 });

// ✅ Instance methods for service operations
DetectedServiceSchema.methods.markAsUnsubscribed = function(method = 'manual') {
  this.unsubscribed = true;
  this.unsubscribedAt = new Date();
  this.unsubscribeMethod = method;
  this.ignored = false; // Clear ignore status
  this.ignoredAt = null;
  return this.save();
};

DetectedServiceSchema.methods.markAsIgnored = function() {
  this.ignored = true;
  this.ignoredAt = new Date();
  this.unsubscribed = false; // Clear unsubscribe status
  this.unsubscribedAt = null;
  return this.save();
};

DetectedServiceSchema.methods.restore = function() {
  this.unsubscribed = false;
  this.ignored = false;
  this.unsubscribedAt = null;
  this.ignoredAt = null;
  return this.save();
};

// ✅ Static methods for queries
DetectedServiceSchema.statics.findActiveServicesForUser = function(userId) {
  return this.find({
    user: userId,
    unsubscribed: false,
    ignored: false
  }).sort({ lastSeen: -1 });
};

DetectedServiceSchema.statics.findByCategory = function(userId, category) {
  return this.find({
    user: userId,
    category: category
  }).sort({ confidence: -1 });
};

DetectedServiceSchema.statics.getUserStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { user: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalServices: { $sum: 1 },
        activeServices: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$unsubscribed', false] }, { $eq: ['$ignored', false] }] },
              1,
              0
            ]
          }
        },
        unsubscribedServices: {
          $sum: { $cond: [{ $eq: ['$unsubscribed', true] }, 1, 0] }
        },
        ignoredServices: {
          $sum: { $cond: [{ $eq: ['$ignored', true] }, 1, 0] }
        },
        suspiciousServices: {
          $sum: { $cond: [{ $eq: ['$suspicious', true] }, 1, 0] }
        },
        categoryDistribution: {
          $push: '$category'
        }
      }
    }
  ]);

  return stats[0] || {
    totalServices: 0,
    activeServices: 0,
    unsubscribedServices: 0,
    ignoredServices: 0,
    suspiciousServices: 0,
    categoryDistribution: []
  };
};

const DetectedService = mongoose.model('DetectedService', DetectedServiceSchema);

// ✅ Enhanced Platform Detection Class
class PlatformDetector {
  constructor() {
    // ✅ Expanded platform patterns with confidence scoring
    this.platformPatterns = {
      'Netflix': {
        domains: ['netflix.com', 'netflix.net'],
        keywords: ['netflix', 'streaming', 'continue watching'],
        confidence: 95,
        category: 'entertainment'
      },
      'Spotify': {
        domains: ['spotify.com', 'spotifymail.com'],
        keywords: ['spotify', 'music', 'playlist', 'premium'],
        confidence: 95,
        category: 'entertainment'
      },
      'Amazon': {
        domains: ['amazon.com', 'amazon.co.uk', 'amazon.in', 'amazonses.com'],
        keywords: ['amazon', 'prime', 'order', 'shipment'],
        confidence: 90,
        category: 'ecommerce'
      },
      'Facebook': {
        domains: ['facebook.com', 'facebookmail.com'],
        keywords: ['facebook', 'meta', 'friend request', 'notification'],
        confidence: 95,
        category: 'social'
      },
      'Instagram': {
        domains: ['instagram.com', 'instagrammail.com'],
        keywords: ['instagram', 'photo', 'story', 'follow'],
        confidence: 95,
        category: 'social'
      },
      'LinkedIn': {
        domains: ['linkedin.com', 'linkedinlabs.com'],
        keywords: ['linkedin', 'connection', 'job', 'professional'],
        confidence: 95,
        category: 'professional'
      },
      'GitHub': {
        domains: ['github.com', 'github.net'],
        keywords: ['github', 'repository', 'pull request', 'commit'],
        confidence: 95,
        category: 'development'
      },
      'Discord': {
        domains: ['discord.com', 'discordapp.com'],
        keywords: ['discord', 'server', 'message', 'gaming'],
        confidence: 95,
        category: 'communication'
      },
      'YouTube': {
        domains: ['youtube.com', 'youtubemail.com'],
        keywords: ['youtube', 'video', 'channel', 'subscribe'],
        confidence: 95,
        category: 'entertainment'
      },
      'Slack': {
        domains: ['slack.com', 'slackmail.com'],
        keywords: ['slack', 'workspace', 'channel', 'team'],
        confidence: 95,
        category: 'productivity'
      }
    };

    // ✅ Domain mapping for unknown platforms
    this.domainMap = {
      'coursera.org': { name: 'Coursera', category: 'education', confidence: 85 },
      'udemy.com': { name: 'Udemy', category: 'education', confidence: 85 },
      'hdfcbank.net': { name: 'HDFC Bank', category: 'financial', confidence: 90 },
      'kotak.com': { name: 'Kotak Bank', category: 'financial', confidence: 90 },
      'swiggy.in': { name: 'Swiggy', category: 'ecommerce', confidence: 85 },
      'ajio.com': { name: 'AJIO', category: 'ecommerce', confidence: 85 },
      '1mg.com': { name: 'Tata 1mg', category: 'ecommerce', confidence: 85 },
      'internshala.com': { name: 'Internshala', category: 'education', confidence: 85 },
      'wellfound.com': { name: 'Wellfound', category: 'professional', confidence: 85 },
      'mongodb.com': { name: 'MongoDB', category: 'development', confidence: 90 },
      'lovable.dev': { name: 'Lovable', category: 'development', confidence: 85 }
    };
  }

  // ✅ Enhanced platform analysis with confidence scoring
  analyzePlatform(emailData) {
    try {
      const headers = emailData.payload.headers || [];
      const fromHeader = headers.find(h => h.name.toLowerCase() === 'from');
      const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject');
      const dateHeader = headers.find(h => h.name.toLowerCase() === 'date');

      if (!fromHeader) return null;

      const fromValue = fromHeader.value;
      const subject = subjectHeader?.value || '';
      const combined = (fromValue + ' ' + subject).toLowerCase();

      // Extract email address
      const emailMatch = fromValue.match(/<(.+?)>/);
      const email = emailMatch ? emailMatch[1] : fromValue.split(' ')[0];
      
      if (!email.includes('@')) return null;

      const domain = email.split('@')[1]?.toLowerCase();
      if (!domain) return null;

      // ✅ Check against known platform patterns
      for (const [platformName, config] of Object.entries(this.platformPatterns)) {
        // Check domain match
        if (config.domains.some(d => domain.includes(d))) {
          return {
            name: platformName,
            domain: domain,
            sender: email,
            date: dateHeader?.value || 'Unknown',
            confidence: config.confidence,
            category: config.category,
            detectionMethod: 'domain_match'
          };
        }

        // Check keyword match
        if (config.keywords.some(keyword => combined.includes(keyword))) {
          return {
            name: platformName,
            domain: domain,
            sender: email,
            date: dateHeader?.value || 'Unknown',
            confidence: Math.max(50, config.confidence - 20), // Reduce confidence for keyword-only matches
            category: config.category,
            detectionMethod: 'keyword_match'
          };
        }
      }

      // ✅ Check domain mapping
      if (this.domainMap[domain]) {
        const mapping = this.domainMap[domain];
        return {
          name: mapping.name,
          domain: domain,
          sender: email,
          date: dateHeader?.value || 'Unknown',
          confidence: mapping.confidence,
          category: mapping.category,
          detectionMethod: 'domain_mapping'
        };
      }

      // ✅ Extract platform name from domain
      let platformName = this.capitalizeFirstLetter(domain.split('.')[0]);
      
      // Handle subdomain patterns
      if (['mail', 'noreply', 'no-reply', 'support', 'team'].includes(platformName.toLowerCase())) {
        const domainParts = domain.split('.');
        if (domainParts.length > 1) {
          platformName = this.capitalizeFirstLetter(domainParts[domainParts.length - 2]);
        }
      }

      return {
        name: platformName,
        domain: domain,
        sender: email,
        date: dateHeader?.value || 'Unknown',
        confidence: 40, // Lower confidence for unknown platforms
        category: this.guessCategory(combined),
        detectionMethod: 'domain_extraction'
      };

    } catch (error) {
      logger.error('Platform analysis failed', {
        messageId: emailData.id,
        error: error.message
      });
      return null;
    }
  }

  // ✅ Intelligent category guessing
  guessCategory(text) {
    const categoryKeywords = {
      social: ['friend', 'follow', 'like', 'share', 'social', 'connect'],
      ecommerce: ['order', 'purchase', 'buy', 'cart', 'shop', 'sale', 'deal'],
      financial: ['bank', 'payment', 'credit', 'debit', 'loan', 'investment'],
      entertainment: ['watch', 'stream', 'music', 'video', 'movie', 'show'],
      education: ['course', 'learn', 'study', 'lesson', 'certificate', 'training'],
      productivity: ['task', 'project', 'work', 'manage', 'organize', 'calendar'],
      communication: ['message', 'chat', 'call', 'meet', 'conference', 'team']
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category;
      }
    }

    return 'other';
  }

  capitalizeFirstLetter(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// ✅ Enhanced platform detection function
async function detectPlatforms(user, options = {}) {
  const userId = user.id || user._id;
  const {
    maxMessages = 1000,
    forceRefresh = false,
    progressCallback = null
  } = options;

  try {
    logger.info('Starting enhanced platform detection', {
      userId,
      email: user.email,
      maxMessages,
      forceRefresh
    });

    // ✅ Check cache first unless forcing refresh
    if (!forceRefresh) {
      const cached = getUserServices(userId);
      if (cached && cached.length > 0) {
        logger.info('Returning cached platform data', { 
          userId, 
          count: cached.length 
        });
        
        if (progressCallback) {
          progressCallback({
            stage: 'cache_hit',
            processed: cached.length,
            total: cached.length,
            percentage: 100
          });
        }
        
        return cached.map(service => service.platform);
      }
    }

    // ✅ Use enhanced token manager
    const gmail = await tokenManager.getGmailForUser(userId);
    const detector = new PlatformDetector();
    
    const detectedPlatforms = [];
    const seen = new Set();
    let nextPageToken = null;
    let messageCount = 0;
    let pageCount = 0;

    // ✅ Enhanced query for better results
    const query = 'welcome OR "confirm your" OR "verify your" OR signup OR "get started" OR "new account" OR "thanks for" after:2022/01/01';

    while (messageCount < maxMessages && pageCount < 20) { // Safety limits
      try {
        const res = await gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: Math.min(100, maxMessages - messageCount),
          pageToken: nextPageToken,
        });

        const messages = res.data.messages || [];
        nextPageToken = res.data.nextPageToken;
        pageCount++;

        if (messages.length === 0) break;

        // ✅ Process messages with error handling
        for (const msg of messages) {
          try {
            const full = await gmail.users.messages.get({
              userId: 'me',
              id: msg.id,
              format: 'full'
            });

            const platform = detector.analyzePlatform(full.data);
            
            if (platform && !seen.has(platform.name)) {
              // ✅ Check if service already exists in database
              const existingService = await DetectedService.findOne({
                user: userId,
                domain: platform.domain
              });

              if (!existingService) {
                // ✅ Create new detected service
                const newService = new DetectedService({
                  user: userId,
                  platform: platform.name,
                  domain: platform.domain,
                  sender: platform.sender,
                  email: platform.sender,
                  subject: full.data.payload.headers.find(h => h.name.toLowerCase() === 'subject')?.value || '',
                  date: new Date(platform.date !== 'Unknown' ? platform.date : Date.now()),
                  confidence: platform.confidence,
                  category: platform.category,
                  messageId: msg.id,
                  snippet: full.data.snippet || '',
                  detectedAt: new Date(),
                  detectorVersion: '2.0'
                });

                await newService.save();
                logger.debug('New service detected and saved', {
                  userId,
                  platform: platform.name,
                  domain: platform.domain,
                  confidence: platform.confidence
                });
              }

              seen.add(platform.name);
              detectedPlatforms.push(platform.name);
            }

            messageCount++;

            // ✅ Progress callback
            if (progressCallback && messageCount % 50 === 0) {
              progressCallback({
                stage: 'detecting',
                processed: messageCount,
                total: Math.min(maxMessages, messageCount * 1.5), // Estimate
                percentage: Math.min(90, (messageCount / maxMessages) * 90),
                currentPlatform: platform?.name || 'Unknown'
              });
            }

          } catch (messageError) {
            logger.warn('Error processing individual message', {
              userId,
              messageId: msg.id,
              error: messageError.message
            });
            continue; // Skip this message and continue
          }
        }

        if (!nextPageToken) break;

        // ✅ Respectful delay between API calls
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (pageError) {
        logger.error('Error processing message page', {
          userId,
          pageCount,
          error: pageError.message
        });
        break; // Exit the loop on page errors
      }
    }

    logger.info('Enhanced platform detection completed', {
      userId,
      totalProcessed: messageCount,
      platformsFound: detectedPlatforms.length,
      platforms: detectedPlatforms.slice(0, 10).join(', ')
    });

    // ✅ Cache results
    if (detectedPlatforms.length > 0) {
      setUserServices(userId, detectedPlatforms, 1800); // Cache for 30 minutes
    }

    // ✅ Final progress callback
    if (progressCallback) {
      progressCallback({
        stage: 'complete',
        processed: detectedPlatforms.length,
        total: detectedPlatforms.length,
        percentage: 100,
        message: `Detected ${detectedPlatforms.length} platforms`
      });
    }

    return Array.from(seen);

  } catch (error) {
    logger.error('Enhanced platform detection failed', {
      userId,
      error: error.message,
      stack: error.stack
    });

    // Clear user cache on critical errors
    if (error.message.includes('REAUTH_REQUIRED') || error.message.includes('invalid_grant')) {
      clearUserCache(userId);
    }

    throw error;
  }
}

// ✅ Helper function to get user's detected services
async function getUserDetectedServices(userId, options = {}) {
  const {
    includeUnsubscribed = true,
    includeIgnored = true,
    category = null,
    sortBy = 'lastSeen',
    limit = null
  } = options;

  try {
    let query = { user: userId };

    // Apply filters
    if (!includeUnsubscribed) {
      query.unsubscribed = false;
    }
    
    if (!includeIgnored) {
      query.ignored = false;
    }
    
    if (category) {
      query.category = category;
    }

    let serviceQuery = DetectedService.find(query);

    // Apply sorting
    const sortOptions = {
      lastSeen: { lastSeen: -1 },
      platform: { platform: 1 },
      confidence: { confidence: -1 },
      date: { date: -1 }
    };
    
    if (sortOptions[sortBy]) {
      serviceQuery = serviceQuery.sort(sortOptions[sortBy]);
    }

    // Apply limit
    if (limit) {
      serviceQuery = serviceQuery.limit(limit);
    }

    const services = await serviceQuery.exec();
    
    logger.debug('Retrieved user detected services', {
      userId,
      count: services.length,
      filters: { includeUnsubscribed, includeIgnored, category }
    });

    return services;

  } catch (error) {
    logger.error('Error retrieving user detected services', {
      userId,
      error: error.message
    });
    throw error;
  }
}

module.exports = {
  DetectedService,
  detectPlatforms,
  getUserDetectedServices,
  PlatformDetector
};
