const { google } = require('googleapis');
const logger = require('./logger');
const User = require('../models/User');

class TokenManager {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL
    );
  }

  async refreshAccessToken(user) {
    try {
      if (!user.refreshToken) {
        throw new Error('REAUTH_REQUIRED: No refresh token available');
      }

      this.oauth2Client.setCredentials({
        refresh_token: user.refreshToken
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      // Prepare update data
      const tokenUpdate = {
        accessToken: credentials.access_token,
        tokenExpiry: credentials.expiry_date,
        lastTokenRefresh: new Date()
      };

      // Keep existing refresh token if new one isn't provided
      if (credentials.refresh_token) {
        tokenUpdate.refreshToken = credentials.refresh_token;
      }

      // ✅ CRITICAL: Update database with new tokens
      await User.findByIdAndUpdate(user._id, tokenUpdate);

      logger.info('Token refreshed and persisted successfully', {
        userId: user._id,
        expiryDate: new Date(credentials.expiry_date)
      });

      return {
        accessToken: credentials.access_token,
        expiryDate: credentials.expiry_date,
        refreshToken: credentials.refresh_token || user.refreshToken
      };

    } catch (error) {
      logger.error('Token refresh failed:', {
        userId: user._id,
        error: error.message,
        code: error.code
      });

      // Handle specific Google OAuth errors
      if (error.code === 400 && error.message.includes('invalid_grant')) {
        throw new Error('REAUTH_REQUIRED: Refresh token expired');
      }

      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  async validateAndRefreshToken(user) {
    if (!user.accessToken) {
      throw new Error('REAUTH_REQUIRED: No access token available');
    }

    // Check if token is expired or will expire soon (within 10 minutes)
    const now = Date.now();
    const expiryBuffer = 10 * 60 * 1000; // 10 minutes safety buffer
    
    if (user.tokenExpiry && (user.tokenExpiry - now) < expiryBuffer) {
      logger.info('Token expired or expiring soon, refreshing...', {
        userId: user._id,
        expiryDate: new Date(user.tokenExpiry),
        timeUntilExpiry: Math.round((user.tokenExpiry - now) / 1000 / 60) + ' minutes'
      });

      const newTokens = await this.refreshAccessToken(user);
      
      // Return updated tokens
      return {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiryDate: newTokens.expiryDate,
        wasRefreshed: true
      };
    }

    return {
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
      expiryDate: user.tokenExpiry,
      wasRefreshed: false
    };
  }

  async createAuthenticatedGmailClient(userId) {
    try {
      // Get fresh user data from database
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const tokens = await this.validateAndRefreshToken(user);
      
      this.oauth2Client.setCredentials({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken
      });

      const gmail = google.gmail({
        version: 'v1',
        auth: this.oauth2Client
      });

      // Test the connection
      await gmail.users.getProfile({ userId: 'me' });

      logger.info('Gmail client created successfully', {
        userId,
        tokenRefreshed: tokens.wasRefreshed
      });

      return gmail;

    } catch (error) {
      logger.error('Failed to create Gmail client:', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  // Helper method for routes to get fresh Gmail client
  async getGmailForUser(userId) {
    return await this.createAuthenticatedGmailClient(userId);
  }
}

module.exports = new TokenManager();
