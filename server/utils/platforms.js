// utils/platforms.js

const logger = require('./logger');

class PlatformRegistry {
  constructor() {
    // ✅ Comprehensive platform database with confidence scoring
    this.platforms = {
      // Social Media Platforms
      'facebook.com': {
        name: 'Facebook',
        category: 'social',
        aliases: ['facebookmail.com', 'facebook.net'],
        keywords: ['facebook', 'meta', 'friend request', 'notification', 'timeline'],
        confidence: 95,
        color: '#1877f2',
        unsubscribeSupport: 'manual',
        commonSenders: ['notification@facebookmail.com', 'security@facebookmail.com']
      },
      'instagram.com': {
        name: 'Instagram',
        category: 'social', 
        aliases: ['instagrammail.com'],
        keywords: ['instagram', 'photo', 'story', 'follow', 'like'],
        confidence: 95,
        color: '#E4405F',
        unsubscribeSupport: 'manual'
      },
      'linkedin.com': {
        name: 'LinkedIn',
        category: 'professional',
        aliases: ['linkedinlabs.com'],
        keywords: ['linkedin', 'connection', 'job', 'professional', 'network'],
        confidence: 95,
        color: '#0077B5',
        unsubscribeSupport: 'link'
      },
      'twitter.com': {
        name: 'Twitter',
        category: 'social',
        aliases: ['x.com'],
        keywords: ['twitter', 'tweet', 'follow', 'notification'],
        confidence: 95,
        color: '#1DA1F2',
        unsubscribeSupport: 'manual'
      },

      // Entertainment Platforms
      'netflix.com': {
        name: 'Netflix',
        category: 'entertainment',
        aliases: ['netflix.net'],
        keywords: ['netflix', 'streaming', 'watch', 'series', 'movie'],
        confidence: 95,
        color: '#E50914',
        unsubscribeSupport: 'link'
      },
      'spotify.com': {
        name: 'Spotify',
        category: 'entertainment',
        aliases: ['spotifymail.com'],
        keywords: ['spotify', 'music', 'playlist', 'premium', 'podcast'],
        confidence: 95,
        color: '#1DB954',
        unsubscribeSupport: 'link'
      },
      'youtube.com': {
        name: 'YouTube',
        category: 'entertainment',
        aliases: ['youtubemail.com'],
        keywords: ['youtube', 'video', 'channel', 'subscribe'],
        confidence: 95,
        color: '#FF0000',
        unsubscribeSupport: 'manual'
      },

      // E-commerce Platforms
      'amazon.com': {
        name: 'Amazon',
        category: 'ecommerce',
        aliases: ['amazon.co.uk', 'amazon.in', 'amazonses.com', 'amazon.de'],
        keywords: ['amazon', 'order', 'delivery', 'prime', 'shipment'],
        confidence: 90,
        color: '#FF9900',
        unsubscribeSupport: 'link'
      },
      'flipkart.com': {
        name: 'Flipkart',
        category: 'ecommerce',
        aliases: ['flipkart.net'],
        keywords: ['flipkart', 'order', 'delivery', 'sale', 'offer'],
        confidence: 90,
        color: '#047BD6',
        unsubscribeSupport: 'link'
      },
      'shopify.com': {
        name: 'Shopify',
        category: 'ecommerce',
        aliases: ['myshopify.com'],
        keywords: ['shopify', 'store', 'purchase', 'order'],
        confidence: 85,
        color: '#7AB55C',
        unsubscribeSupport: 'link'
      },

      // Financial Services
      'paypal.com': {
        name: 'PayPal',
        category: 'financial',
        aliases: ['paypal.co.uk', 'paypal.in'],
        keywords: ['paypal', 'payment', 'transfer', 'money', 'invoice'],
        confidence: 95,
        color: '#003087',
        unsubscribeSupport: 'link'
      },
      'stripe.com': {
        name: 'Stripe',
        category: 'financial',
        keywords: ['stripe', 'payment', 'invoice', 'subscription'],
        confidence: 90,
        color: '#635BFF',
        unsubscribeSupport: 'link'
      },

      // Indian Banking
      'hdfcbank.net': {
        name: 'HDFC Bank',
        category: 'financial',
        keywords: ['hdfc', 'bank', 'account', 'statement', 'transaction'],
        confidence: 95,
        color: '#004C8F',
        unsubscribeSupport: 'manual'
      },
      'kotak.com': {
        name: 'Kotak Bank',
        category: 'financial',
        keywords: ['kotak', 'bank', 'account', 'statement'],
        confidence: 95,
        color: '#ED1C24',
        unsubscribeSupport: 'manual'
      },

      // Development Platforms
      'github.com': {
        name: 'GitHub',
        category: 'development',
        aliases: ['github.net'],
        keywords: ['github', 'repository', 'pull request', 'commit', 'code'],
        confidence: 95,
        color: '#333',
        unsubscribeSupport: 'link'
      },
      'gitlab.com': {
        name: 'GitLab',
        category: 'development',
        keywords: ['gitlab', 'repository', 'merge request', 'pipeline'],
        confidence: 90,
        color: '#FC6D26',
        unsubscribeSupport: 'link'
      },
      'mongodb.com': {
        name: 'MongoDB',
        category: 'development',
        keywords: ['mongodb', 'database', 'atlas', 'cluster'],
        confidence: 90,
        color: '#47A248',
        unsubscribeSupport: 'link'
      },

      // Education Platforms
      'coursera.org': {
        name: 'Coursera',
        category: 'education',
        keywords: ['coursera', 'course', 'learning', 'certificate'],
        confidence: 90,
        color: '#0056D3',
        unsubscribeSupport: 'link'
      },
      'udemy.com': {
        name: 'Udemy',
        category: 'education',
        keywords: ['udemy', 'course', 'learning', 'instructor'],
        confidence: 90,
        color: '#A435F0',
        unsubscribeSupport: 'link'
      },

      // Indian Services
      'swiggy.in': {
        name: 'Swiggy',
        category: 'ecommerce',
        keywords: ['swiggy', 'food', 'delivery', 'order'],
        confidence: 90,
        color: '#FC8019',
        unsubscribeSupport: 'link'
      },
      'zomato.com': {
        name: 'Zomato',
        category: 'ecommerce',
        keywords: ['zomato', 'food', 'restaurant', 'delivery'],
        confidence: 90,
        color: '#E23744',
        unsubscribeSupport: 'link'
      },
      'internshala.com': {
        name: 'Internshala',
        category: 'education',
        keywords: ['internshala', 'internship', 'job', 'career'],
        confidence: 85,
        color: '#00A5EC',
        unsubscribeSupport: 'link'
      }
    };

    // ✅ Category definitions with descriptions
    this.categories = {
      social: {
        name: 'Social Media',
        description: 'Social networking and communication platforms',
        icon: '👥',
        priority: 3
      },
      ecommerce: {
        name: 'E-commerce',
        description: 'Online shopping and marketplace platforms',
        icon: '🛒',
        priority: 4
      },
      entertainment: {
        name: 'Entertainment',
        description: 'Streaming, gaming, and media platforms',
        icon: '🎬',
        priority: 3
      },
      financial: {
        name: 'Financial',
        description: 'Banking, payments, and financial services',
        icon: '💳',
        priority: 5
      },
      development: {
        name: 'Development',
        description: 'Code repositories and developer tools',
        icon: '💻',
        priority: 4
      },
      education: {
        name: 'Education',
        description: 'Learning platforms and educational services',
        icon: '📚',
        priority: 4
      },
      professional: {
        name: 'Professional',
        description: 'Career and professional networking',
        icon: '💼',
        priority: 4
      },
      productivity: {
        name: 'Productivity',
        description: 'Task management and productivity tools',
        icon: '📊',
        priority: 3
      },
      communication: {
        name: 'Communication',
        description: 'Messaging and communication tools',
        icon: '💬',
        priority: 3
      },
      newsletter: {
        name: 'Newsletter',
        description: 'News, updates, and subscription content',
        icon: '📰',
        priority: 2
      },
      marketing: {
        name: 'Marketing',
        description: 'Promotional and marketing communications',
        icon: '📢',
        priority: 1
      },
      other: {
        name: 'Other',
        description: 'Uncategorized services',
        icon: '📋',
        priority: 1
      }
    };
  }

