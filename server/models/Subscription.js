//This model tracks active subscriptions or newsletters the user may want to unsubscribe from.
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  from: String,
  subject: String,
  unsubscribeLink: String,
  userId: String,
  email: String,
  emailId: String,

  // ✅ New fields:
  isUnsubscribed: {
    type: Boolean,
    default: false
  },
  unsubscribedAt: {
    type: Date,
    default: null
  }
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
