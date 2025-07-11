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
 * Create Gmail client with proper authentication
 */
function getGmailClient({ accessToken, refreshToken }) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL
  );

  client.setCredentials({ 
    access_token: accessToken, 
    ...(refreshToken && { refresh_token: refreshToken })
  });

  return google.gmail({ version: 'v1', auth: client });
}

/**
 * Main function to detect signup emails and extract platform services
 */
async function detectSignupEmails(tokens) {
  if (!tokens.accessToken) {
    throw new Error('Access token missing');
  }

  const gmail = getGmailClient(tokens);
  const servicesMap = new Map();

  console.log('🔍 Starting signup email detection...');

  // Search for signup-related emails
  const { data } = await gmail.users.messages.list({
    userId: 'me',
    labelIds: ['INBOX'],
    maxResults: 200,
    q: 'welcome OR verify OR signup OR "sign up" OR "account created" OR "thank you" OR confirm OR activate OR registration OR "getting started" OR "new account" after:2022/01/01'
  });

  const messages = data.messages || [];
  console.log(`📧 Found ${messages.length} potential signup emails`);

  if (!messages.length) {
    console.log('⚠️ No signup emails found');
    return [];
  }

  // Domains to exclude (personal email providers)
  const excludedDomains = [
    'gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com',
    'icloud.com', 'aol.com', 'protonmail.com', 'live.com',
    'msn.com', 'ymail.com', 'mail.com'
  ];

  // Process each message
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
          suspicious: false // Will be updated by GPT analysis later
        });

        console.log(`✅ Found service: ${platformName} (${domain})`);
      }

    } catch (err) {
      console.error(`❌ Error processing message ${msg.id}:`, err.message);
      continue;
    }
  }

  const results = Array.from(servicesMap.values());
  console.log(`🎯 Total unique services detected: ${results.length}`);
  console.log('📋 Services found:', results.map(s => s.platform).join(', '));

  return results;
}

module.exports = detectSignupEmails;