  // ✅ Main platform detection method
  detectPlatform(domain, fromHeader = '', subject = '', snippet = '') {
    try {
      const normalizedDomain = domain.toLowerCase().trim();
      const combinedText = `${fromHeader} ${subject} ${snippet}`.toLowerCase();

      // Direct domain match
      if (this.platforms[normalizedDomain]) {
        const platform = this.platforms[normalizedDomain];
        return {
          ...platform,
          domain: normalizedDomain,
          detectionMethod: 'direct_match',
          matchedBy: 'domain'
        };
      }

      // Alias matching
      for (const [primaryDomain, platform] of Object.entries(this.platforms)) {
        if (platform.aliases?.some(alias => normalizedDomain.includes(alias))) {
          return {
            ...platform,
            domain: normalizedDomain,
            detectionMethod: 'alias_match',
            matchedBy: 'alias'
          };
        }
      }

      // Keyword matching with confidence adjustment
      let bestMatch = null;
      let highestScore = 0;

      for (const [primaryDomain, platform] of Object.entries(this.platforms)) {
        const keywordMatches = platform.keywords.filter(keyword => 
          combinedText.includes(keyword)
        ).length;

        if (keywordMatches > 0) {
          const score = (keywordMatches / platform.keywords.length) * platform.confidence;
          if (score > highestScore && score > 30) { // Minimum threshold
            highestScore = score;
            bestMatch = {
              ...platform,
              domain: normalizedDomain,
              confidence: Math.round(score),
              detectionMethod: 'keyword_match',
              matchedBy: 'keywords',
              keywordMatches
            };
          }
        }
      }

      if (bestMatch) {
        return bestMatch;
      }

      // Fallback: generate platform from domain
      return this.generatePlatformFromDomain(normalizedDomain);

    } catch (error) {
      logger.error('Platform detection failed', {
        domain,
        error: error.message
      });
      return this.generatePlatformFromDomain(domain);
    }
  }

