// middleware/auth.js
const logger = require('../utils/logger');
const { clearUserCache } = require('../utils/cache');

// ✅ Enhanced authentication middleware
function ensureAuthenticated(req, res, next) {
  try {
    // Check if user is authenticated via Passport
    if (req.isAuthenticated && req.isAuthenticated()) {
      // ✅ Additional validation for user object
      if (!req.user || !req.user.id) {
        logger.warn('Authenticated but missing user object', {
          sessionId: req.sessionID,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        return res.status(401).json({ 
          error: 'Authentication error',
          message: 'User session is invalid. Please log in again.',
          action: 'LOGIN_REQUIRED'
        });
      }

      // ✅ Check account status
      if (req.user.accountStatus !== 'active') {
        logger.warn('Inactive user attempted access', {
          userId: req.user.id,
          accountStatus: req.user.accountStatus
        });
        
        return res.status(403).json({
          error: 'Account suspended',
          message: 'Your account is not active. Please contact support.',
          accountStatus: req.user.accountStatus
        });
      }

      // ✅ Check token expiry for Gmail operations
      if (req.user.tokenExpiry && Date.now() > req.user.tokenExpiry) {
        logger.info('User token expired, flagging for refresh', {
          userId: req.user.id,
          tokenExpiry: req.user.tokenExpiry
        });
        
        req.tokenExpired = true; // Flag for token refresh
      }

      // ✅ Log successful authentication
      logger.debug('User authenticated successfully', {
        userId: req.user.id,
        email: req.user.email,
        url: req.originalUrl,
        method: req.method
      });

      return next();
    }

    // ✅ Enhanced unauthenticated response
    logger.info('Unauthenticated access attempt', {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer')
    });

    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please log in to access this resource.',
      action: 'LOGIN_REQUIRED',
      loginUrl: '/auth/google'
    });

  } catch (error) {
    logger.error('Authentication middleware error', {
      error: error.message,
      stack: error.stack,
      url: req.originalUrl
    });

    return res.status(500).json({
      error: 'Authentication system error',
      message: 'Please try again later.'
    });
  }
}

// ✅ Optional authentication (for public endpoints that can be enhanced with auth)
function optionalAuthentication(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    logger.debug('Optional auth: User authenticated', {
      userId: req.user.id,
      url: req.originalUrl
    });
  } else {
    logger.debug('Optional auth: Anonymous access', {
      url: req.originalUrl,
      ip: req.ip
    });
  }
  
  next();
}

// ✅ Admin-only authentication
function ensureAdmin(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please log in to access admin resources.'
    });
  }

  if (!req.user.isAdmin) {
    logger.warn('Non-admin user attempted admin access', {
      userId: req.user.id,
      email: req.user.email,
      url: req.originalUrl
    });
    
    return res.status(403).json({
      error: 'Admin access required',
      message: 'You do not have permission to access this resource.'
    });
  }

  next();
}

module.exports = { 
  ensureAuthenticated,
  optionalAuthentication,
  ensureAdmin
};
