const express = require('express');
const router = express.Router();
// === Patch: Fix googleId / id lookup === //
const findUserBySessionId = async (req) => {
  const googleId = req.user.googleId;
  if (!googleId) {
    throw new Error('googleId not found in session');
  }
  const user = await User.findOne({ googleId });
  if (!user) {
    const error = new Error('User not found');
    error.status = 401;
    error.action = 'REAUTH_REQUIRED';
    throw error;
  }
  return user;
};

const { detectSignupEmails, detectNewSignupEmails } = require('../helpers/detectSignupEmails');
const testGmailConnection = require('../helpers/test');
const tokenManager = require('../utils/tokenManager');
const logger = require('../utils/logger');
const { clearUserCache, getUserServices, setUserServices } = require('../utils/cache');
const { asyncHandler } = require('../middleware/errorHandler');
const User = require('../models/User');
const DeletedEmail = require('../models/DeletedEmail');
const rateLimit = require('express-rate-limit');
const emailDeletionService = require('../helpers/emailDeletion');

// Rate limiting to protect Gmail API
const gmailRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // max 50 requests per IP per window
  message: {
    error: 'Too many Gmail requests',
    message: 'Please wait before making more requests',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please log in to continue',
      action: 'REAUTH_REQUIRED'
    });
  }
  if (!req.user?.accessToken) {
    return res.status(401).json({
      error: 'Access token missing',
      message: 'Please log in again to refresh your Gmail access',
      action: 'REAUTH_REQUIRED'
    });
  }
  next();
};

// Progress tracking stub (can be extended to real-time updates)
const createProgressTracker = (userId) => {
  return (progress) => {
    logger.info('Email scan progress', {
      userId,
      stage: progress.stage,
      processed: progress.processed,
      total: progress.total,
      percentage: progress.percentage,
      currentService: progress.currentService,
      timestamp: new Date().toISOString()
    });
    // TODO: Integrate WebSocket or SSE for front-end progress updates
  };
};

// === Existing & Enhanced Routes === //

// 1. Fetch all signup services with optional caching
router.get('/all-signups', gmailRateLimit, requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const forceRefresh = req.query.refresh === 'true';

  logger.info('Signup detection requested', {
    userId,
    email: req.user.email,
    forceRefresh,
    userAgent: req.get('User-Agent')
  });

  // Return cached services if available and not forcing refresh
  if (!forceRefresh) {
    const cachedServices = getUserServices(userId);
    if (cachedServices) {
      logger.info('Returning cached services', {
        userId,
        count: cachedServices.length
      });
      return res.json({
        services: cachedServices,
        count: cachedServices.length,
        lastScan: req.user.lastScan || new Date().toISOString(),
        cached: true,
        scanStats: {
          totalFound: cachedServices.length,
          suspicious: cachedServices.filter(s => s.suspicious).length,
          domains: [...new Set(cachedServices.map(s => s.domain))].length
        },
        status: 'success'
      });
    }
  }

  const progressCallback = createProgressTracker(userId);

  try {
    const results = await detectSignupEmails(req.user, forceRefresh, progressCallback);

    if (!Array.isArray(results)) {
      throw new Error('Invalid results format from detectSignupEmails');
    }

    // Save results to DB and cache
    if (results.length > 0) {
      try {
        await User.findOneAndUpdate(
          { googleId: req.user.id },
          {
            signupServices: results,
            lastScan: new Date(),
            lastScanStats: {
              totalFound: results.length,
              suspicious: results.filter(s => s.suspicious).length,
              domains: [...new Set(results.map(s => s.domain))].length,
              scanDuration: Date.now()
            }
          },
          { upsert: true, new: true }
        );
        setUserServices(userId, results, 1800); // Cache for 30 minutes

        logger.info('Services saved successfully', {
          userId,
          servicesCount: results.length,
          domains: results.map(s => s.domain).slice(0, 10)
        });

      } catch (dbError) {
        logger.error('Database save failed', { userId, error: dbError.message, stack: dbError.stack });
      }
    }

    res.json({
      services: results,
      count: results.length,
      lastScan: new Date().toISOString(),
      cached: false,
      scanStats: {
        totalFound: results.length,
        suspicious: results.filter(s => s.suspicious).length,
        domains: [...new Set(results.map(s => s.domain))].length,
        topDomains: results.reduce((acc, service) => {
          acc[service.domain] = (acc[service.domain] || 0) + 1;
          return acc;
        }, {})
      },
      status: 'success'
    });

  } catch (error) {
    logger.error('Signup detection failed', { userId, error: error.message, stack: error.stack });

    if (error.message.includes('REAUTH_REQUIRED')) {
      return res.status(401).json({
        error: 'Authentication expired',
        message: 'Your Gmail access has expired. Please log in again.',
        action: 'REAUTH_REQUIRED'
      });
    }

    throw error;
  }
}));

