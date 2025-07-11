// server/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: String,
  displayName: String,
  email: String,
  accessToken: String,
  refreshToken: String,
  signupServices: [{
    platform: String,
    email: String,
    domain: String,
    subject: String,
    date: String,
    lastSeen: String,
    suspicious: { type: Boolean, default: false },
    unsubscribed: { type: Boolean, default: false },
    ignored: { type: Boolean, default: false }
  }],
  lastScan: { type: Date, default: null }
});

module.exports = mongoose.model('User', userSchema);
