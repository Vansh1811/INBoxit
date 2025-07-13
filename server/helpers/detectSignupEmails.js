// const gmailBatchProcessor = require('./gmailBatchProcessor');
const logger = require('../utils/logger');
// const { getUserServices, setUserServices } = require('../utils/cache');
const { google } = require('googleapis');

/**
 * Extract clean email address from "From" header
 * Example: "Netflix <no-reply@netflix.com>" → "no-reply@netflix.com"
 */
const extractEmail = (from) => {
  const match = from.match(/<(.+)>/);
  return (match ? match[1] : from).toLowerCase().trim();
};

/**
 * Create Gmail client
 */
function getGmailClient(accessToken) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken,
  });
  return google.gmail({
    version: 'v1',
    auth: oauth2Client,
  });
}

/**
 * Extract sender name from "From" header, fallback to domain
 * Example: "Netflix <no-reply@netflix.com>" → "Netflix"
 * Example: "no-reply@facebook.com" → "Facebook"
 */
const extractSenderName = (from, domain) => {
  // Try to get name before email
  const nameMatch = from.match(/^([^<]+)</);
  if (nameMatch) {
    const name = nameMatch[1].trim().replace(/['"]/g, '');
    if (name && name !== 'no-reply' && name !== 'noreply') {
      return name;
    }
  }

  // Fallback to domain-based name
  const domainMap = {
    'netflix.com': 'Netflix',
    'spotify.com': 'Spotify',
    'amazon.com': 'Amazon',
    'facebook.com': 'Facebook',
    'instagram.com': 'Instagram',
    'linkedin.com': 'LinkedIn',
    'github.com': 'GitHub',
    'discord.com': 'Discord',
    'google.com': 'Google',
    'youtube.com': 'YouTube',
    'twitter.com': 'Twitter',
    'x.com': 'X (Twitter)',
    'uber.com': 'Uber',
    'airbnb.com': 'Airbnb',
    'dropbox.com': 'Dropbox',
    'slack.com': 'Slack',
    'zoom.us': 'Zoom',
    'microsoft.com': 'Microsoft',
    'apple.com': 'Apple',
    'paypal.com': 'PayPal',
    'stripe.com': 'Stripe',
    'shopify.com': 'Shopify',
    'wordpress.com': 'WordPress',
    'medium.com': 'Medium',
    'reddit.com': 'Reddit',
    'pinterest.com': 'Pinterest',
    'tiktok.com': 'TikTok',
    'snapchat.com': 'Snapchat',
    'whatsapp.com': 'WhatsApp',
    'telegram.org': 'Telegram',
    'coursera.org': 'Coursera',
    'udemy.com': 'Udemy',
    'skillshare.com': 'Skillshare',
    'duolingo.com': 'Duolingo'
  };

  if (domainMap[domain]) {
    return domainMap[domain];
  }

  // Generate name from domain
  const baseDomain = domain.split('.')[0];
  return baseDomain.charAt(0).toUpperCase() + baseDomain.slice(1);
};

/**
 * Check if email is a signup/welcome/verification email
 */
const isSignupEmail = (subject, from) => {
  const signupKeywords = [
    'welcome', 'verify', 'signup', 'sign up', 'account', 'thanks', 'thank you',
    'confirm', 'confirmation', 'activate', 'activation', 'registration',
    'created', 'getting started', 'get started', 'onboard', 'complete your',
    'verify your email', 'confirm your email', 'welcome to', 'joined',
    'subscription', 'subscribed', 'newsletter', 'updates', 'login',
    'logged in', 'new account', 'account setup', 'finish setup'
  ];

  const combined = (subject + ' ' + from).toLowerCase();
  return signupKeywords.some(keyword => combined.includes(keyword));
};

/**
 * Main function to detect signup emails and extract platform services
 * Enhanced to fetch ALL historical emails with pagination
 */
async function detectSignupEmails(user, forceRefresh = false, onProgress = null) {
  if (!user.accessToken) {
    throw new Error('User access token missing');
  }

  const servicesMap = new Map();

  logger.info('Starting signup email detection', { userId: user.id });

  try {
    // Simple Gmail API call for now
    const gmail = getGmailClient(user.accessToken);
    
    // Enhanced query to catch more signup emails
    const signupQuery = [
      'welcome OR verify OR signup OR "sign up" OR "account created"',
      '"thank you" OR confirm OR activate OR registration OR "getting started"',
      '"new account" OR "account setup" OR "finish setup" OR onboard',
      'subscription OR subscribed OR newsletter OR updates OR login',
      '"logged in" OR "complete your" OR "verify your email"'
    ].join(' OR ');

    let allMessages = [];
    let nextPageToken = null;
    let totalScanned = 0;
    const batchSize = 100;
    let pageCount = 0;
    const maxPages = 50; // Limit to prevent infinite loops

    logger.info('Starting comprehensive email scan', { 
      userId: user.id,
      query: signupQuery 
    });

    // Fetch all messages with pagination
    do {
      try {
        const { data } = await gmail.users.messages.list({
          userId: 'me',
          labelIds: ['INBOX'],
          maxResults: batchSize,
          pageToken: nextPageToken,
          q: signupQuery
        });

        const messages = data.messages || [];
        allMessages.push(...messages);
        totalScanned += messages.length;
        nextPageToken = data.nextPageToken;
        pageCount++;

        // Report progress
        if (onProgress) {
          onProgress({
            scanned: totalScanned,
            page: pageCount,
            hasMore: !!nextPageToken
          });
        }

        logger.info(`Fetched page ${pageCount}: ${messages.length} messages`, {
          totalScanned,
          hasMore: !!nextPageToken
        });

        // Small delay to respect rate limits
        if (nextPageToken) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        logger.error(`Error fetching page ${pageCount}`, {
          error: error.message,
          pageCount
        });
        break; // Stop on error but don't fail completely
      }

    } while (nextPageToken && pageCount < maxPages);

    logger.info(`Email scan completed: ${allMessages.length} potential signup emails found`, {
      userId: user.id,
      totalPages: pageCount,
      totalScanned
    });

    if (!allMessages.length) {
      logger.info('No signup emails found', { userId: user.id });
      return [];
    }

    // Process messages in batches to avoid overwhelming the API
    const processBatchSize = 20;
    let processedCount = 0;

    // Enhanced excluded domains list
    const excludedDomains = [
      'gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com',
      'icloud.com', 'aol.com', 'protonmail.com', 'live.com',
      'msn.com', 'ymail.com', 'mail.com', 'me.com',
      'googlemail.com', 'outlook.co.uk', 'btinternet.com'
    ];

    // Process messages in batches
    for (let i = 0; i < allMessages.length; i += processBatchSize) {
      const batch = allMessages.slice(i, i + processBatchSize);
      
      await Promise.all(batch.map(async (msg) => {
        try {
          const { data: messageData } = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date'],
          });

          const headers = messageData.payload.headers;
          const fromHeader = headers.find(h => h.name === 'From')?.value || '';
          const subject = headers.find(h => h.name === 'Subject')?.value || '';
          const date = headers.find(h => h.name === 'Date')?.value || '';

          // Extract email and validate
          const email = extractEmail(fromHeader);
          if (!email.includes('@')) return;

          const domain = email.split('@')[1];
          if (!domain || excludedDomains.includes(domain)) return;

          // Enhanced signup email detection
          if (!isSignupEmail(subject, fromHeader)) return;

          // Extract platform name with better logic
          const platformName = extractSenderName(fromHeader, domain);

          // Store unique service (deduplicate by domain)
          if (!servicesMap.has(domain)) {
            servicesMap.set(domain, {
              platform: platformName,
              email: email,
              domain: domain,
              subject: subject.substring(0, 100), // Truncate long subjects
              date: date,
              lastSeen: new Date().toISOString(),
              suspicious: false, // Will be updated by AI analysis later
              unsubscribed: false,
              ignored: false
            });

            logger.debug(`Found signup service: ${platformName} (${domain})`);
          }

        } catch (err) {
          logger.warn(`Error processing message ${msg.id}`, {
            error: err.message,
            userId: user.id
          });
        }
      }));

      processedCount += batch.length;
      
      // Report processing progress
      if (onProgress) {
        onProgress({
          processed: processedCount,
          total: allMessages.length,
          found: servicesMap.size
        });
      }

      // Small delay between batches
      if (i + processBatchSize < allMessages.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    const results = Array.from(servicesMap.values());
    
    logger.info(`Comprehensive signup email detection completed`, {
      userId: user.id,
      totalEmailsScanned: allMessages.length,
      servicesFound: results.length,
      pagesProcessed: pageCount,
      services: results.map(s => s.platform).join(', ')
    });

    return results;

  } catch (error) {
    logger.error('Comprehensive signup email detection failed', {
      userId: user.id,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Enhanced signup email detection with better patterns
 */
const isSignupEmail = (subject, from) => {
  const enhancedSignupKeywords = [
    // Welcome messages
    'welcome', 'welcome to', 'joined', 'new member',
    
    // Verification
    'verify', 'verification', 'confirm', 'confirmation', 'activate', 'activation',
    
    // Account creation
    'signup', 'sign up', 'account', 'new account', 'account created', 'account setup',
    
    // Getting started
    'getting started', 'get started', 'onboard', 'onboarding', 'complete your',
    'finish setup', 'setup complete',
    
    // Subscriptions
    'subscription', 'subscribed', 'newsletter', 'updates', 'notifications',
    
    // Login/Access
    'login', 'logged in', 'access granted', 'password',
    
    // Email verification
    'verify your email', 'confirm your email', 'email verification',
    
    // Thank you messages
    'thanks', 'thank you', 'thanks for', 'thank you for',
    
    // Registration
    'registration', 'registered', 'register'
  ];

  const combined = (subject + ' ' + from).toLowerCase();
  return enhancedSignupKeywords.some(keyword => combined.includes(keyword));
};

/**
 * Enhanced sender name extraction with better domain mapping
 */
const extractSenderName = (from, domain) => {
  // Try to get name before email
  const nameMatch = from.match(/^([^<]+)</);
  if (nameMatch) {
    const name = nameMatch[1].trim().replace(/['"]/g, '');
    if (name && name !== 'no-reply' && name !== 'noreply' && !name.includes('@')) {
      return name;
    }
  }

  // Enhanced domain mapping
  const enhancedDomainMap = {
    // Social Media
    'facebook.com': 'Facebook',
    'instagram.com': 'Instagram',
    'twitter.com': 'Twitter',
    'x.com': 'X (Twitter)',
    'linkedin.com': 'LinkedIn',
    'tiktok.com': 'TikTok',
    'snapchat.com': 'Snapchat',
    'pinterest.com': 'Pinterest',
    'reddit.com': 'Reddit',
    
    // Tech Companies
    'google.com': 'Google',
    'microsoft.com': 'Microsoft',
    'apple.com': 'Apple',
    'amazon.com': 'Amazon',
    'netflix.com': 'Netflix',
    'spotify.com': 'Spotify',
    'youtube.com': 'YouTube',
    'github.com': 'GitHub',
    'gitlab.com': 'GitLab',
    'discord.com': 'Discord',
    'slack.com': 'Slack',
    'zoom.us': 'Zoom',
    'dropbox.com': 'Dropbox',
    
    // E-commerce
    'shopify.com': 'Shopify',
    'etsy.com': 'Etsy',
    'ebay.com': 'eBay',
    'paypal.com': 'PayPal',
    'stripe.com': 'Stripe',
    
    // Services
    'uber.com': 'Uber',
    'lyft.com': 'Lyft',
    'airbnb.com': 'Airbnb',
    'booking.com': 'Booking.com',
    
    // Education
    'coursera.org': 'Coursera',
    'udemy.com': 'Udemy',
    'skillshare.com': 'Skillshare',
    'duolingo.com': 'Duolingo',
    'khanacademy.org': 'Khan Academy',
    
    // News & Media
    'medium.com': 'Medium',
    'substack.com': 'Substack',
    'wordpress.com': 'WordPress',
    
    // Finance
    'robinhood.com': 'Robinhood',
    'coinbase.com': 'Coinbase',
    'mint.com': 'Mint',
    
    // Health & Fitness
    'fitbit.com': 'Fitbit',
    'myfitnesspal.com': 'MyFitnessPal',
    'strava.com': 'Strava'
  };

  if (enhancedDomainMap[domain]) {
    return enhancedDomainMap[domain];
  }

  // Handle subdomains
  const baseDomain = domain.split('.').slice(-2).join('.');
  if (enhancedDomainMap[baseDomain]) {
    return enhancedDomainMap[baseDomain];
  }

  // Generate name from domain
  const domainParts = domain.split('.');
  const mainPart = domainParts[0];
  
  // Handle common patterns
  if (mainPart.includes('-')) {
    return mainPart.split('-').map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join(' ');
  }

  return mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
};
      try {
        const { data: messageData } = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });

        const headers = messageData.payload.headers;
        const fromHeader = headers.find(h => h.name === 'From')?.value || '';
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';

        // Extract email and validate
        const email = extractEmail(fromHeader);
        if (!email.includes('@')) continue;

        const domain = email.split('@')[1];
        if (!domain || excludedDomains.includes(domain)) continue;

        // Check if it's a signup email
        if (!isSignupEmail(subject, fromHeader)) continue;

        // Extract platform name
        const platformName = extractSenderName(fromHeader, domain);

        // Store unique service (deduplicate by domain)
        if (!servicesMap.has(domain)) {
          servicesMap.set(domain, {
            platform: platformName,
            email: email,
            domain: domain,
            subject: subject.substring(0, 100), // Truncate long subjects
            date: date,
            lastSeen: new Date().toISOString(),
            suspicious: false, // Will be updated by AI analysis later
            unsubscribed: false,
            ignored: false
          });

          logger.debug(`Found signup service: ${platformName} (${domain})`);
        }

      } catch (err) {
        logger.warn(`Error processing message ${msg.id}`, {
          error: err.message,
          userId: user.id
        });
        continue;
      }
    }

    const results = Array.from(servicesMap.values());
    
    logger.info(`Signup email detection completed`, {
      userId: user.id,
      servicesFound: results.length,
      services: results.map(s => s.platform).join(', ')
    });

    return results;

  } catch (error) {
    logger.error('Signup email detection failed', {
      userId: user.id,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Incremental detection - only process new emails since last scan
 */
async function detectNewSignupEmails(user, lastScanDate) {
  try {
    logger.info('Starting incremental signup detection', {
      userId: user.id,
      lastScan: lastScanDate
    });

    // Simple implementation for now
    const gmail = getGmailClient(user.accessToken);
    const afterDate = Math.floor(new Date(lastScanDate).getTime() / 1000);
    
    const { data } = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['INBOX'],
      maxResults: 50,
      q: `after:${afterDate} (welcome OR verify OR signup OR "sign up" OR "account created" OR "thank you" OR confirm OR activate OR registration OR "getting started")`
    });

    const messages = data.messages || [];
    
    if (!messages.length) {
      logger.info('No new emails found since last scan', { userId: user.id });
      return [];
    }

    // Process new messages using the same logic as full detection
    const servicesMap = new Map();
    const excludedDomains = [
      'gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com',
      'icloud.com', 'aol.com', 'protonmail.com', 'live.com',
      'msn.com', 'ymail.com', 'mail.com'
    ];

    for (const msg of messages) {
      try {
        const { data: messageData } = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });

        const headers = messageData.payload.headers;
        const fromHeader = headers.find(h => h.name === 'From')?.value || '';
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';

        const email = extractEmail(fromHeader);
        if (!email.includes('@')) continue;

        const domain = email.split('@')[1];
        if (!domain || excludedDomains.includes(domain)) continue;

        if (!isSignupEmail(subject, fromHeader)) continue;

        const platformName = extractSenderName(fromHeader, domain);

        if (!servicesMap.has(domain)) {
          servicesMap.set(domain, {
            platform: platformName,
            email: email,
            domain: domain,
            subject: subject.substring(0, 100),
            date: date,
            lastSeen: new Date().toISOString(),
            suspicious: false,
            unsubscribed: false,
            ignored: false,
            isNew: true // Mark as new for UI highlighting
          });
        }

      } catch (err) {
        logger.warn(`Error processing new message`, {
          error: err.message,
          userId: user.id
        });
        continue;
      }
    }

    const newServices = Array.from(servicesMap.values());
    
    logger.info(`Incremental detection completed`, {
      userId: user.id,
      newServicesFound: newServices.length
    });

    return newServices;

  } catch (error) {
    logger.error('Incremental signup detection failed', {
      userId: user.id,
      error: error.message
    });
    throw error;
  }
}

module.exports = {
  detectSignupEmails,
  detectNewSignupEmails
};