// 2. Saved services retrieval with pagination and filtering
router.get('/saved-services', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const filter = req.query.filter; // 'unsubscribed', 'ignored', 'active', or none
  const search = req.query.search;

const user = await findUserBySessionId(req);
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      action: 'REAUTH_REQUIRED'
    });
  }

  let services = user.signupServices || [];

  if (filter) {
    switch (filter) {
      case 'unsubscribed':
        services = services.filter(s => s.unsubscribed);
        break;
      case 'ignored':
        services = services.filter(s => s.ignored);
        break;
      case 'active':
        services = services.filter(s => !s.unsubscribed && !s.ignored);
        break;
      default:
        break;
    }
  }

  if (search) {
    const searchLower = search.toLowerCase();
    services = services.filter(s =>
      (s.platform?.toLowerCase().includes(searchLower)) ||
      (s.domain?.toLowerCase().includes(searchLower)) ||
      (s.sender?.toLowerCase().includes(searchLower))
    );
  }

  // Sort by last seen descending
  services.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));

  const startIndex = (page - 1) * limit;
  const paginatedServices = services.slice(startIndex, startIndex + limit);

  res.json({
    services: paginatedServices,
    pagination: {
      total: services.length,
      page,
      limit,
      pages: Math.ceil(services.length / limit),
      hasMore: startIndex + limit < services.length
    },
    filters: {
      applied: filter || null,
      search: search || null
    },
    stats: {
      total: user.signupServices?.length || 0,
      filtered: services.length,
      unsubscribed: user.signupServices?.filter(s => s.unsubscribed).length || 0,
      ignored: user.signupServices?.filter(s => s.ignored).length || 0,
      active: user.signupServices?.filter(s => !s.unsubscribed && !s.ignored).length || 0
    },
    lastScan: user.lastScan,
    status: 'success'
  });
}));

// 3. Update service status: unsubscribe, ignore, restore
router.post('/update-service', requireAuth, asyncHandler(async (req, res) => {
  const { domain, action } = req.body;
  const userId = req.user.id || req.user._id;

  if (!domain || !action) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['domain', 'action']
    });
  }

  const validActions = ['unsubscribe', 'ignore', 'restore'];
  if (!validActions.includes(action)) {
    return res.status(400).json({
      error: 'Invalid action',
      validActions
    });
  }

const user = await findUserBySessionId(req);
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      action: 'REAUTH_REQUIRED'
    });
  }

  const serviceIndex = user.signupServices.findIndex(s => s.domain === domain);
  if (serviceIndex === -1) {
    return res.status(404).json({ error: 'Service not found', domain });
  }

  const service = user.signupServices[serviceIndex];
  const previousState = {
    unsubscribed: service.unsubscribed,
    ignored: service.ignored
  };

  switch (action) {
    case 'unsubscribe':
      service.unsubscribed = true;
      service.unsubscribedAt = new Date();
      service.ignored = false;
      service.ignoredAt = null;
      break;
    case 'ignore':
      service.ignored = true;
      service.ignoredAt = new Date();
      service.unsubscribed = false;
      service.unsubscribedAt = null;
      break;
    case 'restore':
      service.unsubscribed = false;
      service.ignored = false;
      service.unsubscribedAt = null;
      service.ignoredAt = null;
      break;
  }

  await user.save();
  clearUserCache(userId);

  logger.info('Service status updated', {
    userId,
    domain,
    action,
    platform: service.platform,
    previousState,
    newState: {
      unsubscribed: service.unsubscribed,
      ignored: service.ignored
    }
  });

  res.json({
    message: `Service ${action}d successfully`,
    service: {
      domain: service.domain,
      platform: service.platform,
      unsubscribed: service.unsubscribed,
      ignored: service.ignored,
      updatedAt: new Date().toISOString()
    },
    status: 'success'
  });
}));

// 4. Detect new services incrementally since last scan
router.get('/new-services', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
const user = await findUserBySessionId(req);

  if (!user) {
    return res.status(404).json({ error: 'User not found', action: 'REAUTH_REQUIRED' });
  }

  const lastScan = user.lastScan;
  if (!lastScan) {
    return res.json({
      services: [],
      message: 'No previous scan found. Run full scan first.',
      action: 'FULL_SCAN_REQUIRED',
      status: 'success'
    });
  }

  const newServices = await detectNewSignupEmails(req.user, lastScan);

  if (newServices.length > 0) {
    await User.findOneAndUpdate(
      { googleId: req.user.id },
      {
        $push: { signupServices: { $each: newServices } },
        lastIncrementalScan: new Date()
      }
    );
    logger.info('New services detected', {
      userId,
      newServicesCount: newServices.length,
      lastScan,
      services: newServices.map(s => s.platform)
    });
  }

  res.json({
    services: newServices,
    count: newServices.length,
    lastScan,
    scanDate: new Date().toISOString(),
    status: 'success'
  });
}));

