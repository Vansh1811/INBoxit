// -----------------------------------------------------
// 📧 Gmail API Setup — creates an authenticated client
// -----------------------------------------------------

// Grab Google's official API toolkit
const { google } = require('googleapis');

// 🔧 This function builds a Gmail client that's ready to go
function getGmailClient(accessToken) {
  // Step 1: Create a fresh OAuth2 client (Google requires this)
  const oauth2Client = new google.auth.OAuth2();

  // Step 2: Plug in the access token we got during Google login
  oauth2Client.setCredentials({
    access_token: accessToken, // like a temporary Gmail key
  });

  // Step 3: Return a Gmail API client that's authorized and ready
  return google.gmail({
    version: 'v1',
    auth: oauth2Client,
  });
}

// 📦 Export the function so other files can use this
module.exports = getGmailClient;
