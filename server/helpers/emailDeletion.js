const logger = require('../utils/logger');
const tokenManager = require('../utils/tokenManager');

class EmailDeletionService {
  constructor() {
    this.batchSize = 10; // Process deletions in batches
    this.maxRetries = 3;
  }

  /**
   * Delete emails from a specific platform/domain
   */
  async deleteEmailsFromPlatform(user, domain, options = {}) {
    try {
      const gmail = tokenManager.createGmailClient(user.accessToken);
      const query = `from:${domain}`;
      
      // Get emails to delete
      const emails = await this.findEmailsToDelete(gmail, query, options);
      
      if (emails.length === 0) {
        return { deleted: 0, errors: [] };
      }

      // Delete in batches
      const results = await this.batchDeleteEmails(gmail, emails);
      
      // Log deletion activity
      await this.logDeletionActivity(user.id, domain, results);
      
      return results;
    } catch (error) {
      logger.error('Email deletion failed', { 
        userId: user.id, 
        domain, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Find emails matching deletion criteria
   */
  async findEmailsToDelete(gmail, query, options) {
    const emails = [];
    let pageToken = null;
    const maxEmails = options.maxEmails || 100;

    while (emails.length < maxEmails) {
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query + (options.includeSpamOnly ? ' in:promotions OR in:spam' : ''),
        maxResults: Math.min(50, maxEmails - emails.length),
        pageToken
      });

      if (!response.data.messages) break;
      
      emails.push(...response.data.messages);
      pageToken = response.data.nextPageToken;
      
      if (!pageToken) break;
    }

    return emails;
  }

  /**
   * Delete emails in batches with error handling
   */
  async batchDeleteEmails(gmail, emails) {
    const results = { deleted: 0, errors: [] };
    const batches = this.chunkArray(emails, this.batchSize);

    for (const batch of batches) {
      try {
        // Use Gmail batch delete for efficiency
        await gmail.users.messages.batchDelete({
          userId: 'me',
          resource: {
            ids: batch.map(email => email.id)
          }
        });
        
        results.deleted += batch.length;
        logger.info(`Deleted batch of ${batch.length} emails`);
        
        // Rate limiting delay
        await this.delay(100);
        
      } catch (error) {
        logger.warn(`Batch deletion failed: ${error.message}`);
        results.errors.push({
          batch: batch.map(e => e.id),
          error: error.message
        });
        
        // Try individual deletions for failed batch
        const individualResults = await this.fallbackIndividualDelete(gmail, batch);
        results.deleted += individualResults.deleted;
        results.errors.push(...individualResults.errors);
      }
    }

    return results;
  }

  /**
   * Fallback to individual email deletion
   */
  async fallbackIndividualDelete(gmail, emails) {
    const results = { deleted: 0, errors: [] };
    
    for (const email of emails) {
      try {
        await gmail.users.messages.delete({
          userId: 'me',
          id: email.id
        });
        results.deleted++;
      } catch (error) {
        results.errors.push({
          emailId: email.id,
          error: error.message
        });
      }
      
      // Small delay between individual deletions
      await this.delay(50);
    }
    
    return results;
  }

  /**
   * Log deletion activity for audit trail
   */
  async logDeletionActivity(userId, domain, results) {
    const DeletedEmail = require('../models/DeletedEmail');
    
    await DeletedEmail.create({
      user: userId,
      domain,
      deletedCount: results.deleted,
      errorCount: results.errors.length,
      deletedAt: new Date(),
      errors: results.errors
    });
  }

  // Utility functions
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new EmailDeletionService();