// 5. Test Gmail connection
router.get('/test-connection', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;

  logger.info('Gmail connection test initiated', {
    userId,
    email: req.user.email,
    hasAccessToken: !!req.user.accessToken,
    hasRefreshToken: !!req.user.refreshToken,
    tokenExpiry: req.user.tokenExpiry
  });

  try {
    const tokens = await tokenManager.validateAndRefreshToken(req.user);
    const result = await testGmailConnection(tokens);

    logger.info('Gmail connection test successful', {
      userId,
      email: result.email,
      tokenRefreshed: tokens.wasRefreshed
    });

    res.json({
      ...result,
      connectionStatus: 'healthy',
      tokenInfo: {
        refreshed: tokens.wasRefreshed,
        expiryDate: new Date(tokens.expiryDate),
        timeUntilExpiry: Math.round((tokens.expiryDate - Date.now()) / 1000 / 60) + ' minutes'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Gmail connection test failed', {
      userId,
      error: error.message,
      stack: error.stack
    });
    if (error.message.includes('REAUTH_REQUIRED')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please log in again to refresh your Gmail access',
        action: 'REAUTH_REQUIRED',
        connectionStatus: 'failed'
      });
    }
    throw error;
  }
}));

// 6. Get authenticated user info
router.get('/whoami', requireAuth, (req, res) => {
  const user = req.user;
  res.json({
    id: user.id || user._id,
    email: user.email,
    displayName: user.displayName,
    tokens: {
      accessToken: !!user.accessToken,
      refreshToken: !!user.refreshToken,
      expiryDate: user.tokenExpiry ? new Date(user.tokenExpiry) : null,
      isExpired: user.tokenExpiry ? Date.now() > user.tokenExpiry : null
    },
    scanInfo: {
      lastScan: user.lastScan,
      lastIncrementalScan: user.lastIncrementalScan,
      serviceCount: user.signupServices?.length || 0
    },
    session: {
      authenticated: true,
      loginTime: req.session?.passport?.user ? new Date() : null
    },
    timestamp: new Date().toISOString()
  });
});

// 7. Clear user cache (utility)
router.post('/clear-cache', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const clearedCount = clearUserCache(userId);
  logger.info('User cache cleared', { userId, clearedCount });
  res.json({
    message: 'Cache cleared successfully',
    clearedEntries: clearedCount,
    userId,
    timestamp: new Date().toISOString()
  });
}));

// --- New Email Deletion Endpoints ---

// POST /delete-platform-emails: Delete emails from a specific platform/domain
router.post('/delete-platform-emails', requireAuth, asyncHandler(async (req, res) => {
  const { domain, maxEmails = 50, spamOnly = true } = req.body;

  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }

  logger.info('Starting email deletion', {
    userId: req.user.id,
    domain,
    maxEmails,
    spamOnly
  });

  const results = await emailDeletionService.deleteEmailsFromPlatform(
    req.user,
    domain,
    { maxEmails, includeSpamOnly: spamOnly }
  );

  // Update user document with deletion info
  await User.findOneAndUpdate(
    { googleId: req.user.id, 'signupServices.domain': domain },
    {
      $set: {
        'signupServices.$.emailsDeleted': true,
        'signupServices.$.deletedCount': results.deleted,
        'signupServices.$.lastDeleted': new Date()
      }
    }
  );

  res.json({
    success: true,
    domain,
    deleted: results.deleted,
    errors: results.errors.length,
    message: `Successfully deleted ${results.deleted} emails from ${domain}`
  });
}));

// POST /bulk-delete-emails: Bulk delete emails from multiple platforms (max 10 domains)
router.post('/bulk-delete-emails', requireAuth, asyncHandler(async (req, res) => {
  const { domains, maxEmailsPerDomain = 25 } = req.body;

  if (!domains || !Array.isArray(domains) || domains.length === 0) {
    return res.status(400).json({ error: 'Domains array is required' });
  }

  if (domains.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 domains allowed per bulk operation' });
  }

  const results = [];
  let totalDeleted = 0;

  for (const domain of domains) {
    try {
      const result = await emailDeletionService.deleteEmailsFromPlatform(
        req.user,
        domain,
        { maxEmails: maxEmailsPerDomain, includeSpamOnly: true }
      );

      results.push({
        domain,
        deleted: result.deleted,
        errors: result.errors.length
      });

      totalDeleted += result.deleted;
      // Small delay between domains to avoid API throttling
      await new Promise(resolve => setTimeout(resolve, 200));

      // Update user doc per domain deletion
      await User.findOneAndUpdate(
        { googleId: req.user.id, 'signupServices.domain': domain },
        {
          $set: {
            'signupServices.$.emailsDeleted': true,
            'signupServices.$.deletedCount': result.deleted,
            'signupServices.$.lastDeleted': new Date()
          }
        }
      );

    } catch (error) {
      results.push({
        domain,
        deleted: 0,
        errors: 1,
        error: error.message
      });
    }
  }

  res.json({
    success: true,
    results,
    totalDeleted,
    message: `Bulk deletion completed. ${totalDeleted} emails deleted from ${domains.length} platforms.`
  });
}));

// GET /deletion-history: Get historical deletion records, paginated
router.get('/deletion-history', requireAuth, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const history = await DeletedEmail.find({ user: req.user._id })
    .sort({ deletedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .select('domain deletedCount errorCount deletedAt');

  const totalCount = await DeletedEmail.countDocuments({ user: req.user._id });

  res.json({
    history,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / limit),
      totalCount
    }
  });
}));

module.exports = router;
