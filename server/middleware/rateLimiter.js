const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');
const logger = require('../utils/logger');

// ✅ Redis client for distributed rate limiting (with auto-fallback)
let redisClient = null;
let redisStore = null;

try {
  if (process.env.NODE_ENV !== 'development') {
    redisClient = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        tls: process.env.REDIS_TLS === 'true'
      },
      username: process.env.REDIS_USERNAME,
      password: process.env.REDIS_PASSWORD
    });

    redisClient.on('error', (err) => {
      logger.warn('Redis unavailable for rate limiting, falling back to memory store', { error: err.message });
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis connected for distributed rate limiting');
    });

    (async () => {
      await redisClient.connect();
    })();

    redisStore = new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
      prefix: 'rl:inboxit:',
    });
  } else {
    logger.info('🚀 Development mode: Using in-memory store for rate limiting');
  }
} catch (error) {
  logger.warn('Redis setup failed, using memory store for rate limiting', { error: error.message });
}

// ✅ Enhanced rate limit configuration
const createRateLimiterConfig = (options) => {
  const defaultConfig = {
    standardHeaders: true,
    legacyHeaders: false,
    store: redisStore,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,

    handler: (req, res) => {
      const clientInfo = {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl,
        method: req.method,
        userId: req.user?.id || req.user?._id || 'anonymous',
        timestamp: new Date().toISOString()
      };

      logger.warn('Rate limit exceeded', {
        ...clientInfo,
        limit: options.max,
        windowMs: options.windowMs,
        limitType: options.limitType || 'general'
      });

      res.status(429).json({
        error: options.message?.error || 'Too many requests',
        message: options.message?.error || 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(options.windowMs / 1000),
        limit: options.max,
        windowMs: options.windowMs,
        clientInfo: process.env.NODE_ENV === 'development' ? clientInfo : undefined,
        timestamp: new Date().toISOString()
      });
    },

    keyGenerator: (req) => {
      const userId = req.user?.id || req.user?._id;
      const baseKey = req.ip;
      if (userId && options.differentiateUsers) {
        return `${baseKey}:${userId}`;
      }
      return baseKey;
    },

    skip: (req) => {
      const trustedIPs = process.env.TRUSTED_IPS?.split(',') || [];
      const isWhitelisted = trustedIPs.includes(req.ip);
      const isHealthCheck = ['/health', '/status'].includes(req.path);

      if (isWhitelisted || isHealthCheck) {
        logger.debug('Rate limiting skipped', {
          ip: req.ip,
          path: req.path,
          reason: isWhitelisted ? 'whitelisted_ip' : 'health_check'
        });
        return true;
      }
      return false;
    }
  };

  return { ...defaultConfig, ...options };
};

// ✅ General API limiter
const apiLimiter = rateLimit(createRateLimiterConfig({
  windowMs: 15 * 60 * 1000,
  max: (req) => (req.user?.id ? 200 : 100),
  message: { error: 'Too many requests from this IP, please try again later.', retryAfter: '15 minutes' },
  limitType: 'api_general',
  differentiateUsers: true
}));

// ✅ Gmail API limiter
const gmailLimiter = rateLimit(createRateLimiterConfig({
  windowMs: 60 * 1000,
  max: (req) => {
    const user = req.user;
    if (!user) return 5;
    const accountAge = user.createdAt ? Date.now() - new Date(user.createdAt).getTime() : 0;
    const daysSinceSignup = accountAge / (1000 * 60 * 60 * 24);
    if (daysSinceSignup > 30) return 15;
    if (daysSinceSignup > 7) return 12;
    return 10;
  },
  message: { error: 'Too many Gmail API requests, please wait before trying again.', retryAfter: '1 minute' },
  limitType: 'gmail_api',
  differentiateUsers: true
}));

