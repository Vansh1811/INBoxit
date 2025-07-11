// backend/helpers/test.js
const { google } = require('googleapis');

async function test(tokens) {
  if (!tokens?.accessToken) {
    throw new Error('Access token missing');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL
  );

  // ✅ Set credentials - refreshToken is optional
  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    ...(tokens.refreshToken && { refresh_token: tokens.refreshToken }),
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const profile = await gmail.users.getProfile({ userId: 'me' });

  return {
    email: profile.data.emailAddress,
    messagesTotal: profile.data.messagesTotal,
    threadsTotal: profile.data.threadsTotal,
  };
}

module.exports = test;