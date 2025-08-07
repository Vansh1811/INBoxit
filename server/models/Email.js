const mongoose = require('mongoose');
const logger = require('../utils/logger');

// ✅ Enhanced Email Schema with comprehensive validation
const EmailSchema = new mongoose.Schema({
  // ✅ User relationship with proper referencing
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true // Performance optimization for user queries
  },
  
  // ✅ Legacy field for backward compatibility
  userId: {
    type: String,
    required: false, // Will be deprecated in favor of 'user' field
    index: true
  },
  
  // ✅ Enhanced email metadata with validation
  messageId: {
    type: String,
    required: true,
    unique: true, // Prevent duplicate emails
    index: true
  },
  
  threadId: {
    type: String,
    index: true // For conversation threading
  },
  
  from: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
    index: true // For sender-based queries
  },
  
  to: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000,
    index: 'text' // Enable text search
  },
  
  date: {
    type: Date,
    required: true,
    index: true // Critical for time-based queries
  },
  
  snippet: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // ✅ Enhanced email body storage
  body: {
    plain: {
      type: String,
      maxlength: 50000 // Limit to prevent memory issues
    },
    html: {
      type: String,
      maxlength: 100000
    }
  },
  
  // ✅ Gmail-specific metadata
  labelIds: [{
    type: String,
    index: true
  }],
  
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  
  isImportant: {
    type: Boolean,
    default: false
  },
  
  // ✅ Enhanced platform detection
  platform: {
    name: {
      type: String,
      trim: true,
      maxlength: 100,
      index: true
    },
    domain: {
      type: String,
      lowercase: true,
      trim: true,
      index: true // Critical for platform grouping
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    category: {
      type: String,
      enum: ['social', 'ecommerce', 'newsletter', 'entertainment', 'productivity', 
             'financial', 'education', 'communication', 'marketing', 'other'],
      default: 'other',
      index: true
    }
  },
  
  // ✅ Advanced signup detection
  signupIndicators: {
    isSignup: {
      type: Boolean,
      default: false,
      index: true
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    detectionReasons: [String],
    keywords: [String],
    detectorVersion: {
      type: String,
      default: '2.0'
    }
  },
  
  // ✅ Unsubscribe link detection and management
  unsubscribeLinks: [{
    url: {
      type: String,
      trim: true
    },
    method: {
      type: String,
      enum: ['link', 'mailto', 'api', 'manual'],
      default: 'link'
    },
    verified: {
      type: Boolean,
      default: false
    },
    lastChecked: Date
  }],
  
  // ✅ Email analysis metadata
  analysis: {
    wordCount: Number,
    languageDetected: String,
    sentimentScore: {
      type: Number,
      min: -1,
      max: 1
    },
    spamScore: {
      type: Number,
      min: 0,
      max: 100
    },
    hasImages: Boolean,
    hasAttachments: Boolean,
    attachmentCount: {
      type: Number,
      default: 0
    }
  },
  
  // ✅ Processing status and metadata
  processingStatus: {
    type: String,
    enum: ['pending', 'processed', 'analyzed', 'classified', 'error'],
    default: 'pending',
    index: true
  },
  
  processedAt: Date,
  
  errors: [{
    stage: String,
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // ✅ User interaction tracking
  userActions: {
    markedAsRead: Boolean,
    markedAsImportant: Boolean,
    archived: Boolean,
    deleted: Boolean,
    responded: Boolean,
    forwarded: Boolean,
    lastInteraction: Date
  },
  
  // ✅ Relationship to detected services
  detectedService: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DetectedService',
    index: true
  },
  
  // ✅ Source tracking
  source: {
    type: String,
    enum: ['gmail_api', 'imap', 'forwarded', 'imported'],
    default: 'gmail_api'
  },
  
  // ✅ Retention and cleanup
  retentionPolicy: {
    keepUntil: Date,
    reason: {
      type: String,
      enum: ['user_request', 'legal_hold', 'analysis', 'permanent'],
      default: 'analysis'
    }
  }
  
}, {
  timestamps: true,
  versionKey: false
});

// ✅ Enhanced indexes for production performance
EmailSchema.index({ user: 1, date: -1 }); // User emails by date
EmailSchema.index({ user: 1, 'platform.domain': 1 }); // Emails by platform
EmailSchema.index({ user: 1, 'signupIndicators.isSignup': 1 }); // Signup emails
EmailSchema.index({ user: 1, processingStatus: 1 }); // Processing queue
EmailSchema.index({ user: 1, isRead: 1, date: -1 }); // Read/unread emails
EmailSchema.index({ user: 1, labelIds: 1 }); // Gmail labels
EmailSchema.index({ 'platform.domain': 1, date: -1 }); // Platform analysis
EmailSchema.index({ messageId: 1 }, { unique: true }); // Prevent duplicates
EmailSchema.index({ threadId: 1 }); // Threading support

// Compound indexes for complex queries
EmailSchema.index({ 
  user: 1, 
  'signupIndicators.isSignup': 1, 
  'signupIndicators.confidence': -1 
});

EmailSchema.index({
  user: 1,
  'platform.category': 1,
  date: -1
});

// ✅ Text search index for subject and content
EmailSchema.index({
  subject: 'text',
  'body.plain': 'text',
  snippet: 'text'
});

// ✅ Instance methods for email operations
EmailSchema.methods.markAsProcessed = function(status = 'processed') {
  this.processingStatus = status;
  this.processedAt = new Date();
  return this.save();
};

EmailSchema.methods.addSignupIndicators = function(indicators) {
  this.signupIndicators = {
    ...this.signupIndicators,
    ...indicators,
    detectedAt: new Date()
  };
  return this.save();
};

EmailSchema.methods.linkToService = function(serviceId) {
  this.detectedService = serviceId;
  return this.save();
};

EmailSchema.methods.extractUnsubscribeLinks = function() {
  const links = [];
  const bodyText = this.body?.html || this.body?.plain || '';
  
  // Enhanced regex patterns for unsubscribe links
  const patterns = [
    /https?:\/\/[^\s<>"']+unsubscribe[^\s<>"']*/gi,
    /https?:\/\/[^\s<>"']+optout[^\s<>"']*/gi,
    /https?:\/\/[^\s<>"']+opt-out[^\s<>"']*/gi,
    /https?:\/\/[^\s<>"']+manage[_\-]?preferences[^\s<>"']*/gi,
    /https?:\/\/[^\s<>"']+email[_\-]?preferences[^\s<>"']*/gi
  ];
  
  patterns.forEach(pattern => {
    const matches = bodyText.match(pattern) || [];
    matches.forEach(url => {
      if (!links.some(link => link.url === url)) {
        links.push({
          url: url.replace(/['"<>]/g, ''),
          method: 'link',
          verified: false
        });
      }
    });
  });
  
  this.unsubscribeLinks = links;
  return links;
};

// ✅ Static methods for queries and analytics
EmailSchema.statics.findSignupEmailsForUser = function(userId, options = {}) {
  const query = {
    user: userId,
    'signupIndicators.isSignup': true
  };
  
  if (options.minConfidence) {
    query['signupIndicators.confidence'] = { $gte: options.minConfidence };
  }
  
  return this.find(query)
    .sort({ 'signupIndicators.confidence': -1, date: -1 })
    .limit(options.limit || 1000);
};

EmailSchema.statics.findEmailsByPlatform = function(userId, platformDomain) {
  return this.find({
    user: userId,
    'platform.domain': platformDomain
  }).sort({ date: -1 });
};

EmailSchema.statics.getEmailStatistics = async function(userId) {
  const pipeline = [
    { $match: { user: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalEmails: { $sum: 1 },
        signupEmails: {
          $sum: { $cond: ['$signupIndicators.isSignup', 1, 0] }
        },
        readEmails: {
          $sum: { $cond: ['$isRead', 1, 0] }
        },
        processedEmails: {
          $sum: { $cond: [{ $ne: ['$processingStatus', 'pending'] }, 1, 0] }
        },
        platformDistribution: {
          $push: '$platform.domain'
        },
        categoryDistribution: {
          $push: '$platform.category'
        },
        dateRange: {
          earliest: { $min: '$date' },
          latest: { $max: '$date' }
        }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalEmails: 0,
    signupEmails: 0,
    readEmails: 0,
    processedEmails: 0,
    platformDistribution: [],
    categoryDistribution: [],
    dateRange: { earliest: null, latest: null }
  };
};

EmailSchema.statics.cleanupOldEmails = async function(retentionDays = 365) {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  
  const result = await this.deleteMany({
    date: { $lt: cutoffDate },
    'retentionPolicy.reason': { $ne: 'permanent' },
    'userActions.markedAsImportant': { $ne: true }
  });
  
  logger.info('Email cleanup completed', {
    deletedCount: result.deletedCount,
    cutoffDate,
    retentionDays
  });
  
  return result;
};

// ✅ Pre-save middleware for automatic processing
EmailSchema.pre('save', function(next) {
  // Auto-extract platform info from sender if not set
  if (!this.platform.domain && this.from) {
    const emailMatch = this.from.match(/<(.+?)>/) || [null, this.from];
    const email = emailMatch[1];
    
    if (email && email.includes('@')) {
      const domain = email.split('@')[1].toLowerCase();
      this.platform.domain = domain;
      
      // Auto-generate platform name
      if (!this.platform.name) {
        this.platform.name = domain.split('.')[0]
          .charAt(0).toUpperCase() + 
          domain.split('.')[0].slice(1);
      }
    }
  }
  
  // Auto-set processing status
  if (this.isNew && !this.processingStatus) {
    this.processingStatus = 'pending';
  }
  
  // Convert string date to Date object
  if (typeof this.date === 'string') {
    this.date = new Date(this.date);
  }
  
  // Migrate userId to user field
  if (this.userId && !this.user) {
    try {
      this.user = mongoose.Types.ObjectId(this.userId);
    } catch (e) {
      // Handle invalid ObjectId
    }
  }
  
  next();
});

// ✅ Post-save middleware for automatic analysis
EmailSchema.post('save', async function(doc) {
  // Auto-extract unsubscribe links if not done
  if (doc.unsubscribeLinks.length === 0 && (doc.body?.html || doc.body?.plain)) {
    try {
      doc.extractUnsubscribeLinks();
      await doc.save();
    } catch (error) {
      logger.warn('Failed to extract unsubscribe links', {
        emailId: doc._id,
        error: error.message
      });
    }
  }
});

// ✅ Virtual fields for computed properties
EmailSchema.virtual('platformName').get(function() {
  return this.platform?.name || 'Unknown';
});

EmailSchema.virtual('isRecentEmail').get(function() {
  if (!this.date) return false;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return this.date > thirtyDaysAgo;
});

EmailSchema.virtual('hasUnsubscribeOption').get(function() {
  return this.unsubscribeLinks && this.unsubscribeLinks.length > 0;
});

// Ensure virtuals are included in JSON output
EmailSchema.set('toJSON', { virtuals: true });
EmailSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Email', EmailSchema);
