const express = require('express');
const router = express.Router();
const User = require('../models/User');
const logger = require('../utils/logger');
const { getUserServices, setUserServices, clearUserCache } = require('../utils/cache');
const { asyncHandler } = require('../middleware/errorHandler');
const { apiLimiter, sensitiveOperationsLimiter } = require('../middleware/rateLimiter');

// ✅ Authentication middleware for all routes
const requireAuth = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please log in to manage your services',
      action: 'LOGIN_REQUIRED'
    });
  }
  next();
};

// Apply rate limiting to all routes
router.use(apiLimiter);

// ✅ Get all user services with filtering and pagination
router.get('/my-services', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    page = 1,
    limit = 50,
    filter, // 'all', 'active', 'unsubscribed', 'ignored', 'suspicious'
    category, // 'social', 'ecommerce', 'newsletter', etc.
    search,
    sortBy = 'lastSeen', // 'lastSeen', 'platform', 'confidence', 'category'
    sortOrder = 'desc'
  } = req.query;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        action: 'LOGIN_REQUIRED'
      });
    }

    let services = user.signupServices || [];
    const totalServices = services.length;

    // ✅ Apply filters
    if (filter && filter !== 'all') {
      switch (filter) {
        case 'active':
          services = services.filter(s => !s.unsubscribed && !s.ignored);
          break;
        case 'unsubscribed':
          services = services.filter(s => s.unsubscribed);
          break;
        case 'ignored':
          services = services.filter(s => s.ignored);
          break;
        case 'suspicious':
          services = services.filter(s => s.suspicious || s.confidence < 30);
          break;
      }
    }

    // ✅ Apply category filter
    if (category && category !== 'all') {
      services = services.filter(s => s.category === category);
    }

    // ✅ Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      services = services.filter(s =>
        s.platform.toLowerCase().includes(searchLower) ||
        s.domain.toLowerCase().includes(searchLower) ||
        s.sender.toLowerCase().includes(searchLower) ||
        (s.subject && s.subject.toLowerCase().includes(searchLower))
      );
    }

    // ✅ Apply sorting
    services.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'platform':
          aVal = a.platform.toLowerCase();
          bVal = b.platform.toLowerCase();
          break;
        case 'confidence':
          aVal = a.confidence || 0;
          bVal = b.confidence || 0;
          break;
        case 'category':
          aVal = a.category || 'other';
          bVal = b.category || 'other';
          break;
        case 'lastSeen':
        default:
          aVal = new Date(a.lastSeen || a.date || 0);
          bVal = new Date(b.lastSeen || b.date || 0);
          break;
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // ✅ Apply pagination
    const startIndex = (page - 1) * limit;
    const paginatedServices = services.slice(startIndex, startIndex + parseInt(limit));

    // ✅ Generate statistics
    const stats = {
      total: totalServices,
      filtered: services.length,
      active: user.signupServices?.filter(s => !s.unsubscribed && !s.ignored).length || 0,
      unsubscribed: user.signupServices?.filter(s => s.unsubscribed).length || 0,
      ignored: user.signupServices?.filter(s => s.ignored).length || 0,
      suspicious: user.signupServices?.filter(s => s.suspicious).length || 0,
      categories: {}
    };

    // Calculate category distribution
    user.signupServices?.forEach(service => {
      const category = service.category || 'other';
      stats.categories[category] = (stats.categories[category] || 0) + 1;
    });

    res.json({
      services: paginatedServices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: services.length,
        pages: Math.ceil(services.length / limit),
        hasMore: startIndex + parseInt(limit) < services.length
      },
      filters: {
        applied: { filter, category, search, sortBy, sortOrder },
        available: {
          categories: Object.keys(stats.categories),
          filters: ['all', 'active', 'unsubscribed', 'ignored', 'suspicious']
        }
      },
      stats,
      lastScan: user.lastScan,
      status: 'success'
    });

    logger.info('Services retrieved', {
      userId,
      totalServices,
      filteredCount: services.length,
      page,
      filters: { filter, category, search }
    });

  } catch (error) {
    logger.error('Error retrieving user services', {
      userId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}));

