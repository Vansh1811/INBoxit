const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { clearUserCache } = require('../utils/cache');

// ✅ Enhanced Subscription Schema with comprehensive validation
const SubscriptionSchema = new mongoose.Schema({
  // ✅ Proper user relationship
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // ✅ Legacy support for backward compatibility
  userId: {
    type: String,
    required: false, // Will be deprecated
    index: true
  },
  
  // ✅ Enhanced subscription metadata
  platform: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  
  domain: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true // Critical for deduplication
  },
  
  from: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Invalid email format'
    }
  },
  
  subject: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // ✅ Enhanced unsubscribe management
  unsubscribeLink: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Optional field
        return /^https?:\/\/.+/.test(v);
      },
      message: 'Invalid URL format'
    }
  },
  
  unsubscribeMethod: {
    type: String,
    enum: ['link', 'mailto', 'api', 'manual', 'bulk'],
    default: 'manual'
  },
  
  // ✅ Enhanced status tracking
  isUnsubscribed: {
    type: Boolean,
    default: false,
    index: true
  },
  
  unsubscribedAt: {
    type: Date,
    default: null,
    index: true
  },
  
  unsubscribeReason: {
    type: String,
    enum: ['user_request', 'bulk_action', 'suspicious', 'inactive', 'spam'],
    default: 'user_request'
  },
  
  // ✅ Additional management states
  isIgnored: {
    type: Boolean,
    default: false,
    index: true
  },
  
  ignoredAt: Date,
  
  isPaused: {
    type: Boolean,
    default: false
  },
  
  pausedAt: Date,
  pausedUntil: Date,
  
  // ✅ Subscription metadata and analytics
  category: {
    type: String,
    enum: ['social', 'ecommerce', 'newsletter', 'entertainment', 'productivity', 
           'financial', 'education', 'communication', 'marketing', 'other'],
    default: 'other',
    index: true
  },
  
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'occasional', 'unknown'],
    default: 'unknown'
  },
  
  importance: {
    type: String,
    enum: ['high', 'medium', 'low', 'unknown'],
    default: 'unknown'
  },
  
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },
  
  // ✅ Gmail integration
  emailId: {
    type: String,
    index: true
  },
  
  messageId: String,
  threadId: String,
  
  // ✅ Relationships to other models
  detectedService: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DetectedService',
    index: true
  },
  
  relatedEmails: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Email'
  }],
  
  // ✅ Subscription tracking
  firstSeen: {
    type: Date,
    default: Date.now
  },
  
  lastSeen: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  emailCount: {
    type: Number,
    default: 1,
    min: 0
  },
  
  lastEmailDate: Date,
  
  // ✅ Unsubscribe attempt tracking
  unsubscribeAttempts: [{
    attemptedAt: {
      type: Date,
      default: Date.now
    },
    method: {
      type: String,
      enum: ['link_click', 'api_call', 'manual', 'bulk']
    },
    successful: Boolean,
    errorMessage: String,
    responseCode: Number,
    responseTime: Number // milliseconds
  }],
  
  // ✅ User interaction tracking
  userActions: {
    markedAsImportant: Boolean,
    addedToWhitelist: Boolean,
    reportedAsSpam: Boolean,
    customCategory: String,
    notes: {
      type: String,
      maxlength: 1000
    }
  },
  
  // ✅ Analytics and insights
  analytics: {
    openRate: {
      type: Number,
      min: 0,
      max: 100
    },
    lastOpened: Date,
    clickThrough: {
      type: Number,
      default: 0
    },
    averageTimeToRead: Number, // seconds
    deviceTypes: [String], // mobile, desktop, tablet
    geoLocations: [String]
  },
  
  // ✅ Processing and validation
  isVerified: {
    type: Boolean,
    default: false
  },
  
  verifiedAt: Date,
  
  isSuspicious: {
    type: Boolean,
    default: false,
    index: true
  },
  
  suspiciousReasons: [String],
  
  // ✅ Compliance and legal
  gdprCompliant: {
    type: Boolean,
    default: true
  },
  
  dataRetentionUntil: Date,
  
  consentGiven: {
    type: Boolean,
    default: true
  },
  
  consentDate: Date

}, {
  timestamps: true,
  versionKey: false
});

