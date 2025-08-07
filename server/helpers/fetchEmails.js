const tokenManager = require('../utils/tokenManager');
const logger = require('../utils/logger');
const { setGmailData, getGmailData } = require('../utils/cache');

class EmailProcessor {
  constructor() {
    this.BATCH_SIZE = 100;
    this.MAX_MESSAGES = 1000;
    this.SIGNUP_KEYWORDS = [
      'welcome', 'verify', 'signup', 'sign up', 'account', 'thanks', 'thank you',
      'confirm', 'confirmation', 'activate', 'activation', 'registration',
      'created', 'getting started', 'get started', 'onboard', 'complete your',
      'verify your email', 'confirm your email', 'welcome to', 'joined',
      'subscription', 'subscribed', 'newsletter', 'updates', 'confirm your account'
    ];
    
    this.EXCLUDED_DOMAINS = [
      'gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com',
      'icloud.com', 'aol.com', 'protonmail.com', 'live.com',
      'msn.com', 'yandex.com', 'mail.com'
    ];
  }

  extractEmail(from) {
    const match = from.match(/<(.+)>/);
    return (match ? match[1] : from).toLowerCase().trim();
  }

  isSignupEmail(subject, fromHeader, snippet = '') {
    const textToCheck = `${subject} ${fromHeader} ${snippet}`.toLowerCase();
    return this.SIGNUP_KEYWORDS.some(keyword => textToCheck.includes(keyword));
  }

  isDomainValid(domain) {
    return domain && 
           !this.EXCLUDED_DOMAINS.includes(domain) &&
           domain.includes('.') &&
           domain.split('.').length >= 2 &&
           !domain.includes('localhost') &&
           !domain.match(/^\d+\.\d+\.\d+\.\d+$/); // Exclude IP addresses
  }

  async fetchEmailsBatch(gmail, pageToken = null, maxResults = this.BATCH_SIZE) {
    try {
      const params = {
        userId: 'me',
        labelIds: ['INBOX'],
        maxResults,
        q: `(${this.SIGNUP_KEYWORDS.slice(0, 10).join(' OR ')}) -from:noreply@google.com -from:security-noreply@google.com`
      };

      if (pageToken) {
        params.pageToken = pageToken;
      }

      const response = await gmail.users.messages.list(params);
      return {
        messages: response.data.messages || [],
        nextPageToken: response.data.nextPageToken
      };

    } catch (error) {
      logger.error('Failed to fetch email batch:', error);
      throw error;
    }
  }

  async processMessagesBatch(gmail, messages) {
    const servicesMap = new Map();
    const CONCURRENT_LIMIT = 10; // Process 10 messages at a time
    
    // Process messages in chunks to avoid rate limits
    for (let i = 0; i < messages.length; i += CONCURRENT_LIMIT) {
      const chunk = messages.slice(i, i + CONCURRENT_LIMIT);
      
      const results = await Promise.allSettled(
        chunk.map(msg => this.processMessage(gmail, msg.id))
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          const service = result.value;
          if (!servicesMap.has(service.domain)) {
            servicesMap.set(service.domain, service);
            logger.debug(`Found service: ${service.platform} (${service.domain})`);
          }
        } else if (result.status === 'rejected') {
          logger.warn(`Failed to process message ${chunk[index].id}:`, result.reason);
        }
      });

      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return Array.from(servicesMap.values());
  }

  async processMessage(gmail, messageId) {
    try {
      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date']
      });

      const headers = response.data.payload.headers;
      const fromHeader = headers.find(h => h.name === 'From')?.value || '';
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      const snippet = response.data.snippet || '';

      // Extract email address
      const from = this.extractEmail(fromHeader);
      if (!from.includes('@')) return null;

      const domain = from.split('@')[1];
      
      // Validate domain and check if it's a signup email
      if (!this.isDomainValid(domain) || !this.isSignupEmail(subject, fromHeader, snippet)) {
        return null;
      }

      // Extract platform name
      const platformName = domain.split('.')[0];
      const displayName = platformName.charAt(0).toUpperCase() + platformName.slice(1);

      return {
        platform: displayName,
        domain: domain,
        sender: from,
        subject: subject,
        date: date,
        messageId: messageId,
        lastSeen: new Date().toISOString(),
        snippet: snippet.substring(0, 100) // First 100 chars
      };

    } catch (error) {
      logger.error(`Error processing message ${messageId}:`, error.message);
      return null;
    }
  }

  async fetchEmails(userId, forceRefresh = false) {
    const cacheKey = `emails_${userId}`;
    
    // Check cache first unless forcing refresh
    if (!forceRefresh) {
      const cachedData = getGmailData(userId, 'services');
      if (cachedData) {
        logger.info('Returning cached email services', { userId, count: cachedData.length });
        return cachedData;
      }
    }

    try {
      const gmail = await tokenManager.getGmailForUser(userId);
      let allServices = [];
      let processedCount = 0;
      let pageToken = null;

      logger.info('🔍 Starting email fetch...', { userId });

      do {
        // Fetch batch of messages
        const batch = await this.fetchEmailsBatch(gmail, pageToken);
        const { messages, nextPageToken } = batch;

        if (!messages.length) break;

        // Process this batch
        const services = await this.processMessagesBatch(gmail, messages);
        allServices = allServices.concat(services);

        processedCount += messages.length;
        pageToken = nextPageToken;

        logger.info(`Processed ${processedCount} messages, found ${allServices.length} unique services`);

        // Stop if we've processed enough messages
        if (processedCount >= this.MAX_MESSAGES) break;

      } while (pageToken);

      // Deduplicate services by domain
      const uniqueServices = Array.from(
        new Map(allServices.map(service => [service.domain, service])).values()
      );

      logger.info(`✅ Email fetch complete`, {
        userId,
        totalProcessed: processedCount,
        uniqueServices: uniqueServices.length,
        services: uniqueServices.map(s => s.platform).join(', ')
      });

      // Cache results for 30 minutes
      setGmailData(userId, 'services', uniqueServices, 1800);

      return uniqueServices;

    } catch (error) {
      logger.error('Email fetch failed:', {
        userId,
        error: error.message
      });

      // Re-throw with more context
      if (error.message.includes('REAUTH_REQUIRED')) {
        throw new Error('REAUTH_REQUIRED');
      }

      throw new Error(`Email fetch failed: ${error.message}`);
    }
  }
}

// Export the function for backward compatibility
async function fetchEmails(tokens, userId) {
  const processor = new EmailProcessor();
  return await processor.fetchEmails(userId);
}

module.exports = fetchEmails;
