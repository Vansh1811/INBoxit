const express = require('express');
const router = express.Router();
const { detectSignupEmails, detectNewSignupEmails } = require('../helpers/detectSignupEmails');
const testGmailConnection = require('../helpers/test');
const tokenManager = require('../utils/tokenManager');
const logger = require('../utils/logger');
const { clearUserCache } = require('../utils/cache');
const User = require('../models/User');

// Simple async handler for now
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.get('/all-signups', async (req, res) => {
  try {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Not logged in' });
  }

  const forceRefresh = req.query.refresh === 'true';

  if (!req.user.accessToken) {
    return res.status(401).json({ 
      error: 'Access token missing - please log in again',
      action: 'REAUTH_REQUIRED'
    });
  }

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

    // Enhanced progress tracking
    const progressCallback = (progress) => {
      // In a real app, you might use WebSockets to send real-time progress
      logger.info('Scan progress', {
        userId: req.user.id,
        ...progress
      });
    };

    const results = await detectSignupEmails(req.user, forceRefresh, progressCallback);

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
      scanStats: {
        totalFound: results.length,
        suspicious: results.filter(s => s.suspicious).length,
        domains: [...new Set(results.map(s => s.domain))].length
      },
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
  } catch (err) {
    console.error('Gmail route error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch signup emails',
      details: err.message 
    });
  }
});

// Get saved services from database
router.get('/saved-services', async (req, res) => {
  try {
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
  } catch (err) {
    console.error('Saved services error:', err);
    res.status(500).json({ error: 'Failed to fetch saved services' });
  }
});

// Update service status (unsubscribe/ignore)
router.post('/update-service', async (req, res) => {
  try {
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
    
    // Clear user cache to force refresh
    // clearUserCache(req.user.id);
    
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
  } catch (err) {
    console.error('Update service error:', err);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

// Get new services since last scan
router.get('/new-services', async (req, res) => {
  try {
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
  } catch (err) {
    console.error('New services error:', err);
    res.status(500).json({ error: 'Failed to fetch new services' });
  }
});

router.get('/test-connection', async (req, res) => {
  try {
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
  } catch (err) {
    console.error('Test connection error:', err);
    res.status(500).json({ error: 'Failed to test connection' });
  }
});

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
