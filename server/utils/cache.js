class MemoryCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
    
    // Clean expired entries every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  set(key, value, ttlSeconds = 3600) {
    // Clear existing timer if key exists
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Set value
    this.cache.set(key, {
      value,
      expires: Date.now() + (ttlSeconds * 1000)
    });

    // Set expiration timer
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttlSeconds * 1000);

    this.timers.set(key, timer);
  }

  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Check if expired
    if (Date.now() > item.expires) {
      this.delete(key);
      return null;
    }

    return item.value;
  }

  delete(key) {
    // Clear timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }

    // Remove from cache
    this.cache.delete(key);
  }

  has(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }

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
    
    this.timers.clear();
    this.cache.clear();
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
      console.log(`Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }

  // Get cache statistics
  getStats() {
    return {
      size: this.cache.size,
      timers: this.timers.size
    };
  }
}

// Create singleton instance
const cache = new MemoryCache();

// Helper functions for common cache patterns
const cacheHelpers = {
  // Cache user's email services
  getUserServices: (userId) => cache.get(`user_services_${userId}`),
  setUserServices: (userId, services, ttl = 1800) => cache.set(`user_services_${userId}`, services, ttl), // 30 minutes

  // Cache Gmail API responses
  getGmailData: (userId, query) => cache.get(`gmail_${userId}_${query}`),
  setGmailData: (userId, query, data, ttl = 600) => cache.set(`gmail_${userId}_${query}`, data, ttl), // 10 minutes

  // Cache platform detection results
  getPlatformData: (userId) => cache.get(`platforms_${userId}`),
  setPlatformData: (userId, platforms, ttl = 3600) => cache.set(`platforms_${userId}`, platforms, ttl), // 1 hour

  // Clear user-specific cache
  clearUserCache: (userId) => {
    const userKeys = Array.from(cache.cache.keys()).filter(key => key.includes(userId));
    userKeys.forEach(key => cache.delete(key));
  }
};

module.exports = {
  cache,
  ...cacheHelpers
};