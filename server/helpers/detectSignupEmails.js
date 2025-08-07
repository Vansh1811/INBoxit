const gmailBatchProcessor = require('./gmailBatchProcessor');
const tokenManager = require('../utils/tokenManager');
const logger = require('../utils/logger');
const { getUserServices, setUserServices, clearUserCache } = require('../utils/cache');
const { asyncHandler } = require('../middleware/errorHandler');

class SignupEmailDetector {
  constructor() {
    // ✅ Enhanced signup keywords with categorization
    this.signupKeywords = {
      strong: [
        'welcome to', 'account created', 'verify your email', 'confirm your email',
        'thanks for signing up', 'getting started', 'account setup', 'activate your',
        'registration complete', 'confirm your account', 'verify your account'
      ],
      medium: [
        'welcome', 'verify', 'confirm', 'activate', 'registration', 'signup', 'sign up',
        'account', 'created', 'new account', 'finish setup', 'complete your',
        'onboard', 'getting started', 'joined', 'membership'
      ],
      weak: [
        'thanks', 'thank you', 'newsletter', 'subscription', 'updates', 
        'login', 'logged in', 'first time', 'trial', 'free trial'
      ]
    };

    // ✅ Enhanced domain exclusions
    this.excludedDomains = [
      // Personal email providers
      'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
      'yahoo.com', 'ymail.com', 'rocketmail.com', 'aol.com', 'icloud.com',
      'me.com', 'mac.com', 'protonmail.com', 'proton.me', 'tutanota.com',
      'mail.com', 'gmx.com', 'yandex.com', 'inbox.com', 'zoho.com',
      
      // System/Internal domains
      'localhost', 'local', 'internal', 'corp', 'company.local',
      
      // Government/Educational (often not unsubscribable)
      'gov', 'edu', 'ac.uk', 'uni.edu'
    ];

    // ✅ Suspicious patterns that indicate spam/phishing
    this.suspiciousPatterns = [
      /\d{6,}/g, // Long number sequences
      /urgent/i, /act now/i, /limited time/i, /expires/i,
      /click here/i, /free money/i, /congratulations/i,
      /you've won/i, /claim now/i, /risk free/i
    ];

    // ✅ Enhanced platform recognition
    this.platformMap = {
      'netflix.com': { name: 'Netflix', category: 'entertainment' },
      'spotify.com': { name: 'Spotify', category: 'entertainment' },
      'amazon.com': { name: 'Amazon', category: 'ecommerce' },
      'amazon.co.uk': { name: 'Amazon UK', category: 'ecommerce' },
      'facebook.com': { name: 'Facebook', category: 'social' },
      'instagram.com': { name: 'Instagram', category: 'social' },
      'linkedin.com': { name: 'LinkedIn', category: 'professional' },
      'github.com': { name: 'GitHub', category: 'development' },
      'discord.com': { name: 'Discord', category: 'communication' },
      'slack.com': { name: 'Slack', category: 'productivity' },
      'notion.so': { name: 'Notion', category: 'productivity' },
      'dropbox.com': { name: 'Dropbox', category: 'storage' },
      'uber.com': { name: 'Uber', category: 'transportation' },
      'airbnb.com': { name: 'Airbnb', category: 'travel' },
      'paypal.com': { name: 'PayPal', category: 'financial' },
      'stripe.com': { name: 'Stripe', category: 'financial' },
      'shopify.com': { name: 'Shopify', category: 'ecommerce' },
      'wordpress.com': { name: 'WordPress', category: 'website' },
      'medium.com': { name: 'Medium', category: 'publishing' },
      'substack.com': { name: 'Substack', category: 'newsletter' },
      'mailchimp.com': { name: 'Mailchimp', category: 'marketing' },
      'canva.com': { name: 'Canva', category: 'design' },
      'figma.com': { name: 'Figma', category: 'design' },
      'zoom.us': { name: 'Zoom', category: 'communication' },
      'microsoft.com': { name: 'Microsoft', category: 'technology' },
      'apple.com': { name: 'Apple', category: 'technology' },
      'google.com': { name: 'Google', category: 'technology' },
      'coursera.org': { name: 'Coursera', category: 'education' },
      'udemy.com': { name: 'Udemy', category: 'education' },
      'skillshare.com': { name: 'Skillshare', category: 'education' },
      'duolingo.com': { name: 'Duolingo', category: 'education' }
    };
  }

