const express = require('express');
const passport = require('passport');
const router = express.Router();
const logger = require('../utils/logger');
const { authLimiter } = require('../middleware/rateLimiter');
const { asyncHandler } = require('../middleware/errorHandler');
const { clearUserCache } = require('../utils/cache');

// ✅ Apply auth rate limiting to all routes
router.use(authLimiter);

// ✅ Enhanced Google OAuth initiation
router.get('/google', (req, res, next) => {
  const returnTo = req.query.returnTo || req.headers.referer;
  
  // Store return URL in session for post-auth redirect
  if (returnTo && returnTo.startsWith(process.env.FRONTEND_URL)) {
    req.session.returnTo = returnTo;
  }

  logger.info('Google OAuth initiated', {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    returnTo: req.session.returnTo
  });

  passport.authenticate('google', {
    scope: [
      'profile', 
      'email', 
      'https://www.googleapis.com/auth/gmail.readonly'
    ],
    accessType: 'offline',
    prompt: 'consent',
    includeGrantedScopes: true
  })(req, res, next);
});

// ✅ Enhanced OAuth callback with comprehensive error handling
router.get('/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: '/auth/error',
    failureMessage: true 
  }),
  asyncHandler(async (req, res) => {
    try {
      if (!req.user) {
        logger.error('OAuth callback without user object');
        return res.redirect(`${process.env.FRONTEND_URL}/auth/error?reason=no_user`);
      }

      logger.info('✅ Google login successful', {
        userId: req.user.id,
        email: req.user.email,
        displayName: req.user.displayName,
        hasAccessToken: !!req.user.accessToken,
        hasRefreshToken: !!req.user.refreshToken,
        tokenExpiry: req.user.tokenExpiry,
        ip: req.ip
      });

      // ✅ Validate required tokens
      if (!req.user.accessToken) {
        logger.error('OAuth success but missing access token', { 
          userId: req.user.id 
        });
        return res.redirect(`${process.env.FRONTEND_URL}/auth/error?reason=missing_access_token`);
      }

      if (!req.user.refreshToken) {
        logger.warn('OAuth success but missing refresh token', { 
          userId: req.user.id 
        });
        // Don't fail - we can still work with access token temporarily
      }

      // ✅ Clear any cached data for fresh start
      clearUserCache(req.user.id);

      // ✅ Determine redirect URL
      const returnTo = req.session.returnTo || process.env.FRONTEND_URL || 'http://localhost:3000';
      delete req.session.returnTo; // Clean up session

      // ✅ Add success parameters to redirect
      const redirectUrl = new URL(returnTo);
      redirectUrl.searchParams.set('auth', 'success');
      redirectUrl.searchParams.set('new_user', req.user.createdAt && 
        (Date.now() - new Date(req.user.createdAt).getTime()) < 60000 ? 'true' : 'false');

      logger.info('Redirecting authenticated user', {
        userId: req.user.id,
        redirectTo: redirectUrl.origin
      });

      res.redirect(redirectUrl.toString());

    } catch (error) {
      logger.error('OAuth callback error', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });

      res.redirect(`${process.env.FRONTEND_URL}/auth/error?reason=callback_error`);
    }
  })
);

// ✅ Enhanced user info endpoint
router.get('/me', asyncHandler(async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ 
      error: 'Not authenticated',
      message: 'Please log in to continue',
      action: 'LOGIN_REQUIRED'
    });
  }

  try {
    const user = req.user;
    
    logger.debug('User info requested', { 
      userId: user.id,
      email: user.email 
    });

    // ✅ Check token expiry status
    const now = Date.now();
    const tokenExpired = user.tokenExpiry && user.tokenExpiry < now;
    const tokenExpiresSoon = user.tokenExpiry && (user.tokenExpiry - now) < 10 * 60 * 1000; // 10 minutes

    const responseData = {
      id: user.id,
      googleId: user.googleId,
      name: user.displayName,
      email: user.email,
      profilePicture: user.profilePicture,
      
      // ✅ Token status information
      tokens: {
        hasAccessToken: !!user.accessToken,
        hasRefreshToken: !!user.refreshToken,
        tokenExpiry: user.tokenExpiry,
        tokenExpired: tokenExpired,
        tokenExpiresSoon: tokenExpiresSoon,
        lastTokenRefresh: user.lastTokenRefresh
      },

      // ✅ Account information
      account: {
        status: user.accountStatus,
        isPremium: user.isPremium,
        createdAt: user.createdAt,
        lastActive: user.lastActive,
        isVerified: user.isVerified || true // OAuth users are verified
      },

      // ✅ Service information
      services: {
        lastScan: user.lastScan,
        serviceCount: user.signupServices?.length || 0,
        unsubscribedCount: user.signupServices?.filter(s => s.unsubscribed).length || 0
      },

      // ✅ User preferences
      preferences: user.preferences || {
        theme: 'auto',
        emailNotifications: true,
        autoScan: false
      },

      // ✅ Session info
      session: {
        authenticated: true,
        loginTime: req.session?.loginTime || new Date().toISOString()
      }
    };

    res.json(responseData);

  } catch (error) {
    logger.error('Error fetching user info', {
      userId: req.user?.id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch user information'
    });
  }
}));

// ✅ Enhanced logout with cleanup
router.post('/logout', asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  
  if (userId) {
    logger.info('User logout initiated', { 
      userId,
      email: req.user?.email 
    });

    // ✅ Clear user cache
    clearUserCache(userId);
  }

  req.logout((err) => {
    if (err) {
      logger.error('Logout error', { 
        userId,
        error: err.message 
      });
      return res.status(500).json({
        error: 'Logout failed',
        message: 'Failed to log out user'
      });
    }

    // ✅ Destroy session
    req.session.destroy((sessionErr) => {
      if (sessionErr) {
        logger.warn('Session destruction failed', { 
          userId,
          error: sessionErr.message 
        });
      }

      res.clearCookie('connect.sid');
      
      logger.info('User logged out successfully', { userId });
      
      res.json({
        message: 'Logged out successfully',
        timestamp: new Date().toISOString()
      });
    });
  });
}));

// ✅ Auth status check endpoint
router.get('/status', (req, res) => {
  const isAuthenticated = req.isAuthenticated();
  
  res.json({
    authenticated: isAuthenticated,
    user: isAuthenticated ? {
      id: req.user.id,
      name: req.user.displayName,
      email: req.user.email
    } : null,
    timestamp: new Date().toISOString()
  });
});

// ✅ Error handling route for OAuth failures
router.get('/error', (req, res) => {
  const reason = req.query.reason || 'unknown';
  const message = req.session?.messages?.length > 0 ? req.session.messages[0] : 'Authentication failed';
  
  logger.warn('Auth error page accessed', { 
    reason,
    message,
    ip: req.ip 
  });

  // Clear error messages
  if (req.session?.messages) {
    delete req.session.messages;
  }

  res.json({
    error: 'Authentication failed',
    reason: reason,
    message: message,
    timestamp: new Date().toISOString(),
    actions: {
      retry: '/auth/google',
      support: `${process.env.FRONTEND_URL}/support`
    }
  });
});

module.exports = router;
