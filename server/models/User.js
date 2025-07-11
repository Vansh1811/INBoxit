// server/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: String,
  displayName: String,
  email: String,
  accessToken: String,
  refreshToken: String,
});

module.exports = mongoose.model('User', userSchema);
