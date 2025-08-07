const express = require('express');
const router = express.Router();

// ✅ Enhanced imports
const { detectPlatforms, DetectedService } = require('../models/DetectedService');
const { platformRegistry, detectPlatform, searchPlatforms } = require('../utils/platforms');
const { ensureAuthenticated } = require('../middleware/auth');
const { apiLimiter, bulkOperationsLimiter } = require('../middleware/rateLimiter');
const { validatePagination, validateSearch, handleValidationErrors } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { getUserServices, setUserServices, clearUserCache } = require('../utils/cache');

// Apply rate limiting to all platform routes
router.use(apiLimiter);

// ✅ Enhanced platform scanning with progress tracking
router.get('/scan', ensureAuthenticated, bulkOperationsLimiter, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { forceRefresh = false, maxEmails = 500 } = req.query;

  try {
    logger.info('🔍 Platform scanning initiated', {
      userId,
      email: req.user.email,
      forceRefresh: forceRefresh === 'true',
      maxEmails
    });

    // ✅ Progress tracking callback for real-time updates
    const progressCallback = (progress) => {
      logger.info('Platform scan progress', {
        userId,
        stage: progress.stage,
        processed: progress.processed,
        total: progress.total,
        percentage: progress.percentage
      });
    };

    // ✅ Use enhanced detection with progress tracking
    const platforms = await detectPlatforms(req.user, {
      forceRefresh: forceRefresh === 'true',
      maxMessages: parseInt(maxEmails) || 500,
      progressCallback
    });

    // ✅ Enhanced response with comprehensive stats
    const stats = {
      totalDetected: platforms.length,
      categories: {},
      highConfidence: platforms.filter(p => (p.confidence || 0) >= 70).length,
      mediumConfidence: platforms.filter(p => (p.confidence || 0) >= 40 && (p.confidence || 0) < 70).length,
      lowConfidence: platforms.filter(p => (p.confidence || 0) < 40).length
    };

    // Calculate category distribution
    platforms.forEach(platform => {
      const category = platform.category || 'other';
      stats.categories[category] = (stats.categories[category] || 0) + 1;
    });

    logger.info('✅ Platform scan completed successfully', {
      userId,
      totalDetected: platforms.length,
      categories: Object.keys(stats.categories).length,
      highConfidence: stats.highConfidence
    });

    res.json({
      message: 'Platform scan completed successfully',
      detected: platforms,
      count: platforms.length,
      stats,
      scanTimestamp: new Date().toISOString(),
      status: 'success'
    });

  } catch (error) {
    logger.error('❌ Platform scan failed', {
      userId,
      error: error.message,
      stack: error.stack
    });

    if (error.message.includes('REAUTH_REQUIRED')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please log in again to refresh your Gmail access',
        action: 'REAUTH_REQUIRED'
      });
    }

    res.status(500).json({ 
      error: 'Platform scan failed',
      message: 'Unable to scan emails for platforms',
      timestamp: new Date().toISOString()
    });
  }
})); // ✅ FIXED: Added missing closing parenthesis

