const tokenManager = require('../utils/tokenManager');
const logger = require('../utils/logger');
const { setGmailData, getGmailData } = require('../utils/cache');

class GmailBatchProcessor {
  constructor() {
    this.batchSize = 50; // Process emails in batches of 50
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async processWithRetry(operation, retries = 0) {
    try {
      return await operation();
    } catch (error) {
      if (retries < this.maxRetries && this.isRetryableError(error)) {
        logger.warn(`Retrying operation (attempt ${retries + 1}/${this.maxRetries})`, {
          error: error.message
        });
        await this.delay(this.retryDelay * Math.pow(2, retries)); // Exponential backoff
        return this.processWithRetry(operation, retries + 1);
      }
      throw error;
    }
  }

  isRetryableError(error) {
    const retryableCodes = [429, 500, 502, 503, 504];
    return retryableCodes.includes(error.code) || 
           error.message.includes('rateLimitExceeded') ||
           error.message.includes('quotaExceeded');
  }

  async fetchEmailsInBatches(user, query = '', maxResults = 200) {
    const cacheKey = `${user.id}_${query}_${maxResults}`;
    const cached = getGmailData(user.id, cacheKey);
    
    if (cached) {
      logger.info('Returning cached Gmail data', { userId: user.id });
      return cached;
    }

    try {
      // Validate and refresh token if needed
      const tokens = await tokenManager.validateAndRefreshToken(user);
      const gmail = tokenManager.createGmailClient(tokens.accessToken);

      logger.info('Starting batch email fetch', {
        userId: user.id,
        query,
        maxResults
      });

      const allMessages = [];
      let nextPageToken = null;
      let totalFetched = 0;

      // Fetch message IDs in batches
      while (totalFetched < maxResults) {
        const batchSize = Math.min(this.batchSize, maxResults - totalFetched);
        
        const listOperation = () => gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: batchSize,
          pageToken: nextPageToken
        });

        const { data } = await this.processWithRetry(listOperation);
        
        if (!data.messages || data.messages.length === 0) {
          break;
        }

        allMessages.push(...data.messages);
        totalFetched += data.messages.length;
        nextPageToken = data.nextPageToken;

        logger.debug(`Fetched batch of ${data.messages.length} messages`, {
          totalFetched,
          hasNextPage: !!nextPageToken
        });

        if (!nextPageToken) {
          break;
        }

        // Small delay between batches to be respectful to API
        await this.delay(100);
      }

      logger.info(`Completed message list fetch: ${allMessages.length} messages`, {
        userId: user.id
      });

      // Now fetch full message details in batches
      const detailedMessages = await this.fetchMessageDetails(gmail, allMessages);

      // Cache the results
      setGmailData(user.id, cacheKey, detailedMessages, 600); // Cache for 10 minutes

      return detailedMessages;

    } catch (error) {
      logger.error('Batch email fetch failed', {
        userId: user.id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async fetchMessageDetails(gmail, messageIds) {
    const detailedMessages = [];
    const batches = this.chunkArray(messageIds, 10); // Process 10 messages at a time

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      logger.debug(`Processing message batch ${i + 1}/${batches.length}`, {
        batchSize: batch.length
      });

      // Process batch concurrently but with limit
      const batchPromises = batch.map(async (msg) => {
        const getOperation = () => gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date']
        });

        try {
          const { data } = await this.processWithRetry(getOperation);
          return data;
        } catch (error) {
          logger.warn(`Failed to fetch message ${msg.id}`, {
            error: error.message
          });
          return null; // Skip failed messages
        }
      });

      const batchResults = await Promise.all(batchPromises);
      const validResults = batchResults.filter(result => result !== null);
      
      detailedMessages.push(...validResults);

      // Delay between batches to respect rate limits
      if (i < batches.length - 1) {
        await this.delay(200);
      }
    }

    logger.info(`Fetched details for ${detailedMessages.length} messages`);
    return detailedMessages;
  }

  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // Incremental sync - only fetch emails newer than last sync
  async incrementalSync(user, lastSyncDate) {
    const afterDate = lastSyncDate ? 
      Math.floor(new Date(lastSyncDate).getTime() / 1000) : 
      Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000); // Default: 30 days ago

    const query = `after:${afterDate} (welcome OR verify OR signup OR "sign up" OR "account created" OR "thank you" OR confirm OR activate OR registration OR "getting started" OR "new account")`;

    logger.info('Starting incremental sync', {
      userId: user.id,
      afterDate: new Date(afterDate * 1000).toISOString()
    });

    return this.fetchEmailsInBatches(user, query, 500);
  }
}

module.exports = new GmailBatchProcessor();