// ✅ Enhanced indexes for production performance
SubscriptionSchema.index({ user: 1, domain: 1 }, { unique: true });
SubscriptionSchema.index({ user: 1, platform: 1 });
SubscriptionSchema.index({ user: 1, category: 1 });
SubscriptionSchema.index({ user: 1, isUnsubscribed: 1, isIgnored: 1 });
SubscriptionSchema.index({ user: 1, lastSeen: -1 });
SubscriptionSchema.index({ user: 1, confidence: -1 });
SubscriptionSchema.index({ user: 1, frequency: 1 });

// Compound indexes for complex queries
SubscriptionSchema.index({ user: 1, category: 1, isUnsubscribed: 1 });
SubscriptionSchema.index({ user: 1, isSuspicious: 1, confidence: -1 });
SubscriptionSchema.index({ domain: 1, isUnsubscribed: 1 });

// ✅ Instance methods for subscription management
SubscriptionSchema.methods.unsubscribe = async function(method = 'manual', reason = 'user_request') {
  this.isUnsubscribed = true;
  this.unsubscribedAt = new Date();
  this.unsubscribeMethod = method;
  this.unsubscribeReason = reason;
  
  // Clear other states
  this.isIgnored = false;
  this.ignoredAt = null;
  this.isPaused = false;
  this.pausedAt = null;
  
  const result = await this.save();
  
  // Clear user cache
  clearUserCache(this.user.toString());
  
  logger.info('Subscription unsubscribed', {
    subscriptionId: this._id,
    userId: this.user,
    platform: this.platform,
    method,
    reason
  });
  
  return result;
};

SubscriptionSchema.methods.ignore = async function() {
  this.isIgnored = true;
  this.ignoredAt = new Date();
  
  // Clear unsubscribe status
  this.isUnsubscribed = false;
  this.unsubscribedAt = null;
  
  const result = await this.save();
  
  // Clear user cache
  clearUserCache(this.user.toString());
  
  logger.info('Subscription ignored', {
    subscriptionId: this._id,
    userId: this.user,
    platform: this.platform
  });
  
  return result;
};

SubscriptionSchema.methods.restore = async function() {
  this.isUnsubscribed = false;
  this.unsubscribedAt = null;
  this.isIgnored = false;
  this.ignoredAt = null;
  this.isPaused = false;
  this.pausedAt = null;
  
  const result = await this.save();
  
  // Clear user cache
  clearUserCache(this.user.toString());
  
  logger.info('Subscription restored', {
    subscriptionId: this._id,
    userId: this.user,
    platform: this.platform
  });
  
  return result;
};

SubscriptionSchema.methods.pause = async function(until = null) {
  this.isPaused = true;
  this.pausedAt = new Date();
  if (until) {
    this.pausedUntil = new Date(until);
  }
  
  const result = await this.save();
  
  logger.info('Subscription paused', {
    subscriptionId: this._id,
    userId: this.user,
    platform: this.platform,
    pausedUntil: this.pausedUntil
  });
  
  return result;
};

SubscriptionSchema.methods.recordUnsubscribeAttempt = async function(attempt) {
  this.unsubscribeAttempts.push({
    attemptedAt: new Date(),
    method: attempt.method || 'manual',
    successful: attempt.successful || false,
    errorMessage: attempt.errorMessage,
    responseCode: attempt.responseCode,
    responseTime: attempt.responseTime
  });
  
  // Keep only last 10 attempts
  if (this.unsubscribeAttempts.length > 10) {
    this.unsubscribeAttempts = this.unsubscribeAttempts.slice(-10);
  }
  
  return await this.save();
};

SubscriptionSchema.methods.updateLastSeen = async function() {
  this.lastSeen = new Date();
  this.emailCount += 1;
  return await this.save();
};

// ✅ Static methods for queries and analytics
SubscriptionSchema.statics.findActiveForUser = function(userId) {
  return this.find({
    user: userId,
    isUnsubscribed: false,
    isIgnored: false,
    isPaused: false
  }).sort({ lastSeen: -1 });
};

SubscriptionSchema.statics.findByCategory = function(userId, category) {
  return this.find({
    user: userId,
    category: category
  }).sort({ confidence: -1, lastSeen: -1 });
};

SubscriptionSchema.statics.findSuspicious = function(userId) {
  return this.find({
    user: userId,
    $or: [
      { isSuspicious: true },
      { confidence: { $lt: 30 } }
    ]
  }).sort({ confidence: 1 });
};