  // ✅ Enhanced email extraction with better parsing
  extractEmail(from) {
    try {
      // Handle multiple formats: "Name <email>", "<email>", "email"
      const angleMatch = from.match(/<([^>]+)>/);
      if (angleMatch) {
        return angleMatch[1].toLowerCase().trim();
      }
      
      // Direct email format
      const emailMatch = from.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) {
        return emailMatch[1].toLowerCase().trim();
      }
      
      // Fallback to the whole string if it looks like an email
      const cleaned = from.toLowerCase().trim();
      if (cleaned.includes('@') && cleaned.includes('.')) {
        return cleaned;
      }
      
      return null;
    } catch (error) {
      logger.warn('Email extraction failed', { from, error: error.message });
      return null;
    }
  }

  // ✅ Enhanced platform name extraction with intelligent fallbacks
  extractPlatformInfo(fromHeader, domain, subject = '') {
    try {
      // Check if we have a known platform mapping
      if (this.platformMap[domain]) {
        return this.platformMap[domain];
      }

      // Extract name from From header
      const nameMatch = fromHeader.match(/^([^<]+)</);
      if (nameMatch) {
        let name = nameMatch[1].trim().replace(/['"]/g, '');
        
        // Clean common prefixes/suffixes
        name = name.replace(/^(team|support|hello|hi|noreply|no-reply)\s*/i, '');
        name = name.replace(/\s*(team|support)$/i, '');
        
        if (name && name.length > 1 && !this.isGenericName(name)) {
          return {
            name: this.capitalizeWords(name),
            category: this.guessCategory(domain, subject)
          };
        }
      }

      // Extract from domain
      const domainParts = domain.split('.');
      const mainPart = domainParts[0];
      
      // Handle common subdomain patterns
      if (mainPart === 'mail' || mainPart === 'noreply' || mainPart === 'no-reply') {
        const secondPart = domainParts[1];
        if (secondPart) {
          return {
            name: this.capitalizeWords(secondPart),
            category: this.guessCategory(domain, subject)
          };
        }
      }

      return {
        name: this.capitalizeWords(mainPart),
        category: this.guessCategory(domain, subject)
      };

    } catch (error) {
      logger.warn('Platform info extraction failed', { fromHeader, domain, error: error.message });
      return {
        name: this.capitalizeWords(domain.split('.')[0]),
        category: 'other'
      };
    }
  }

  // ✅ Intelligent category guessing based on domain and content
  guessCategory(domain, subject) {
    const categories = {
      social: ['social', 'connect', 'friend', 'follow', 'like', 'share'],
      ecommerce: ['shop', 'store', 'buy', 'cart', 'order', 'purchase', 'sale'],
      financial: ['bank', 'pay', 'money', 'credit', 'debit', 'invest', 'loan'],
      entertainment: ['watch', 'stream', 'play', 'game', 'music', 'video'],
      education: ['learn', 'course', 'class', 'study', 'skill', 'training'],
      productivity: ['task', 'project', 'manage', 'organize', 'plan', 'work'],
      communication: ['message', 'chat', 'call', 'meet', 'video', 'conference'],
      newsletter: ['newsletter', 'digest', 'update', 'news', 'weekly', 'monthly'],
      marketing: ['marketing', 'campaign', 'promo', 'offer', 'deal', 'discount']
    };

    const text = `${domain} ${subject}`.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category;
      }
    }

    return 'other';
  }

  // ✅ Advanced signup detection with confidence scoring
  analyzeSignupProbability(subject, fromHeader, snippet = '', date = '') {
    const text = `${subject} ${fromHeader} ${snippet}`.toLowerCase();
    let score = 0;
    let reasons = [];

    // Check strong indicators (high confidence)
    for (const keyword of this.signupKeywords.strong) {
      if (text.includes(keyword)) {
        score += 40;
        reasons.push(`Strong: "${keyword}"`);
      }
    }

    // Check medium indicators
    let mediumCount = 0;
    for (const keyword of this.signupKeywords.medium) {
      if (text.includes(keyword)) {
        mediumCount++;
      }
    }
    
    if (mediumCount >= 2) {
      score += 30;
      reasons.push(`Medium: ${mediumCount} keywords`);
    } else if (mediumCount === 1) {
      score += 15;
    }

    // Check weak indicators
    for (const keyword of this.signupKeywords.weak) {
      if (text.includes(keyword)) {
        score += 5;
        break; // Only count once
      }
    }

    // Subject line bonus (subjects are more reliable)
    if (subject.toLowerCase().includes('welcome') || 
        subject.toLowerCase().includes('verify') ||
        subject.toLowerCase().includes('confirm')) {
      score += 20;
      reasons.push('Subject bonus');
    }

    // Check for suspicious patterns (reduce score)
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(text)) {
        score -= 25;
        reasons.push('Suspicious pattern detected');
        break;
      }
    }

    // Date-based scoring (newer emails more likely to be relevant)
    if (date) {
      try {
        const emailDate = new Date(date);
        const daysSinceEmail = (Date.now() - emailDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceEmail < 30) score += 10;      // Recent emails
        else if (daysSinceEmail > 365 * 2) score -= 10; // Very old emails
      } catch (e) {
        // Invalid date, ignore
      }
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      confidence: score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low',
      reasons,
      isSignup: score >= 25 // Minimum threshold for signup detection
    };
  }

  // ✅ Enhanced domain validation
  isValidServiceDomain(domain) {
    if (!domain || typeof domain !== 'string') return false;
    
    // Basic format checks
    if (!domain.includes('.') || domain.split('.').length < 2) return false;
    
    // Check against excluded domains
    if (this.excludedDomains.some(excluded => 
      domain === excluded || domain.endsWith(`.${excluded}`))) {
      return false;
    }
    
    // Check for invalid patterns
    const invalidPatterns = [
      /^\d+\.\d+\.\d+\.\d+$/, // IP addresses
      /localhost/i,
      /\.local$/i,
      /^[^.]+$/, // No dots
      /\s/, // Contains spaces
      /[<>{}]/  // Contains invalid characters
    ];
    
    if (invalidPatterns.some(pattern => pattern.test(domain))) {
      return false;
    }
    
    return true;
  }

  // ✅ Utility methods
  isGenericName(name) {
    const generic = ['team', 'support', 'admin', 'info', 'hello', 'hi', 'noreply', 'no-reply'];
    return generic.includes(name.toLowerCase());
  }

  capitalizeWords(str) {
    return str.split(/[\s-_]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // ✅ Enhanced main detection function with progress tracking
  async detectSignupEmails(user, forceRefresh = false, progressCallback = null) {
    const userId = user.id || user._id;

    try {
      logger.info('Starting enhanced signup email detection', {
        userId,
        email: user.email,
        forceRefresh
      });

      // ✅ Check cache first unless forcing refresh
      if (!forceRefresh) {
        const cached = getUserServices(userId);
        if (cached && cached.length > 0) {
          logger.info('Returning cached signup services', { 
            userId, 
            count: cached.length 
          });
          
          if (progressCallback) {
            progressCallback({
              stage: 'cache_hit',
              processed: cached.length,
              total: cached.length,
              percentage: 100,
              fromCache: true
            });
          }
          
          return cached;
        }
      }

      // ✅ Progress update
      if (progressCallback) {
        progressCallback({
          stage: 'initializing',
          processed: 0,
          total: 0,
          percentage: 0,
          message: 'Preparing email scan...'
        });
      }

      // ✅ Enhanced query building for better results
      const enhancedQuery = this.buildOptimizedQuery();
      
      // ✅ Use enhanced batch processor with progress tracking
      const messages = await gmailBatchProcessor.fetchEmailsInBatches(
        user, 
        enhancedQuery, 
        500, // Increased limit for better coverage
        (progress) => {
          if (progressCallback) {
            progressCallback({
              ...progress,
              stage: progress.stage || 'fetching_emails'
            });
          }
        }
      );

      if (!messages || messages.length === 0) {
        logger.info('No potential signup emails found', { userId });
        return [];
      }

      logger.info(`Processing ${messages.length} potential signup emails`, { userId });

      // ✅ Progress update for processing phase
      if (progressCallback) {
        progressCallback({
          stage: 'analyzing_emails',
          processed: 0,
          total: messages.length,
          percentage: 50,
          message: 'Analyzing email content...'
        });
      }

      const servicesMap = new Map();
      let processedCount = 0;

      // ✅ Process messages with enhanced analysis
      for (const messageData of messages) {
        try {
          const service = await this.processMessage(messageData, userId);
          
          if (service) {
            // Use domain as key for deduplication, but keep the best match
            const existingService = servicesMap.get(service.domain);
            
            if (!existingService || service.confidence > existingService.confidence) {
              servicesMap.set(service.domain, service);
            }
          }

          processedCount++;

          // Progress updates every 10 messages
          if (processedCount % 10 === 0 && progressCallback) {
            progressCallback({
              stage: 'analyzing_emails',
              processed: processedCount,
              total: messages.length,
              percentage: 50 + (processedCount / messages.length) * 40,
              currentService: service?.platform || 'Unknown'
            });
          }

        } catch (error) {
          logger.warn('Error processing individual message', {
            userId,
            messageId: messageData.id,
            error: error.message
          });
        }
      }

      const results = Array.from(servicesMap.values())
        .sort((a, b) => b.confidence - a.confidence); // Sort by confidence

      logger.info('Enhanced signup email detection completed', {
        userId,
        totalProcessed: processedCount,
        servicesFound: results.length,
        highConfidence: results.filter(s => s.confidenceLevel === 'high').length,
        platforms: results.slice(0, 10).map(s => s.platform).join(', ')
      });

      // ✅ Final progress update
      if (progressCallback) {
        progressCallback({
          stage: 'complete',
          processed: results.length,
          total: results.length,
          percentage: 100,
          message: `Found ${results.length} services`
        });
      }

      // ✅ Cache results for 30 minutes
      if (results.length > 0) {
        setUserServices(userId, results, 1800);
      }

      return results;

    } catch (error) {
      logger.error('Enhanced signup email detection failed', {
        userId,
        error: error.message,
        stack: error.stack
      });

      // Clear user cache on critical errors
      if (error.message.includes('REAUTH_REQUIRED') || error.message.includes('invalid_grant')) {
        clearUserCache(userId);
      }

      throw error;
    }
  }

  // ✅ Enhanced message processing with full analysis
  async processMessage(messageData, userId) {
    try {
      const headers = messageData.payload?.headers || [];
      const getHeader = (name) => headers.find(h => 
        h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const fromHeader = getHeader('From');
      const subject = getHeader('Subject');
      const date = getHeader('Date');
      const snippet = messageData.snippet || '';

      // Extract email and validate
      const email = this.extractEmail(fromHeader);
      if (!email) return null;

      const domain = email.split('@')[1];
      if (!this.isValidServiceDomain(domain)) return null;

      // Enhanced signup analysis
      const analysis = this.analyzeSignupProbability(subject, fromHeader, snippet, date);
      if (!analysis.isSignup) return null;

      // Extract platform information
      const platformInfo = this.extractPlatformInfo(fromHeader, domain, subject);

      return {
        platform: platformInfo.name,
        email: email,
        domain: domain,
        sender: fromHeader.trim(),
        subject: subject.substring(0, 200), // Longer subject preservation
        date: date,
        messageId: messageData.id,
        threadId: messageData.threadId,
        snippet: snippet.substring(0, 150),
        lastSeen: new Date().toISOString(),
        
        // ✅ Enhanced metadata
        confidence: analysis.score,
        confidenceLevel: analysis.confidence,
        detectionReasons: analysis.reasons,
        category: platformInfo.category,
        suspicious: analysis.score < 25,
        
        // User management fields
        unsubscribed: false,
        unsubscribedAt: null,
        unsubscribeMethod: null,
        ignored: false,
        ignoredAt: null,
        isNew: true,
        
        // Analytics
        detectedAt: new Date().toISOString(),
        detectorVersion: '2.0'
      };

    } catch (error) {
      logger.error('Error processing message in enhanced detector', {
        userId,
        messageId: messageData.id,
        error: error.message
      });
      return null;
    }
  }

  // ✅ Build optimized search query
  buildOptimizedQuery() {
    const strongKeywords = this.signupKeywords.strong.slice(0, 8);
    const mediumKeywords = this.signupKeywords.medium.slice(0, 10);
    
    const queryParts = [
      `(${strongKeywords.map(k => `"${k}"`).join(' OR ')})`,
      `(${mediumKeywords.join(' OR ')})`,
      'after:2022/01/01', // Focus on recent emails
      '-from:noreply@google.com',
      '-from:security-noreply@google.com'
    ];

    return queryParts.join(' ');
  }

  // ✅ Enhanced incremental detection
  async detectNewSignupEmails(user, lastScanDate, progressCallback = null) {
    const userId = user.id || user._id;

    try {
      logger.info('Starting enhanced incremental signup detection', {
        userId,
        lastScan: lastScanDate
      });

      // Use batch processor for incremental sync
      const messages = await gmailBatchProcessor.incrementalSync(
        user, 
        lastScanDate,
        progressCallback
      );

      if (!messages || messages.length === 0) {
        logger.info('No new emails found since last scan', { userId });
        return [];
      }

      const servicesMap = new Map();
      
      for (const messageData of messages) {
        const service = await this.processMessage(messageData, userId);
        
        if (service) {
          service.isNew = true; // Mark as new for UI highlighting
          servicesMap.set(service.domain, service);
        }
      }

      const newServices = Array.from(servicesMap.values());

      logger.info('Enhanced incremental detection completed', {
        userId,
        newServicesFound: newServices.length,
        platforms: newServices.map(s => s.platform).join(', ')
      });

      return newServices;

    } catch (error) {
      logger.error('Enhanced incremental detection failed', {
        userId,
        error: error.message
      });
      throw error;
    }
  }
}

// ✅ Create singleton instance
const signupDetector = new SignupEmailDetector();

// ✅ Export functions for backward compatibility
async function detectSignupEmails(user, forceRefresh = false, progressCallback = null) {
  return await signupDetector.detectSignupEmails(user, forceRefresh, progressCallback);
}

async function detectNewSignupEmails(user, lastScanDate, progressCallback = null) {
  return await signupDetector.detectNewSignupEmails(user, lastScanDate, progressCallback);
}

// ✅ Export additional utilities
const getDetectorStats = () => ({
  version: '2.0',
  keywordCategories: Object.keys(signupDetector.signupKeywords),
  totalKeywords: Object.values(signupDetector.signupKeywords).flat().length,
  platformMappings: Object.keys(signupDetector.platformMap).length,
  excludedDomains: signupDetector.excludedDomains.length
});

module.exports = {
  detectSignupEmails,
  detectNewSignupEmails,
  getDetectorStats,
  SignupEmailDetector // Export class for testing
};
