const { google } = require('googleapis');

const extractEmail = (from) => {
  const match = from.match(/<(.+)>/);
  return (match ? match[1] : from).toLowerCase();
};

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

async function fetchEmails(tokens) {
  if (!tokens.accessToken) throw new Error('Access token missing');

  const gmail = getGmailClient(tokens);
  const servicesMap = new Map();

  console.log('🔍 Starting email fetch...');

  const { data } = await gmail.users.messages.list({
    userId: 'me',
    labelIds: ['INBOX'],
    maxResults: 50,
    q: 'welcome OR verify OR signup OR account OR "thank you" OR confirm OR activate OR registration OR "getting started"'
  });

  const messages = data.messages || [];
  console.log(`📧 Found ${messages.length} potential signup emails`);

  if (!messages.length) {
    console.log('⚠️ No signup emails found with search query, trying general inbox...');
    const fallbackData = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['INBOX'],
      maxResults: 100
    });

    const fallbackMessages = fallbackData.messages || [];
    console.log(`📧 Fallback search found ${fallbackMessages.length} total emails`);

    if (!fallbackMessages.length) return [];
    messages.push(...fallbackMessages);
  }

  const excludedDomains = [
    'gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com',
    'icloud.com', 'aol.com', 'protonmail.com'
  ];

  const signupKeywords = [
    'welcome', 'verify', 'signup', 'sign up', 'account', 'thanks', 'thank you',
    'confirm', 'confirmation', 'logged', 'activate', 'activation', 'registration',
    'created', 'getting started', 'get started', 'onboard', 'complete your',
    'verify your email', 'confirm your email', 'welcome to', 'joined',
    'subscription', 'subscribed', 'newsletter', 'updates'
  ];

  for (const msg of messages) {
    try {
      const { data } = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });

      const headers = data.payload.headers;
      const fromHeader = headers.find(h => h.name === 'From')?.value || '';
      const from = extractEmail(fromHeader);
      const subject = (headers.find(h => h.name === 'Subject')?.value || '').toLowerCase();
      const date = headers.find(h => h.name === 'Date')?.value || '';

      const isSignup = signupKeywords.some(word =>
        subject.includes(word) || fromHeader.toLowerCase().includes(word)
      );

      if (!from.includes('@')) continue;

      const domain = from.split('@')[1];

      // ❌ Skip personal email addresses
      if (
        !isSignup ||
        !domain ||
        excludedDomains.includes(domain) ||
        domain.split('.').length < 2
      ) {
        continue;
      }

      const platformName = domain.split('.')[0];
      const displayName = platformName.charAt(0).toUpperCase() + platformName.slice(1);

      servicesMap.set(domain, {
        platform: displayName,
        domain: domain,
        sender: from,
        subject: subject,
        date: date,
        lastSeen: new Date().toISOString()
      });

      console.log(`✅ Found signup service: ${displayName} (${domain})`);
    } catch (err) {
      console.error(`❌ Error processing message ${msg.id}:`, err.message);
      continue;
    }
  }

  const results = Array.from(servicesMap.values());
  console.log(`🎯 Total services detected: ${results.length}`);
  console.log('📋 Services found:', results.map(s => s.platform).join(', '));

  return results;
}

module.exports = fetchEmails;