SubscriptionSchema.statics.getUserSubscriptionStats = async function(userId) {
  const pipeline = [
    { $match: { user: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalSubscriptions: { $sum: 1 },
        activeSubscriptions: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$isUnsubscribed', false] },
                  { $eq: ['$isIgnored', false] },
                  { $eq: ['$isPaused', false] }
                ]
              },
              1,
              0
            ]
          }
        },
        unsubscribedCount: {
          $sum: { $cond: ['$isUnsubscribed', 1, 0] }
        },
        ignoredCount: {
          $sum: { $cond: ['$isIgnored', 1, 0] }
        },
        pausedCount: {
          $sum: { $cond: ['$isPaused', 1, 0] }
        },
        suspiciousCount: {
          $sum: { $cond: ['$isSuspicious', 1, 0] }
        },
        categoryDistribution: {
          $push: '$category'
        },
        frequencyDistribution: {
          $push: '$frequency'
        },
        averageConfidence: { $avg: '$confidence' },
        totalEmailCount: { $sum: '$emailCount' },
        lastActivity: { $max: '$lastSeen' }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    unsubscribedCount: 0,
    ignoredCount: 0,
    pausedCount: 0,
    suspiciousCount: 0,
    categoryDistribution: [],
    frequencyDistribution: [],
    averageConfidence: 0,
    totalEmailCount: 0,
    lastActivity: null
  };
};

SubscriptionSchema.statics.bulkUnsubscribe = async function(userId, domains, method = 'bulk') {
  const result = await this.updateMany(
    {
      user: userId,
      domain: { $in: domains },
      isUnsubscribed: false
    },
    {
      $set: {
        isUnsubscribed: true,
        unsubscribedAt: new Date(),
        unsubscribeMethod: method,
        unsubscribeReason: 'bulk_action',
        isIgnored: false,
        ignoredAt: null
      }
    }
  );
  
  // Clear user cache
  clearUserCache(userId.toString());
  
  logger.info('Bulk unsubscribe completed', {
    userId,
    domainsCount: domains.length,
    modifiedCount: result.modifiedCount,
    method
  });
  
  return result;
};

// ✅ Pre-save middleware
SubscriptionSchema.pre('save', function(next) {
  // Auto-migrate userId to user field
  if (this.userId && !this.user) {
    try {
      this.user = mongoose.Types.ObjectId(this.userId);
    } catch (e) {
      // Handle invalid ObjectId
    }
  }
  
  // Auto-extract domain from email if not set
  if (!this.domain && this.email) {
    this.domain = this.email.split('@')[1]?.toLowerCase();
  }
  
  // Auto-generate platform name if not set
  if (!this.platform && this.domain) {
    this.platform = this.domain.split('.')[0]
      .charAt(0).toUpperCase() + 
      this.domain.split('.')[0].slice(1);
  }
  
  // Update lastSeen on any modification
  if (!this.isNew) {
    this.lastSeen = new Date();
  }
  
  next();
});

// ✅ Post-save middleware for analytics
SubscriptionSchema.post('save', async function(doc) {
  // Log significant state changes
  if (doc.isModified('isUnsubscribed') && doc.isUnsubscribed) {
    logger.info('Subscription state changed to unsubscribed', {
      subscriptionId: doc._id,
      userId: doc.user,
      platform: doc.platform,
      method: doc.unsubscribeMethod
    });
  }
});

// ✅ Virtual fields
SubscriptionSchema.virtual('isActive').get(function() {
  return !this.isUnsubscribed && !this.isIgnored && !this.isPaused;
});

SubscriptionSchema.virtual('daysSinceLastSeen').get(function() {
  if (!this.lastSeen) return null;
  return Math.floor((Date.now() - this.lastSeen.getTime()) / (1000 * 60 * 60 * 24));
});

SubscriptionSchema.virtual('unsubscribeSuccessRate').get(function() {
  if (!this.unsubscribeAttempts || this.unsubscribeAttempts.length === 0) {
    return null;
  }
  
  const successful = this.unsubscribeAttempts.filter(a => a.successful).length;
  return (successful / this.unsubscribeAttempts.length) * 100;
});

// Ensure virtuals are included in JSON output
SubscriptionSchema.set('toJSON', { virtuals: true });
SubscriptionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Subscription', SubscriptionSchema);
