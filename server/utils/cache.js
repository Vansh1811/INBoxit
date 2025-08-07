const logger = require('./logger');

class MemoryCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };

    // Clean expired entries every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    // Log stats every hour
    setInterval(() => {
      this.logStats();
    }, 60 * 60 * 1000);
  }

  set(key, value, ttlSeconds = 3600) {
    try {
      // Clear existing timer if key exists
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
      }

      // Set value with metadata
      this.cache.set(key, {
        value,
        expires: Date.now() + (ttlSeconds * 1000),
        created: Date.now(),
        accessed: Date.now(),
        hits: 0
      });

      // Set expiration timer
      const timer = setTimeout(() => {
        this.delete(key);
      }, ttlSeconds * 1000);

      this.timers.set(key, timer);
      this.stats.sets++;

      logger.debug(`Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > item.expires) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access metadata
    item.accessed = Date.now();
    item.hits++;
    this.stats.hits++;

    logger.debug(`Cache HIT: ${key}`);
    return item.value;
  }

  delete(key) {
    // Clear timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }

    // Remove from cache
    const existed = this.cache.delete(key);
    if (existed) {
      this.stats.deletes++;
      logger.debug(`Cache DELETE: ${key}`);
    }
    return existed;
  }

  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;

    // Check if expired
    if (Date.now() > item.expires) {
      this.delete(key);
      return false;
    }

    return true;
  }

  clear() {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }

    const count = this.cache.size;
    this.timers.clear();
    this.cache.clear();
    
    logger.info(`Cache cleared: ${count} entries removed`);
    return count;
  }

  cleanup() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.delete(key));
    
    if (expiredKeys.length > 0) {
      logger.info(`Cache cleanup: removed ${expiredKeys.length} expired entries`);
    }
  }

  // Get cache statistics
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    return {
      size: this.cache.size,
      timers: this.timers.size,
      hitRate: `${hitRate}%`,
      ...this.stats
    };
  }

  logStats() {
    const stats = this.getStats();
    logger.info('Cache statistics:', stats);
  }

  // Get entries by pattern
  getByPattern(pattern) {
    const regex = new RegExp(pattern);
    const matches = [];
    
    for (const [key, item] of this.cache.entries()) {
      if (regex.test(key) && Date.now() <= item.expires) {
        matches.push({ key, value: item.value });
      }
    }
    
    return matches;
  }

  // Invalidate by pattern
  invalidatePattern(pattern) {
    const regex = new RegExp(pattern);
    const keysToDelete = [];
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.delete(key));
    logger.info(`Pattern invalidation: removed ${keysToDelete.length} keys matching ${pattern}`);
    
    return keysToDelete.length;
  }
}

// Create singleton instance
const cache = new MemoryCache();

// Enhanced helper functions with fallback strategies
const cacheHelpers = {
  // Cache user's email services with smart invalidation
  getUserServices: (userId) => {
    const key = `user_services_${userId}`;
    return cache.get(key);
  },

  setUserServices: (userId, services, ttl = 1800) => {
    const key = `user_services_${userId}`;
    return cache.set(key, services, ttl); // 30 minutes
  },

  // Cache Gmail API responses with query-specific keys
  getGmailData: (userId, query) => {
    const key = `gmail_${userId}_${query}`;
    return cache.get(key);
  },

  setGmailData: (userId, query, data, ttl = 600) => {
    const key = `gmail_${userId}_${query}`;
    return cache.set(key, data, ttl); // 10 minutes
  },

  // Cache platform detection results
  getPlatformData: (userId) => {
    const key = `platforms_${userId}`;
    return cache.get(key);
  },

  setPlatformData: (userId, platforms, ttl = 3600) => {
    const key = `platforms_${userId}`;
    return cache.set(key, platforms, ttl); // 1 hour
  },

  // Clear user-specific cache with pattern matching
  clearUserCache: (userId) => {
    const pattern = `.*${userId}.*`;
    return cache.invalidatePattern(pattern);
  },

  // Clear all Gmail-related cache
  clearGmailCache: () => {
    return cache.invalidatePattern('gmail_.*');
  },

  // Get with fallback function
  getWithFallback: async (key, fallbackFn, ttl = 3600) => {
    let data = cache.get(key);
    
    if (data === null && fallbackFn) {
      try {
        data = await fallbackFn();
        if (data !== null) {
          cache.set(key, data, ttl);
        }
      } catch (error) {
        logger.error('Cache fallback function failed:', error);
      }
    }
    
    return data;
  }
};

module.exports = {
  cache,
  ...cacheHelpers
};
