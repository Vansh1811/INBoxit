// server/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: String,
  displayName: String,
  email: String,
  accessToken: String,
  refreshToken: String,
  tokenExpiry: Date,
  signupServices: [{
    platform: String,
    email: String,
    domain: String,
    subject: String,
    date: String,
    lastSeen: String,
    suspicious: { type: Boolean, default: false },
    unsubscribed: { type: Boolean, default: false },
    unsubscribedAt: Date,
    ignored: { type: Boolean, default: false },
    ignoredAt: Date,
    isNew: { type: Boolean, default: false }
  }],
  lastScan: { type: Date, default: null },
  preferences: {
    emailNotifications: { type: Boolean, default: true },
    autoScan: { type: Boolean, default: false },
    scanFrequency: { type: String, default: 'weekly' } // daily, weekly, monthly
  },
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now }
});

// Index for better query performance
userSchema.index({ googleId: 1 });
userSchema.index({ email: 1 });
userSchema.index({ 'signupServices.domain': 1 });

// Update lastActive on save
userSchema.pre('save', function(next) {
  this.lastActive = new Date();
  next();
});

module.exports = mongoose.model('User', userSchema);
