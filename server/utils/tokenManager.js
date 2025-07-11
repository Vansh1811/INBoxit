const { google } = require('googleapis');
const logger = require('./logger');

class TokenManager {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL
    );
  }

  async refreshAccessToken(refreshToken) {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      logger.info('Access token refreshed successfully');
      
      return {
        accessToken: credentials.access_token,
        expiryDate: credentials.expiry_date,
        refreshToken: credentials.refresh_token || refreshToken // Keep existing if not provided
      };
    } catch (error) {
      logger.error('Failed to refresh access token:', {
        error: error.message,
        code: error.code
      });
      throw new Error('Token refresh failed');
    }
  }

  async validateAndRefreshToken(user) {
    if (!user.accessToken) {
      throw new Error('No access token available');
    }

    // Check if token is expired or will expire soon (within 5 minutes)
    const now = Date.now();
    const expiryBuffer = 5 * 60 * 1000; // 5 minutes
    
    if (user.tokenExpiry && (user.tokenExpiry - now) < expiryBuffer) {
      logger.info('Token expired or expiring soon, refreshing...', {
        userId: user.id,
        expiryDate: new Date(user.tokenExpiry)
      });

      if (!user.refreshToken) {
        throw new Error('No refresh token available - user needs to re-authenticate');
      }

      const newTokens = await this.refreshAccessToken(user.refreshToken);
      
      // Update user object with new tokens
      user.accessToken = newTokens.accessToken;
      user.tokenExpiry = newTokens.expiryDate;
      if (newTokens.refreshToken) {
        user.refreshToken = newTokens.refreshToken;
      }

      return newTokens;
    }

    return {
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
      expiryDate: user.tokenExpiry
    };
  }

  createGmailClient(accessToken) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL
    );

    oauth2Client.setCredentials({
      access_token: accessToken
    });

    return google.gmail({
      version: 'v1',
      auth: oauth2Client
    });
  }
}

module.exports = new TokenManager();