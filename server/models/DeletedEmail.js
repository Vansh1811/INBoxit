const mongoose = require('mongoose');

const DeletedEmailSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  domain: {
    type: String,
    required: true,
    index: true
  },
  deletedCount: {
    type: Number,
    required: true
  },
  errorCount: {
    type: Number,
    default: 0
  },
  deletedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  errors: [{
    emailId: String,
    error: String
  }],
  // For potential undo functionality
  canUndo: {
    type: Boolean,
    default: false
  },
  undoExpiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  }
});

// Index for efficient queries
DeletedEmailSchema.index({ user: 1, domain: 1 });
DeletedEmailSchema.index({ deletedAt: -1 });

module.exports = mongoose.model('DeletedEmail', DeletedEmailSchema);