// ✅ Authentication limiter
const authLimiter = rateLimit(createRateLimiterConfig({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 50 : 5,
  message: { error: 'Too many authentication attempts, please try again later.', retryAfter: '15 minutes' },
  limitType: 'authentication',
  differentiateUsers: false,
  handler: (req, res, options) => {
    const clientInfo = {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      attempts: req.rateLimit.used,
      timestamp: new Date().toISOString()
    };
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Auth attempts exceeded in dev', clientInfo);
    } else {
      logger.error('Authentication rate limit reached - possible brute force attack', clientInfo);
    }
    res.status(429).json({
      error: 'Too many authentication attempts',
      retryAfter: Math.ceil(options.windowMs / 1000),
    });
  }
}));

// ✅ Other limiters
const sensitiveOperationsLimiter = rateLimit(createRateLimiterConfig({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many sensitive operation requests, please try again later.', retryAfter: '1 hour' },
  limitType: 'sensitive_operations',
  differentiateUsers: true
}));

const bulkOperationsLimiter = rateLimit(createRateLimiterConfig({
  windowMs: 10 * 60 * 1000,
  max: 2,
  message: { error: 'Too many bulk operations, please wait before starting another scan.', retryAfter: '10 minutes' },
  limitType: 'bulk_operations',
  differentiateUsers: true
}));

const uploadLimiter = rateLimit(createRateLimiterConfig({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many upload requests, please try again later.', retryAfter: '15 minutes' },
  limitType: 'file_uploads',
  differentiateUsers: true
}));

const webhookLimiter = rateLimit(createRateLimiterConfig({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Webhook rate limit exceeded', retryAfter: '1 minute' },
  limitType: 'webhooks',
  differentiateUsers: false,
  keyGenerator: (req) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
    return apiKey
      ? `webhook:${Buffer.from(apiKey).toString('base64').substring(0, 20)}`
      : `webhook:${req.ip}`;
  }
}));

// ✅ Utility functions
const getRateLimitStats = async () => {
  if (!redisClient) {
    return { store: 'memory', message: 'Rate limiting statistics not available with memory store' };
  }
  try {
    const keys = await redisClient.keys('rl:inboxit:*');
    return {
      store: 'redis',
      activeKeys: keys.length,
      keyPatterns: {
        api: keys.filter(k => k.includes('api_general')).length,
        gmail: keys.filter(k => k.includes('gmail_api')).length,
        auth: keys.filter(k => k.includes('authentication')).length,
        sensitive: keys.filter(k => k.includes('sensitive_operations')).length,
        bulk: keys.filter(k => k.includes('bulk_operations')).length
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to get rate limit stats', { error: error.message });
    return { store: 'redis', error: 'Failed to retrieve statistics', timestamp: new Date().toISOString() };
  }
};

const clearRateLimitForIP = async (ip) => {
  if (!redisClient) {
    logger.warn('Cannot clear rate limits - Redis not available');
    return false;
  }
  try {
    const keys = await redisClient.keys(`rl:inboxit:*${ip}*`);
    if (keys.length > 0) {
      await redisClient.del(...keys);
      logger.info('Rate limits cleared for IP', { ip, keysCleared: keys.length });
      return keys.length;
    }
    return 0;
  } catch (error) {
    logger.error('Failed to clear rate limits', { ip, error: error.message });
    return false;
  }
};

const shutdownRateLimit = async () => {
  if (redisClient) {
    logger.info('Closing Redis connection for rate limiting...');
    await redisClient.quit();
    logger.info('Redis connection closed');
  }
};

const healthCheckBypass = (req, res, next) => {
  if (['/health', '/status', '/ping'].includes(req.path)) {
    return next();
  }
  next();
};

module.exports = {
  apiLimiter,
  gmailLimiter,
  authLimiter,
  sensitiveOperationsLimiter,
  bulkOperationsLimiter,
  uploadLimiter,
  webhookLimiter,
  getRateLimitStats,
  clearRateLimitForIP,
  shutdownRateLimit,
  healthCheckBypass,
  createRateLimiterConfig,
  redisStore,
  redisClient
};