// ✅ Get single service details
router.get('/service/:domain', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { domain } = req.params;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      action: 'LOGIN_REQUIRED'
    });
  }

  const service = user.signupServices.find(s => s.domain === domain);
  if (!service) {
    return res.status(404).json({
      error: 'Service not found',
      domain
    });
  }

  res.json({
    service,
    relatedServices: user.signupServices
      .filter(s => s.domain !== domain && s.category === service.category)
      .slice(0, 5), // Show 5 related services
    status: 'success'
  });
}));

// Add to your routes/services.js
router.get('/platform-details/:domain', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { domain } = req.params;

  try {
    // Get user's detected service
    const service = await DetectedService.findOne({
      user: userId,
      domain: domain.toLowerCase()
    });

    if (!service) {
      return res.status(404).json({
        error: 'Platform not found',
        message: 'This platform was not detected in your account'
      });
    }

    // Get platform registry info for enhanced details
    const platformInfo = platformRegistry.detectPlatform(
      service.domain,
      service.sender,
      service.subject || ''
    );

    // Get recent emails from this platform
    const recentEmails = await Email.find({
      user: userId,
      'platform.domain': domain
    }).sort({ date: -1 }).limit(5);

    // Calculate platform usage insights
    const insights = {
      emailFrequency: calculateEmailFrequency(recentEmails),
      lastActivity: service.lastSeen,
      totalEmails: recentEmails.length,
      accountAge: calculateAccountAge(recentEmails)
    };

    res.json({
      platform: {
        name: service.platform,
        domain: service.domain,
        category: service.category,
        confidence: service.confidence,
        status: {
          isUnsubscribed: service.unsubscribed || false,
          isIgnored: service.ignored || false,
          lastSeen: service.lastSeen
        }
      },
      platformInfo: {
        color: platformInfo.color,
        description: `${platformInfo.category} platform`,
        unsubscribeSupport: platformInfo.unsubscribeSupport
      },
      insights,
      recentEmails: recentEmails.map(email => ({
        subject: email.subject,
        date: email.date,
        snippet: email.snippet
      })),
      aiAssistantAvailable: true,
      status: 'success'
    });

  } catch (error) {
    logger.error('Failed to get platform details', {
      userId,
      domain,
      error: error.message
    });
    throw error;
  }
}));

// ✅ Update single service status
router.put('/service/:domain', requireAuth, sensitiveOperationsLimiter, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { domain } = req.params;
  const { action, reason } = req.body;

  // ✅ Validation
  const validActions = ['unsubscribe', 'ignore', 'restore', 'update_category'];
  if (!action || !validActions.includes(action)) {
    return res.status(400).json({
      error: 'Invalid action',
      validActions,
      received: action
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        action: 'LOGIN_REQUIRED'
      });
    }

    const serviceIndex = user.signupServices.findIndex(s => s.domain === domain);
    if (serviceIndex === -1) {
      return res.status(404).json({
        error: 'Service not found',
        domain
      });
    }

    const service = user.signupServices[serviceIndex];
    const previousState = {
      unsubscribed: service.unsubscribed,
      ignored: service.ignored,
      category: service.category
    };

    // ✅ Apply the requested action
    switch (action) {
      case 'unsubscribe':
        service.unsubscribed = true;
        service.unsubscribedAt = new Date();
        service.unsubscribeMethod = 'manual';
        service.unsubscribeReason = reason || 'user_request';
        service.ignored = false; // Clear ignore status
        service.ignoredAt = null;
        break;

      case 'ignore':
        service.ignored = true;
        service.ignoredAt = new Date();
        service.ignoreReason = reason || 'user_request';
        service.unsubscribed = false; // Clear unsubscribe status
        service.unsubscribedAt = null;
        break;

      case 'restore':
        service.unsubscribed = false;
        service.ignored = false;
        service.unsubscribedAt = null;
        service.ignoredAt = null;
        service.unsubscribeReason = null;
        service.ignoreReason = null;
        service.restoredAt = new Date();
        break;

      case 'update_category':
        if (req.body.category) {
          service.category = req.body.category;
          service.categoryUpdatedAt = new Date();
        }
        break;
    }

    service.lastUpdated = new Date();
    await user.save();

    // ✅ Clear user cache to reflect changes
    clearUserCache(userId);

    logger.info('Service updated', {
      userId,
      domain,
      action,
      reason,
      platform: service.platform,
      previousState,
      newState: {
        unsubscribed: service.unsubscribed,
        ignored: service.ignored,
        category: service.category
      }
    });

    res.json({
      message: `Service ${action}d successfully`,
      service: {
        domain: service.domain,
        platform: service.platform,
        unsubscribed: service.unsubscribed,
        ignored: service.ignored,
        category: service.category,
        lastUpdated: service.lastUpdated
      },
      previousState,
      status: 'success'
    });

  } catch (error) {
    logger.error('Error updating service', {
      userId,
      domain,
      action,
      error: error.message
    });
    throw error;
  }
}));