// ✅ Enhanced platform listing with filtering and pagination
router.get('/list', ensureAuthenticated, validatePagination, validateSearch, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    page = 1,
    limit = 50,
    category,
    search,
    sortBy = 'confidence',
    sortOrder = 'desc',
    includeStats = false
  } = req.query;

  try {
    // ✅ Build query with filters
    let query = { user: userId };
    
    if (category && category !== 'all') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { platform: { $regex: search, $options: 'i' } },
        { domain: { $regex: search, $options: 'i' } },
        { sender: { $regex: search, $options: 'i' } }
      ];
    }

    // ✅ Get total count for pagination
    const totalPlatforms = await DetectedService.countDocuments(query);

    // ✅ Build sort options
    const sortOptions = {};
    const validSortFields = ['platform', 'confidence', 'lastSeen', 'category', 'date'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'confidence';
    sortOptions[sortField] = sortOrder === 'asc' ? 1 : -1;

    // ✅ Get paginated results
    const platforms = await DetectedService.find(query)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean(); // Use lean for better performance

    // ✅ Enhanced platform data with platform registry info
    const enhancedPlatforms = platforms.map(platform => {
      const registryInfo = platformRegistry.detectPlatform(
        platform.domain,
        platform.sender,
        platform.subject || '',
        platform.snippet || ''
      );

      return {
        id: platform._id,
        platform: platform.platform,
        domain: platform.domain,
        sender: platform.sender,
        date: platform.date,
        lastSeen: platform.lastSeen,
        confidence: platform.confidence || registryInfo.confidence,
        category: platform.category || registryInfo.category,
        isUnsubscribed: platform.unsubscribed || false,
        isIgnored: platform.ignored || false,
        
        // ✅ Enhanced metadata from registry
        registryInfo: {
          color: registryInfo.color,
          unsubscribeSupport: registryInfo.unsubscribeSupport,
          detectionMethod: registryInfo.detectionMethod
        }
      };
    });

    // ✅ Calculate pagination metadata
    const totalPages = Math.ceil(totalPlatforms / limit);
    const hasMore = page < totalPages;

    let responseData = {
      platforms: enhancedPlatforms,
      count: enhancedPlatforms.length,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: totalPlatforms,
        hasMore,
        limit: parseInt(limit)
      },
      filters: {
        category,
        search,
        sortBy: sortField,
        sortOrder
      },
      timestamp: new Date().toISOString()
    };

    // ✅ Include statistics if requested
    if (includeStats === 'true') {
      const stats = await DetectedService.getUserStats(userId);
      responseData.stats = stats;
    }

    logger.info('Platform list retrieved', {
      userId,
      count: enhancedPlatforms.length,
      totalItems: totalPlatforms,
      filters: { category, search }
    });

    res.json(responseData);

  } catch (error) {
    logger.error('Failed to retrieve platform list', {
      userId,
      error: error.message,
      query: req.query
    });

    res.status(500).json({ 
      error: 'Failed to retrieve platforms',
      message: 'Unable to get platform list',
      timestamp: new Date().toISOString()
    });
  }
})); // ✅ FIXED: Added missing closing parenthesis

// ✅ Get single platform details
router.get('/:domain', ensureAuthenticated, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { domain } = req.params;

  try {
    const platform = await DetectedService.findOne({
      user: userId,
      domain: domain.toLowerCase()
    });

    if (!platform) {
      return res.status(404).json({
        error: 'Platform not found',
        domain,
        message: 'No platform found with the specified domain'
      });
    }

    // ✅ Get enhanced platform info from registry
    const registryInfo = platformRegistry.detectPlatform(
      platform.domain,
      platform.sender,
      platform.subject || '',
      platform.snippet || ''
    );

    // ✅ Get related platforms in same category
    const relatedPlatforms = await DetectedService.find({
      user: userId,
      category: platform.category,
      domain: { $ne: platform.domain }
    }).limit(5).select('platform domain confidence');

    const detailedPlatform = {
      id: platform._id,
      platform: platform.platform,
      domain: platform.domain,
      sender: platform.sender,
      email: platform.email,
      subject: platform.subject,
      date: platform.date,
      lastSeen: platform.lastSeen,
      confidence: platform.confidence,
      category: platform.category,
      
      // Management status
      isUnsubscribed: platform.unsubscribed || false,
      unsubscribedAt: platform.unsubscribedAt,
      isIgnored: platform.ignored || false,
      ignoredAt: platform.ignoredAt,
      
      // Enhanced metadata
      registryInfo,
      relatedPlatforms,
      
      // Analytics
      analytics: {
        emailCount: platform.emailCount || 1,
        daysSinceLastSeen: platform.lastSeen ? 
          Math.floor((Date.now() - new Date(platform.lastSeen).getTime()) / (1000 * 60 * 60 * 24)) : null
      }
    };

    res.json({
      platform: detailedPlatform,
      status: 'success'
    });

  } catch (error) {
    logger.error('Failed to get platform details', {
      userId,
      domain,
      error: error.message
    });

    res.status(500).json({
      error: 'Failed to get platform details',
      domain,
      timestamp: new Date().toISOString()
    });
  }
}));

