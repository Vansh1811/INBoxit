const mongoose = require('mongoose');

// ✅ Enhanced service schema with better validation
const signupServiceSchema = new mongoose.Schema({
  platform: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  domain: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  sender: {
    type: String,
    trim: true
  },
  subject: {
    type: String,
    trim: true,
    maxlength: 500
  },
  date: String,
  messageId: String,
  lastSeen: {
    type: Date,
    default: Date.now
  },
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },
  suspicious: {
    type: Boolean,
    default: false
  },
  unsubscribed: {
    type: Boolean,
    default: false
  },
  unsubscribedAt: Date,
  unsubscribeMethod: {
    type: String,
    enum: ['manual', 'automatic', 'api'],
    default: 'manual'
  },
  ignored: {
    type: Boolean,
    default: false
  },
  ignoredAt: Date,
  isNew: {
    type: Boolean,
    default: false
  },
  category: {
    type: String,
    enum: ['newsletter', 'marketing', 'transactional', 'notification', 'other'],
    default: 'other'
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'occasional', 'unknown'],
    default: 'unknown'
  }
}, {
  timestamps: true
});

// ✅ Enhanced main user schema
const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  profilePicture: String,
  
  // ✅ Enhanced token management
  accessToken: String,
  refreshToken: String,
  tokenExpiry: Date,
  lastTokenRefresh: Date,
  tokenRefreshCount: {
    type: Number,
    default: 0
  },
  
  // ✅ Service management
  signupServices: [signupServiceSchema],
  
  // ✅ Scan tracking
  lastScan: Date,
  lastIncrementalScan: Date,
  scanCount: {
    type: Number,
    default: 0
  },
  lastScanStats: {
    totalFound: { type: Number, default: 0 },
    newServices: { type: Number, default: 0 },
    suspicious: { type: Number, default: 0 },
    domains: { type: Number, default: 0 },
    scanDuration: Number,
    emailsProcessed: { type: Number, default: 0 }
  },
  
  // ✅ Enhanced user preferences
  preferences: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    autoScan: {
      type: Boolean,
      default: false
    },
    scanFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'weekly'
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    },
    language: {
      type: String,
      default: 'en'
    },
    timezone: String,
    unsubscribeConfirmation: {
      type: Boolean,
      default: true
    },
    dataRetention: {
      type: Number,
      default: 365 // Days
    }
  },
  
  // ✅ Usage analytics
  analytics: {
    totalUnsubscribed: {
      type: Number,
      default: 0
    },
    totalIgnored: {
      type: Number,
      default: 0
    },
    lastLoginDate: Date,
    loginCount: {
      type: Number,
      default: 0
    },
    apiCallsCount: {
      type: Number,
      default: 0
    },
    emailsScanned: {
      type: Number,
      default: 0
    }
  },
  
  // ✅ Account status and security
  accountStatus: {
    type: String,
    enum: ['active', 'suspended', 'inactive'],
    default: 'active'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  premiumExpiresAt: Date,
  
  // ✅ Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastActive: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: Date
}, {
  timestamps: true,
  versionKey: false
});

// ✅ Enhanced indexes for better performance
userSchema.index({ googleId: 1 }, { unique: true });
userSchema.index({ email: 1 });
userSchema.index({ lastActive: -1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ 'signupServices.domain': 1 });
userSchema.index({ 'signupServices.platform': 1 });
userSchema.index({ 'signupServices.unsubscribed': 1 });
userSchema.index({ 'signupServices.lastSeen': -1 });

// Compound indexes for complex queries
userSchema.index({ googleId: 1, lastActive: -1 });
userSchema.index({ accountStatus: 1, isPremium: 1 });

// ✅ Pre-save middleware for enhanced functionality
userSchema.pre('save', function(next) {
  // Update lastActive
  this.lastActive = new Date();
  
  // Update analytics on service changes
  if (this.isModified('signupServices')) {
    this.analytics.totalUnsubscribed = this.signupServices.filter(s => s.unsubscribed).length;
    this.analytics.totalIgnored = this.signupServices.filter(s => s.ignored).length;
  }
  
  // Update scan count
  if (this.isModified('lastScan')) {
    this.scanCount += 1;
  }
  
  // Track token refreshes
  if (this.isModified('accessToken') && !this.isNew) {
    this.tokenRefreshCount += 1;
    this.lastTokenRefresh = new Date();
  }
  
  next();
});

// ✅ Instance methods for user operations
userSchema.methods.updateLastLogin = function() {
  this.lastActive = new Date();
  this.analytics.lastLoginDate = new Date();
  this.analytics.loginCount += 1;
  return this.save();
};

userSchema.methods.addSignupService = function(serviceData) {
  // Check if service already exists
  const existingService = this.signupServices.find(s => s.domain === serviceData.domain);
  
  if (existingService) {
    // Update existing service
    existingService.lastSeen = new Date();
    existingService.isNew = false;
  } else {
    // Add new service
    this.signupServices.push({
      ...serviceData,
      isNew: true,
      lastSeen: new Date()
    });
  }
  
  return this.save();
};

userSchema.methods.markServiceAsUnsubscribed = function(domain, method = 'manual') {
  const service = this.signupServices.find(s => s.domain === domain);
  if (service) {
    service.unsubscribed = true;
    service.unsubscribedAt = new Date();
    service.unsubscribeMethod = method;
    service.ignored = false; // Clear ignore flag
  }
  return this.save();
};

userSchema.methods.getActiveServices = function() {
  return this.signupServices.filter(s => !s.unsubscribed && !s.ignored);
};

userSchema.methods.getServicesByCategory = function(category) {
  return this.signupServices.filter(s => s.category === category);
};

// ✅ Static methods for user queries
userSchema.statics.findActiveUsers = function(days = 30) {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.find({
    lastActive: { $gte: cutoffDate },
    accountStatus: 'active'
  });
};

userSchema.statics.getUserStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: {
          $sum: {
            $cond: [
              { $eq: ['$accountStatus', 'active'] },
              1,
              0
            ]
          }
        },
        premiumUsers: {
          $sum: {
            $cond: [
              { $eq: ['$isPremium', true] },
              1,
              0
            ]
          }
        },
        totalServices: { $sum: { $size: '$signupServices' } },
        totalUnsubscribed: { $sum: '$analytics.totalUnsubscribed' }
      }
    }
  ]);
  
  return stats[0] || {
    totalUsers: 0,
    activeUsers: 0,
    premiumUsers: 0,
    totalServices: 0,
    totalUnsubscribed: 0
  };
};

// ✅ Virtual fields
userSchema.virtual('serviceCount').get(function() {
  return this.signupServices.length;
});

userSchema.virtual('activeServiceCount').get(function() {
  return this.signupServices.filter(s => !s.unsubscribed && !s.ignored).length;
});

userSchema.virtual('unsubscribedCount').get(function() {
  return this.signupServices.filter(s => s.unsubscribed).length;
});

// Ensure virtuals are included in JSON output
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
