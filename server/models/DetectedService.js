const mongoose = require('mongoose');
const getGmailClient = require('../config/gmail');

const DetectedServiceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  platform: String,
  sender: String,
  date: String,
});

DetectedServiceSchema.index({ user: 1, platform: 1 }, { unique: true });

const DetectedService = mongoose.model('DetectedService', DetectedServiceSchema);

const platformPatterns = {
  'Netflix': ['netflix.com', 'welcome to netflix'],
  'Spotify': ['spotify.com', 'welcome to spotify'],
  'Amazon': ['amazon.com', 'welcome to amazon'],
  'Facebook': ['facebook.com', 'facebook security'],
  'Instagram': ['instagram.com', 'welcome to instagram'],
  'LinkedIn': ['linkedin.com', 'welcome to linkedin'],
  'GitHub': ['github.com', 'welcome to github'],
  'Discord': ['discord.com', 'welcome to discord'],
};

async function detectPlatforms(user) {
  try {
    const gmail = getGmailClient(user.accessToken);
    const detectedPlatforms = [];
    const seen = new Set();

    let nextPageToken = null;
    let messageCount = 0;

    for (let i = 0; i < 10; i++) { // ⬅️ Scan up to 10 pages = ~1000 messages
      const res = await gmail.users.messages.list({
        userId: 'me',
        q: 'welcome OR "confirm your" OR "verify your" OR signup OR "get started" OR "new account" after:2021',
        maxResults: 100,
        pageToken: nextPageToken,
      });

      const messages = res.data.messages || [];
      nextPageToken = res.data.nextPageToken;

      for (const msg of messages) {
        const full = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
        });

        const platform = analyzePlatform(full.data);

        if (platform && !seen.has(platform.name)) {
          const exists = await DetectedService.findOne({
            user: user._id,
            platform: platform.name,
          });

          if (!exists) {
            await new DetectedService({
              user: user._id,
              platform: platform.name,
              sender: platform.sender,
              date: platform.date,
            }).save();
          }

          seen.add(platform.name);
          detectedPlatforms.push(platform.name);
        }

        messageCount++;
        if (messageCount >= 1000) break; // hard safety cap
      }

      if (!nextPageToken || messageCount >= 1000) break;
    }

    return [...seen];
  } catch (err) {
    console.error('Detection error:', err);
    return [];
  }
}

function analyzePlatform(emailData) {
  const headers = emailData.payload.headers;
  const fromHeader = headers.find(h => h.name.toLowerCase() === 'from');
  const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject');
  const dateHeader = headers.find(h => h.name.toLowerCase() === 'date');

  if (!fromHeader) return null;

  const raw = fromHeader.value;
  const subject = subjectHeader?.value || '';
  const combined = (raw + ' ' + subject).toLowerCase();
  const email = raw.match(/<(.+?)>/)?.[1] || raw;
  const domain = email.split('@')[1]?.toLowerCase() || 'unknown.com';

  // Try matching known patterns
  for (const [platform, patterns] of Object.entries(platformPatterns)) {
    for (const pattern of patterns) {
      if (combined.includes(pattern)) {
        return {
          name: platform,
          sender: domain,
          date: dateHeader?.value || 'Unknown',
        };
      }
    }
  }

  // Normalize based on known domains
  const domainMap = {
    'github.com': 'GitHub',
    'facebook.com': 'Facebook',
    'google.com': 'Google',
    'amazon.com': 'Amazon',
    'coursera.org': 'Coursera',
    'geeksforgeeks.org': 'GeeksforGeeks',
    'hdfcbank.net': 'HDFC Bank',
    'kotak.com': 'Kotak Bank',
    'swiggy.in': 'Swiggy',
    'ajio.in': 'AJIO',
    '1mg.com': 'Tata 1mg',
    'email.viz.com': 'VIZ Media',
    'team.mongodb.com': 'MongoDB',
    'mongodb.com': 'MongoDB',
    'youtube.com': 'YouTube',
    'udemybusiness.udemy.com': 'Udemy',
    'mail.internshala.com': 'Internshala',
    'updates.internshala.com': 'Internshala',
    'hi.wellfound.com': 'Wellfound',
    'gmail.com': 'Gmail',
    'lovable.dev': 'Lovable',
    'jobcontentment.com': 'JobContentment',
  };

  let platformName = domainMap[domain];
  if (!platformName) {
    if (domain.endsWith('linkedin.com')) platformName = 'LinkedIn';
    else platformName = capitalizeFirstLetter(domain.split('.')[0]);
  }

  return {
    name: platformName,
    sender: domain,
    date: dateHeader?.value || 'Unknown',
  };
}

function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = { DetectedService, detectPlatforms };
