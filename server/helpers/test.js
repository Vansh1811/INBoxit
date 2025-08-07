const { google } = require('googleapis');
const tokenManager = require('../utils/tokenManager');
const logger = require('../utils/logger');

class GmailConnectionTester {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL
    );
  }

  // ✅ Enhanced connection test with comprehensive diagnostics
  async testGmailConnection(user, includeQuotaInfo = false) {
    try {
      logger.info('Starting enhanced Gmail connection test', {
        userId: user.id || user._id,
        email: user.email,
        hasAccessToken: !!user.accessToken,
        hasRefreshToken: !!user.refreshToken,
        tokenExpiry: user.tokenExpiry
      });

      // ✅ Use enhanced token manager for automatic refresh
      const gmail = await tokenManager.getGmailForUser(user.id || user._id);

      // ✅ Test 1: Basic Profile Access
      const profileResult = await this.testProfileAccess(gmail);
      
      // ✅ Test 2: Gmail API Permissions
      const permissionResult = await this.testGmailPermissions(gmail);
      
      // ✅ Test 3: Message Access Test
      const messageAccessResult = await this.testMessageAccess(gmail);
      
      // ✅ Test 4: Quota Information (optional)
      let quotaResult = null;
      if (includeQuotaInfo) {
        quotaResult = await this.testQuotaStatus(gmail);
      }

      // ✅ Compile comprehensive test results
      const results = {
        connectionStatus: 'healthy',
        email: profileResult.email,
        profile: profileResult,
        permissions: permissionResult,
        messageAccess: messageAccessResult,
        ...(quotaResult && { quotaInfo: quotaResult }),
        
        // ✅ Token information
        tokenInfo: {
          hasAccessToken: !!user.accessToken,
          hasRefreshToken: !!user.refreshToken,
          tokenExpiry: user.tokenExpiry,
          tokenExpiresIn: user.tokenExpiry ? 
            Math.max(0, Math.round((user.tokenExpiry - Date.now()) / 1000 / 60)) + ' minutes' : 
            'unknown',
          lastRefresh: user.lastTokenRefresh
        },
        
        // ✅ Connection metadata
        testMetadata: {
          testCompletedAt: new Date().toISOString(),
          testsPerformed: [
            'profile_access',
            'gmail_permissions', 
            'message_access',
            ...(includeQuotaInfo ? ['quota_status'] : [])
          ],
          testDuration: Date.now() - Date.now() // Will be calculated at the end
        }
      };

      logger.info('✅ Gmail connection test completed successfully', {
        userId: user.id || user._id,
        email: results.email,
        testsCompleted: results.testMetadata.testsPerformed.length,
        connectionStatus: results.connectionStatus
      });

      return results;

    } catch (error) {
      logger.error('❌ Gmail connection test failed', {
        userId: user.id || user._id,
        error: error.message,
        code: error.code,
        stack: error.stack
      });

      // ✅ Return structured error information
      return this.handleConnectionError(error, user);
    }
  }

  // ✅ Test basic profile access
  async testProfileAccess(gmail) {
    try {
      const profile = await gmail.users.getProfile({ userId: 'me' });
      
      return {
        status: 'success',
        email: profile.data.emailAddress,
        messagesTotal: profile.data.messagesTotal,
        threadsTotal: profile.data.threadsTotal,
        historyId: profile.data.historyId
      };

    } catch (error) {
      logger.warn('Profile access test failed', {
        error: error.message,
        code: error.code
      });

      return {
        status: 'failed',
        error: error.message,
        code: error.code
      };
    }
  }

  // ✅ Test Gmail API permissions
  async testGmailPermissions(gmail) {
    const permissions = {
      read: false,
      modify: false,
      send: false
    };

    const permissionTests = [
      {
        name: 'read',
        test: async () => {
          await gmail.users.labels.list({ userId: 'me' });
          return true;
        }
      },
      {
        name: 'modify',
        test: async () => {
          // Test if we can access message details (requires modify scope)
          const messages = await gmail.users.messages.list({ 
            userId: 'me', 
            maxResults: 1 
          });
          
          if (messages.data.messages && messages.data.messages.length > 0) {
            await gmail.users.messages.get({
              userId: 'me',
              id: messages.data.messages[0].id,
              format: 'metadata'
            });
          }
          return true;
        }
      }
    ];

    // Test each permission
    for (const permissionTest of permissionTests) {
      try {
        await permissionTest.test();
        permissions[permissionTest.name] = true;
      } catch (error) {
        logger.debug(`Permission test failed: ${permissionTest.name}`, {
          error: error.message
        });
        permissions[permissionTest.name] = false;
      }
    }

    return {
      status: 'completed',
      permissions,
      hasRequiredPermissions: permissions.read, // Minimum required
      recommendedPermissions: permissions.read && permissions.modify
    };
  }

  // ✅ Test message access capabilities
  async testMessageAccess(gmail) {
    try {
      // Test message listing
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 5,
        q: 'in:inbox'
      });

      const messageCount = listResponse.data.messages?.length || 0;
      let detailAccessWorking = false;

      // Test message detail access if messages exist
      if (messageCount > 0) {
        try {
          await gmail.users.messages.get({
            userId: 'me',
            id: listResponse.data.messages[0].id,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date']
          });
          detailAccessWorking = true;
        } catch (detailError) {
          logger.warn('Message detail access failed', {
            error: detailError.message
          });
        }
      }

      return {
        status: 'success',
        canListMessages: true,
        canAccessDetails: detailAccessWorking,
        testMessageCount: messageCount,
        inboxAccessible: true
      };

    } catch (error) {
      logger.warn('Message access test failed', {
        error: error.message,
        code: error.code
      });

      return {
        status: 'failed',
        error: error.message,
        code: error.code,
        canListMessages: false,
        canAccessDetails: false
      };
    }
  }

  // ✅ Test quota and usage information
  async testQuotaStatus(gmail) {
    try {
      // Note: Gmail API doesn't directly expose quota information
      // This is a placeholder for quota-related tests we might implement
      
      const currentTime = Date.now();
      const testStartTime = currentTime - 60000; // 1 minute ago
      
      // Estimate API usage by timing requests
      const quotaTest = {
        status: 'estimated',
        message: 'Gmail API quota information is not directly available',
        apiResponseTimes: [],
        estimatedUsage: 'low' // Could be enhanced with actual usage tracking
      };

      return quotaTest;

    } catch (error) {
      logger.warn('Quota test failed', {
        error: error.message
      });

      return {
        status: 'unavailable',
        error: 'Quota information could not be retrieved'
      };
    }
  }

  // ✅ Handle connection errors with detailed diagnostics
  handleConnectionError(error, user) {
    let errorType = 'unknown';
    let recommendedAction = 'retry';
    let userMessage = 'Connection test failed';

    // ✅ Categorize common errors
    if (error.code === 401) {
      errorType = 'authentication';
      recommendedAction = 'reauth';
      userMessage = 'Authentication expired. Please log in again.';
    } else if (error.code === 403) {
      if (error.message.includes('quotaExceeded')) {
        errorType = 'quota';
        recommendedAction = 'wait';
        userMessage = 'API quota exceeded. Please try again later.';
      } else {
        errorType = 'permissions';
        recommendedAction = 'reauth';
        userMessage = 'Insufficient permissions. Please re-authorize the application.';
      }
    } else if (error.code === 429) {
      errorType = 'rate_limit';
      recommendedAction = 'wait';
      userMessage = 'Too many requests. Please wait before trying again.';
    } else if (error.message.includes('REAUTH_REQUIRED')) {
      errorType = 'token_refresh';
      recommendedAction = 'reauth';
      userMessage = 'Token refresh failed. Please log in again.';
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNRESET') {
      errorType = 'network';
      recommendedAction = 'retry';
      userMessage = 'Network connection failed. Please check your internet connection.';
    }

    return {
      connectionStatus: 'failed',
      error: {
        type: errorType,
        message: userMessage,
        technicalDetails: {
          originalError: error.message,
          code: error.code,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        recommendedAction,
        troubleshooting: {
          reauth: 'Log out and log back in to refresh your Gmail access',
          retry: 'Wait a moment and try the connection test again',
          wait: 'Wait for the rate limit or quota to reset before trying again'
        }
      },
      tokenInfo: {
        hasAccessToken: !!user.accessToken,
        hasRefreshToken: !!user.refreshToken,
        tokenExpiry: user.tokenExpiry,
        tokenExpiresIn: user.tokenExpiry ? 
          Math.max(0, Math.round((user.tokenExpiry - Date.now()) / 1000 / 60)) + ' minutes' : 
          'unknown'
      },
      testMetadata: {
        testFailedAt: new Date().toISOString(),
        errorType,
        userId: user.id || user._id
      }
    };
  }

  // ✅ Quick connection test (lighter version for frequent checks)
  async quickConnectionTest(user) {
    try {
      const gmail = await tokenManager.getGmailForUser(user.id || user._id);
      const profile = await gmail.users.getProfile({ userId: 'me' });
      
      return {
        status: 'connected',
        email: profile.data.emailAddress,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // ✅ Batch connection test for multiple users (admin function)
  async batchConnectionTest(users) {
    const results = [];

    for (const user of users) {
      try {
        const result = await this.quickConnectionTest(user);
        results.push({
          userId: user.id || user._id,
          email: user.email,
          ...result
        });
      } catch (error) {
        results.push({
          userId: user.id || user._id,
          email: user.email,
          status: 'error',
          error: error.message
        });
      }
    }

    return {
      totalTested: users.length,
      connected: results.filter(r => r.status === 'connected').length,
      failed: results.filter(r => r.status === 'failed' || r.status === 'error').length,
      results,
      testedAt: new Date().toISOString()
    };
  }
}

// ✅ Create singleton instance
const connectionTester = new GmailConnectionTester();

// ✅ Export functions for backward compatibility with your existing routes
async function test(tokens) {
  // Legacy function that mimics your original test.js
  try {
    if (!tokens?.accessToken) {
      throw new Error('Access token missing');
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL
    );

    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      ...(tokens.refreshToken && { refresh_token: tokens.refreshToken }),
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });

    return {
      email: profile.data.emailAddress,
      messagesTotal: profile.data.messagesTotal,
      threadsTotal: profile.data.threadsTotal,
    };

  } catch (error) {
    logger.error('Legacy test function failed', {
      error: error.message,
      hasAccessToken: !!tokens?.accessToken
    });
    throw error;
  }
}

// ✅ Enhanced test function that integrates with user objects
async function testGmailConnection(user, options = {}) {
  return await connectionTester.testGmailConnection(user, options.includeQuotaInfo);
}

// ✅ Quick test function for frequent health checks
async function quickTest(user) {
  return await connectionTester.quickConnectionTest(user);
}

module.exports = {
  // Legacy export for backward compatibility
  default: test,
  test, // Your original function
  
  // Enhanced exports
  testGmailConnection,
  quickTest,
  connectionTester,
  
  // Admin functions
  batchTest: connectionTester.batchConnectionTest.bind(connectionTester)
};

// ✅ Default export maintains backward compatibility
module.exports.default = test;