// ✅ Bulk operations on multiple services
router.post('/bulk-action', requireAuth, sensitiveOperationsLimiter, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { domains, action, reason, category } = req.body;

  // ✅ Validation
  if (!Array.isArray(domains) || domains.length === 0) {
    return res.status(400).json({
      error: 'Invalid domains array',
      message: 'domains must be a non-empty array'
    });
  }

  if (domains.length > 50) {
    return res.status(400).json({
      error: 'Too many services',
      message: 'Maximum 50 services per bulk operation',
      received: domains.length
    });
  }

  const validActions = ['unsubscribe', 'ignore', 'restore', 'update_category', 'delete'];
  if (!validActions.includes(action)) {
    return res.status(400).json({
      error: 'Invalid bulk action',
      validActions,
      received: action
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        action: 'LOGIN_REQUIRED'
      });
    }

    const results = {
      successful: [],
      failed: [],
      summary: {
        processed: 0,
        successful: 0,
        failed: 0
      }
    };

    // ✅ Process each domain
    for (const domain of domains) {
      try {
        const serviceIndex = user.signupServices.findIndex(s => s.domain === domain);
        
        if (serviceIndex === -1) {
          results.failed.push({
            domain,
            error: 'Service not found'
          });
          continue;
        }

        const service = user.signupServices[serviceIndex];

        // Apply the bulk action
        switch (action) {
          case 'unsubscribe':
            service.unsubscribed = true;
            service.unsubscribedAt = new Date();
            service.unsubscribeMethod = 'bulk';
            service.unsubscribeReason = reason || 'bulk_operation';
            service.ignored = false;
            break;

          case 'ignore':
            service.ignored = true;
            service.ignoredAt = new Date();
            service.ignoreReason = reason || 'bulk_operation';
            service.unsubscribed = false;
            break;

          case 'restore':
            service.unsubscribed = false;
            service.ignored = false;
            service.unsubscribedAt = null;
            service.ignoredAt = null;
            service.restoredAt = new Date();
            break;

          case 'update_category':
            if (category) {
              service.category = category;
              service.categoryUpdatedAt = new Date();
            }
            break;

          case 'delete':
            user.signupServices.splice(serviceIndex, 1);
            break;
        }

        if (action !== 'delete') {
          service.lastUpdated = new Date();
        }

        results.successful.push({
          domain,
          platform: service.platform,
          action: action
        });

      } catch (serviceError) {
        results.failed.push({
          domain,
          error: serviceError.message
        });
      }

      results.summary.processed++;
    }

    results.summary.successful = results.successful.length;
    results.summary.failed = results.failed.length;

    // ✅ Save changes
    await user.save();

    // ✅ Clear cache
    clearUserCache(userId);

    logger.info('Bulk service operation completed', {
      userId,
      action,
      domains: domains.length,
      successful: results.summary.successful,
      failed: results.summary.failed,
      reason
    });

    res.json({
      message: `Bulk ${action} operation completed`,
      results,
      status: 'success'
    });

  } catch (error) {
    logger.error('Bulk service operation failed', {
      userId,
      action,
      domainsCount: domains.length,
      error: error.message
    });
    throw error;
  }
}));

