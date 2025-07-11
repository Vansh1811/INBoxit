//This model stores raw Gmail email data that might be useful for identifying signups or analyzing email patterns.
// exporting mongoose 
const mongoose = require('mongoose');

const EmailSchema = new mongoose.Schema({   // creating  EMAIL SCHEMA 
  userId: String, // the logged-in user
  from: String,   // senders email address 
  subject: String,
  date: String,
  snippet: String, //overview of the mail 
  platform: String,
  unsubscribeLink: String, // if detected
}, { timestamps: true });                                 // mongoose feature that add createdat and uppdatedat 

module.exports = mongoose.model('Email', EmailSchema);