  // ✅ Generate platform info from domain when no match found
  generatePlatformFromDomain(domain) {
    try {
      const parts = domain.split('.');
      let platformName = parts[0];

      // Handle subdomains
      if (['mail', 'noreply', 'no-reply', 'support', 'team'].includes(platformName)) {
        platformName = parts.length > 1 ? parts[1] : platformName;
      }

      // Clean and format name
      platformName = platformName.replace(/[-_]/g, ' ');
      platformName = platformName.charAt(0).toUpperCase() + platformName.slice(1).toLowerCase();

      return {
        name: platformName,
        domain: domain,
        category: 'other',
        confidence: 40, // Lower confidence for generated platforms
        color: '#6B7280',
        unsubscribeSupport: 'unknown',
        detectionMethod: 'domain_generation',
        matchedBy: 'fallback'
      };

    } catch (error) {
      return {
        name: 'Unknown',
        domain: domain,
        category: 'other',
        confidence: 20,
        color: '#6B7280',
        unsubscribeSupport: 'unknown',
        detectionMethod: 'fallback'
      };
    }
  }

  // ✅ Get platforms by category
  getPlatformsByCategory(category) {
    return Object.entries(this.platforms)
      .filter(([_, platform]) => platform.category === category)
      .map(([domain, platform]) => ({ ...platform, domain }))
      .sort((a, b) => b.confidence - a.confidence);
  }

  // ✅ Get all categories with stats
  getCategoriesWithStats() {
    const stats = {};
    
    // Count platforms per category
    Object.values(this.platforms).forEach(platform => {
      stats[platform.category] = (stats[platform.category] || 0) + 1;
    });

    return Object.entries(this.categories).map(([key, category]) => ({
      key,
      ...category,
      platformCount: stats[key] || 0
    })).sort((a, b) => b.priority - a.priority);
  }

  // ✅ Search platforms
  searchPlatforms(query, limit = 10) {
    const searchTerm = query.toLowerCase();
    const matches = [];

    Object.entries(this.platforms).forEach(([domain, platform]) => {
      let score = 0;

      // Name match
      if (platform.name.toLowerCase().includes(searchTerm)) {
        score += 100;
      }

      // Domain match
      if (domain.includes(searchTerm)) {
        score += 80;
      }

      // Keyword match
      const keywordMatches = platform.keywords.filter(k => k.includes(searchTerm)).length;
      score += keywordMatches * 20;

      if (score > 0) {
        matches.push({
          ...platform,
          domain,
          searchScore: score
        });
      }
    });

    return matches
      .sort((a, b) => b.searchScore - a.searchScore)
      .slice(0, limit);
  }

  // ✅ Get platform statistics
  getPlatformStats() {
    const platforms = Object.values(this.platforms);
    
    return {
      totalPlatforms: platforms.length,
      categoryCounts: this.getCategoriesWithStats(),
      averageConfidence: Math.round(
        platforms.reduce((sum, p) => sum + p.confidence, 0) / platforms.length
      ),
      unsubscribeSupport: {
        link: platforms.filter(p => p.unsubscribeSupport === 'link').length,
        manual: platforms.filter(p => p.unsubscribeSupport === 'manual').length,
        unknown: platforms.filter(p => p.unsubscribeSupport === 'unknown').length
      }
    };
  }

  // ✅ Add new platform (for dynamic updates)
  addPlatform(domain, platformData) {
    if (this.platforms[domain]) {
      logger.warn('Platform already exists', { domain });
      return false;
    }

    this.platforms[domain] = {
      confidence: 50,
      category: 'other',
      unsubscribeSupport: 'unknown',
      keywords: [],
      ...platformData
    };

    logger.info('New platform added', { domain, name: platformData.name });
    return true;
  }
}

// ✅ Create singleton instance
const platformRegistry = new PlatformRegistry();

// ✅ Export functions for backward compatibility
const detectPlatform = (domain, fromHeader, subject, snippet) => {
  return platformRegistry.detectPlatform(domain, fromHeader, subject, snippet);
};

const getPlatformsByCategory = (category) => {
  return platformRegistry.getPlatformsByCategory(category);
};

const searchPlatforms = (query, limit) => {
  return platformRegistry.searchPlatforms(query, limit);
};

module.exports = {
  platformRegistry,
  detectPlatform,
  getPlatformsByCategory,
  searchPlatforms,
  
  // Export all methods
  ...platformRegistry
};
