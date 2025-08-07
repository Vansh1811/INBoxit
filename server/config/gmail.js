// File: helpers/gmail.js

const { google } = require('googleapis');
const tokenManager = require('../utils/tokenManager');

/**
 * Creates an authenticated Gmail API client for a given user.
 * Automatically refreshes tokens and persists updates to the database.
 *
 * @param {string} userId  MongoDB User ID
 * @returns {Promise<import('googleapis').gmail_v1.Gmail>} Authenticated Gmail client
 */
async function getGmailClientForUser(userId) {
  // tokenManager handles refresh, errors, and logging internally
  return await tokenManager.getGmailForUser(userId);
}

/**
 * Legacy helper: builds a Gmail client directly from tokens.
 * Prefer getGmailClientForUser for automatic refresh & persistence.
 *
 * @param {object} tokens 
 * @param {string} tokens.accessToken  OAuth2 access token
 * @param {string} [tokens.refreshToken]  OAuth2 refresh token
 * @returns {import('googleapis').gmail_v1.Gmail} Gmail client
 */
function getGmailClientFromTokens({ accessToken, refreshToken }) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    ...(refreshToken && { refresh_token: refreshToken })
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

module.exports = {
  getGmailClientForUser,
  getGmailClientFromTokens
};
