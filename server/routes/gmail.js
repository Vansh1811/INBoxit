const express = require('express');
const router = express.Router();
const {
  detectSignupEmails,
  detectNewSignupEmails
} = require('../helpers/detectSignupEmails');
const testGmailConnection = require('../helpers/test');
const tokenManager = require('../utils/tokenManager');
const logger = require('../utils/logger');
const { clearUserCache } = require('../utils/cache');
const { gmailLimiter } = require('../middleware/rateLimiter');
const { validateUpdateService, validatePagination } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const User = require('../models/User');

// Apply rate limiting to all Gmail routes
router.use(gmailLimiter);

// GET /gmail/all-signups
router.get('/all-signups', asyncHandler(async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not logged in' });
    }

    const forceRefresh = req.query.refresh === 'true';

    if (!req.user || !req.user.accessToken) {
      return res.status(401).json({ 
        error: 'Access token missing - please log in again',
        action: 'REAUTH_REQUIRED'
      });
    }

    logger.info('Detecting signup services', { 
      userId: req.user.id || req.user._id,
      forceRefresh,
      email: req.user.email
    });

    const results = await detectSignupEmails(req.user, forceRefresh);

    if (Array.isArray(results) && results.length > 0) {
      await User.findOneAndUpdate(
        { googleId: req.user.id },
        { 
          signupServices: results,
          lastScan: new Date()
        },
        { upsert: true }
      );
      logger.info(`Saved ${results.length} services to user profile`, { userId: req.user.id });
    }

    res.json({
      services: results,
      count: results.length,
      lastScan: new Date().toISOString(),
      status: 'success'
    });

  } catch (err) {
    console.error('FULL ERROR STACK:', err);
    logger.error('Error fetching signup emails', {
      userId: req.user?.id,
      error: err.stack || err.message
    });
    res.status(500).json({ 
      error: 'Failed to fetch signup emails',
      details: err.message 
    });
  }
}));

// GET /gmail/saved-services
router.get('/saved-services', validatePagination, asyncHandler(async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Not logged in' });
  }

  try {
    const user = await User.findOne({ googleId: req.user.id });
    const services = user?.signupServices || [];
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const startIndex = (page - 1) * limit;
    const paginatedServices = services.slice(startIndex, startIndex + limit);
    
    res.json({
      services: paginatedServices,
      total: services.length,
      page,
      limit,
      hasMore: startIndex + limit < services.length,
      lastScan: user?.lastScan,
      status: 'success'
    });
  } catch (err) {
    logger.error('Error fetching saved services', {
      userId: req.user?.id,
      error: err.message
    });
    res.status(500).json({ error: 'Failed to fetch saved services' });
  }
}));

// POST /gmail/update-service
router.post('/update-service', validateUpdateService, asyncHandler(async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Not logged in' });
  }

  const { domain, action } = req.body;

  try {
    const user = await User.findOne({ googleId: req.user.id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const serviceIndex = user.signupServices.findIndex(s => s.domain === domain);
    if (serviceIndex === -1) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const service = user.signupServices[serviceIndex];

    switch (action) {
      case 'unsubscribe':
        service.unsubscribed = true;
        service.unsubscribedAt = new Date();
        break;
      case 'ignore':
        service.ignored = true;
        service.ignoredAt = new Date();
        break;
      case 'restore':
        service.unsubscribed = false;
        service.ignored = false;
        service.unsubscribedAt = null;
        service.ignoredAt = null;
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    await user.save();
    clearUserCache(req.user.id);

    logger.info(`Service ${action}d successfully`, {
      userId: req.user.id,
      domain,
      action
    });

    res.json({
      message: `Service ${action}d successfully`,
      status: 'success'
    });
  } catch (err) {
    logger.error('Error updating service', {
      userId: req.user?.id,
      domain,
      action,
      error: err.message
    });
    res.status(500).json({ error: 'Failed to update service' });
  }
}));

// GET /gmail/new-services
router.get('/new-services', asyncHandler(async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Not logged in' });
  }

  try {
    const user = await User.findOne({ googleId: req.user.id });
    const lastScan = user?.lastScan;

    if (!lastScan) {
      return res.json({
        services: [],
        message: 'No previous scan found. Run full scan first.',
        status: 'success'
      });
    }

    const newServices = await detectNewSignupEmails(req.user, lastScan);

    res.json({
      services: newServices,
      count: newServices.length,
      lastScan,
      status: 'success'
    });
  } catch (err) {
    logger.error('Error fetching new services', {
      userId: req.user?.id,
      error: err.message
    });
    res.status(500).json({ error: 'Failed to fetch new services' });
  }
}));

// GET /gmail/test-connection
router.get('/test-connection', asyncHandler(async (req, res) => {
  logger.debug('Gmail connection test requested', {
    userId: req.user?.id,
    hasAccessToken: !!req.user?.accessToken
  });

  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Not logged in' });
  }

  if (!req.user.accessToken) {
    return res.status(401).json({ 
      error: 'Access token missing - please log in again',
      action: 'REAUTH_REQUIRED'
    });
  }

  try {
    const tokens = await tokenManager.validateAndRefreshToken(req.user);
    const result = await testGmailConnection(tokens);

    logger.info('Gmail connection test successful', {
      userId: req.user.id,
      email: result.email
    });

    res.json(result);
  } catch (err) {
    logger.error('Gmail connection test failed', {
      userId: req.user?.id,
      error: err.message
    });
    res.status(400).json({ error: err.message });
  }
}));

router.get('/whoami', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not logged in' });

  res.json({
    id: req.user?.id,
    email: req.user?.email,
    accessTokenExists: !!req.user?.accessToken,
    refreshTokenExists: !!req.user?.refreshToken
  });
});

module.exports = router;