// ✅ Service statistics and analytics
router.get('/statistics', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        action: 'LOGIN_REQUIRED'
      });
    }

    const services = user.signupServices || [];
    
    // ✅ Generate comprehensive statistics
    const stats = {
      overview: {
        totalServices: services.length,
        activeServices: services.filter(s => !s.unsubscribed && !s.ignored).length,
        unsubscribedServices: services.filter(s => s.unsubscribed).length,
        ignoredServices: services.filter(s => s.ignored).length,
        suspiciousServices: services.filter(s => s.suspicious).length
      },

      categories: {},
      confidenceLevels: {
        high: services.filter(s => (s.confidence || 0) >= 70).length,
        medium: services.filter(s => (s.confidence || 0) >= 40 && (s.confidence || 0) < 70).length,
        low: services.filter(s => (s.confidence || 0) < 40).length
      },

      timeAnalysis: {
        lastScan: user.lastScan,
        recentlyDetected: services.filter(s => {
          const detected = new Date(s.detectedAt || s.lastSeen);
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return detected > sevenDaysAgo;
        }).length,
        
        unsubscribedThisMonth: services.filter(s => {
          if (!s.unsubscribedAt) return false;
          const unsubDate = new Date(s.unsubscribedAt);
          const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          return unsubDate > monthAgo;
        }).length
      },

      topDomains: services
        .reduce((acc, service) => {
          const domain = service.domain;
          acc[domain] = (acc[domain] || 0) + 1;
          return acc;
        }, {}),

      scanning: {
        totalScans: user.scanCount || 0,
        lastScanStats: user.lastScanStats || {},
        avgServicesPerScan: user.scanCount > 0 ? 
          Math.round(services.length / user.scanCount) : 0
      }
    };

    // Calculate category distribution
    services.forEach(service => {
      const category = service.category || 'other';
      stats.categories[category] = (stats.categories[category] || 0) + 1;
    });

    // Convert topDomains to sorted array
    stats.topDomains = Object.entries(stats.topDomains)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }));

    res.json({
      statistics: stats,
      generatedAt: new Date().toISOString(),
      status: 'success'
    });

  } catch (error) {
    logger.error('Error generating service statistics', {
      userId,
      error: error.message
    });
    throw error;
  }
}));

// ✅ Export services data (for backup/portability)
router.get('/export', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const format = req.query.format || 'json';

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        action: 'LOGIN_REQUIRED'
      });
    }

    const exportData = {
      user: {
        id: user._id,
        email: user.email,
        name: user.displayName
      },
      services: user.signupServices || [],
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = 'Platform,Domain,Category,Status,Confidence,Last Seen,Unsubscribed At\n';
      const csvData = exportData.services.map(service => [
        service.platform,
        service.domain,
        service.category || 'other',
        service.unsubscribed ? 'unsubscribed' : service.ignored ? 'ignored' : 'active',
        service.confidence || 'N/A',
        service.lastSeen || 'N/A',
        service.unsubscribedAt || 'N/A'
      ].join(',')).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="inboxit-services.csv"');
      res.send(csvHeaders + csvData);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="inboxit-services.json"');
      res.json(exportData);
    }

    logger.info('Services exported', {
      userId,
      format,
      serviceCount: exportData.services.length
    });

  } catch (error) {
    logger.error('Service export failed', {
      userId,
      format,
      error: error.message
    });
    throw error;
  }
}));

// ✅ Enhanced test connection (your original endpoint, but improved)
router.get('/test-connection', requireAuth, asyncHandler(async (req, res) => {
  try {
    if (!req.user?.accessToken) {
      return res.status(401).json({
        error: 'No access token',
        message: 'Please log in again to test your Gmail connection',
        action: 'REAUTH_REQUIRED'
      });
    }

    const services = [{
      name: 'Gmail',
      status: 'connected',
      lastConnected: req.user.tokenExpiry,
      hasRefreshToken: !!req.user.refreshToken,
      tokenExpiry: req.user.tokenExpiry
    }];

    // Add service count information
    const user = await User.findById(req.user.id);
    const serviceStats = {
      totalDetected: user?.signupServices?.length || 0,
      active: user?.signupServices?.filter(s => !s.unsubscribed && !s.ignored).length || 0,
      unsubscribed: user?.signupServices?.filter(s => s.unsubscribed).length || 0
    };

    res.json({
      services,
      serviceStats,
      count: services.length,
      status: 'success',
      message: `Found ${services.length} connected service(s)`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Service connection test failed', {
      userId: req.user?.id,
      error: error.message
    });

    res.status(500).json({
      error: 'Connection test failed',
      message: 'Unable to test service connections',
      timestamp: new Date().toISOString()
    });
  }
}));
// Add to your routes/services.js
const aiAssistant = require('../helpers/aiUnsubscribeAssistant');