// ✅ Search platforms across registry and user data
router.get('/search/:query', ensureAuthenticated, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { query } = req.params;
  const { limit = 20 } = req.query;

  try {
    // ✅ Search in platform registry
    const registryResults = searchPlatforms(query, limit);

    // ✅ Search in user's detected platforms
    const userPlatforms = await DetectedService.find({
      user: userId,
      $or: [
        { platform: { $regex: query, $options: 'i' } },
        { domain: { $regex: query, $options: 'i' } },
        { sender: { $regex: query, $options: 'i' } }
      ]
    }).limit(limit);

    const searchResults = {
      registry: registryResults.map(platform => ({
        ...platform,
        source: 'registry',
        isDetected: userPlatforms.some(up => up.domain === platform.domain)
      })),
      userPlatforms: userPlatforms.map(platform => ({
        id: platform._id,
        platform: platform.platform,
        domain: platform.domain,
        confidence: platform.confidence,
        category: platform.category,
        source: 'user_data',
        isUnsubscribed: platform.unsubscribed || false
      })),
      totalResults: registryResults.length + userPlatforms.length
    };

    logger.info('Platform search completed', {
      userId,
      query,
      registryResults: registryResults.length,
      userResults: userPlatforms.length
    });

    res.json(searchResults);

  } catch (error) {
    logger.error('Platform search failed', {
      userId,
      query,
      error: error.message
    });

    res.status(500).json({
      error: 'Search failed',
      query,
      timestamp: new Date().toISOString()
    });
  }
}));

// ✅ Get platform categories with statistics
router.get('/categories/stats', ensureAuthenticated, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  try {
    // ✅ Get user's platform distribution
    const userStats = await DetectedService.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$confidence' },
          unsubscribedCount: {
            $sum: { $cond: ['$unsubscribed', 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // ✅ Get registry categories with platform counts
    const registryCategories = platformRegistry.getCategoriesWithStats();

    // ✅ Merge user stats with registry info
    const enhancedCategories = registryCategories.map(category => {
      const userStat = userStats.find(stat => stat._id === category.key) || {
        count: 0,
        avgConfidence: 0,
        unsubscribedCount: 0
      };

      return {
        ...category,
        userStats: {
          detectedCount: userStat.count,
          averageConfidence: Math.round(userStat.avgConfidence || 0),
          unsubscribedCount: userStat.unsubscribedCount,
          activeCount: userStat.count - userStat.unsubscribedCount
        }
      };
    });

    res.json({
      categories: enhancedCategories,
      summary: {
        totalCategories: registryCategories.length,
        userDetectedCategories: userStats.length,
        totalUserPlatforms: userStats.reduce((sum, stat) => sum + stat.count, 0)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get category statistics', {
      userId,
      error: error.message
    });

    res.status(500).json({
      error: 'Failed to get category statistics',
      timestamp: new Date().toISOString()
    });
  }
}));

// ✅ Get platform registry information
router.get('/registry/info', ensureAuthenticated, asyncHandler(async (req, res) => {
  try {
    const registryStats = platformRegistry.getPlatformStats();
    
    res.json({
      registryInfo: {
        version: '2.0',
        lastUpdated: new Date().toISOString(),
        ...registryStats
      },
      categories: platformRegistry.getCategoriesWithStats(),
      status: 'success'
    });

  } catch (error) {
    logger.error('Failed to get registry info', {
      error: error.message
    });

    res.status(500).json({
      error: 'Failed to get registry information',
      timestamp: new Date().toISOString()
    });
  }
}));

module.exports = router;