// Get unsubscribe guidance for a platform
router.get('/unsubscribe-guide/:domain', requireAuth, asyncHandler(async (req, res) => {
  const { domain } = req.params;
  const { step } = req.query;

  try {
    const guidance = await aiAssistant.getUnsubscribeGuidance(
      domain, 
      step ? parseInt(step) : null
    );

    logger.info('Unsubscribe guidance provided', {
      userId: req.user.id,
      domain,
      step: guidance.currentStep,
      difficulty: guidance.difficulty
    });

    res.json({
      guidance,
      chatAvailable: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to provide unsubscribe guidance', {
      userId: req.user.id,
      domain,
      error: error.message
    });
    throw error;
  }
}));

// AI chat endpoint for user questions
router.post('/ai-chat/:domain', requireAuth, asyncHandler(async (req, res) => {
  const { domain } = req.params;
  const { question, currentStep } = req.body;

  // Input validation
  if (!question || question.trim().length === 0) {
    return res.status(400).json({
      error: 'Question is required',
      message: 'Please ask a question about the unsubscription process'
    });
  }

  if (question.length > 500) {
    return res.status(400).json({
      error: 'Question too long',
      message: 'Please keep questions under 500 characters'
    });
  }

  try {
    const response = await aiAssistant.handleUserQuestion(
      domain,
      question,
      currentStep
    );

    logger.info('AI chat response provided', {
      userId: req.user.id,
      domain,
      question: question.substring(0, 100),
      responseType: response.type
    });

    res.json({
      domain,
      userQuestion: question,
      aiResponse: response,
      timestamp: new Date().toISOString(),
      chatSession: true
    });

  } catch (error) {
    logger.error('AI chat failed', {
      userId: req.user.id,
      domain,
      question,
      error: error.message
    });

    res.status(500).json({
      error: 'AI assistant unavailable',
      message: 'Please try again in a moment',
      fallback: 'You can always visit the platform directly to unsubscribe'
    });
  }
}));

// Track step completion
router.post('/track-step/:domain', requireAuth, asyncHandler(async (req, res) => {
  const { domain } = req.params;
  const { step, completed, notes } = req.body;

  try {
    if (completed) {
      await aiAssistant.trackStepCompletion(req.user.id, domain, step);
    }

    // Update user's progress
    await DetectedService.findOneAndUpdate(
      { user: req.user.id, domain: domain.toLowerCase() },
      { 
        $set: {
          'unsubscribeProgress.currentStep': step,
          'unsubscribeProgress.lastUpdated': new Date(),
          'unsubscribeProgress.notes': notes
        }
      }
    );

    res.json({
      message: 'Progress tracked successfully',
      nextStep: step + 1,
      domain,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to track step progress', {
      userId: req.user.id,
      domain,
      step,
      error: error.message
    });
    throw error;
  }
}));

// Mark unsubscription as completed
router.post('/complete-unsubscribe/:domain', requireAuth, asyncHandler(async (req, res) => {
  const { domain } = req.params;
  const { feedback, difficulty_rating } = req.body;

  try {
    // Mark as unsubscribed in database
    await DetectedService.findOneAndUpdate(
      { user: req.user.id, domain: domain.toLowerCase() },
      { 
        $set: {
          unsubscribed: true,
          unsubscribedAt: new Date(),
          unsubscribeMethod: 'ai_assisted',
          'unsubscribeProgress.completed': true,
          'unsubscribeProgress.completedAt': new Date(),
          'unsubscribeProgress.feedback': feedback,
          'unsubscribeProgress.difficultyRating': difficulty_rating
        }
      }
    );

    // Clear user cache
    clearUserCache(req.user.id);

    logger.info('AI-assisted unsubscription completed', {
      userId: req.user.id,
      domain,
      feedback,
      difficultyRating: difficulty_rating
    });

    res.json({
      message: '🎉 Congratulations! You have successfully unsubscribed.',
      domain,
      estimatedEmailReduction: '80-90% fewer emails from this platform',
      nextRecommendations: [
        'Check similar platforms in the same category',
        'Set up email filters for remaining subscriptions'
      ],
      completedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to complete unsubscribe process', {
      userId: req.user.id,
      domain,
      error: error.message
    });
    throw error;
  }
}));


module.exports = router;
