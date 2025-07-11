const express = require('express');
const router = express.Router();
const detectSignupEmails = require('../helpers/fetchEmails');
const testGmailConnection = require('../helpers/test');

router.get('/all-signups', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Not logged in' });
  }

  // ✅ Check if tokens exist
  if (!req.user.accessToken) {
    return res.status(400).json({ error: 'Access token missing - please log in again' });
  }

  try {
    // ✅ Pass tokens object with correct structure
    const results = await detectSignupEmails({
      accessToken: req.user.accessToken,
      refreshToken: req.user.refreshToken
    });

    res.json(results);
  } catch (err) {
    console.error('Error fetching emails:', err.message);
    res.status(500).json({ error: 'Failed to fetch signup emails' });
  }
});

router.get('/test-connection', async (req, res) => {
  console.log('🔍 /test-connection called');
  console.log('🔍 Is authenticated:', req.isAuthenticated());
  console.log('🔍 User object exists:', !!req.user);
  console.log('🔍 Access token exists:', !!req.user?.accessToken);
  
  if (!req.isAuthenticated()) {
    console.log('❌ Not authenticated');
    return res.status(401).json({ message: 'Not logged in' });
  }

  // ✅ Check if tokens exist
  if (!req.user.accessToken) {
    console.log('❌ Access token missing from user object');
    return res.status(400).json({ error: 'Access token missing - please log in again' });
  }

  try {
    console.log('✅ Calling testGmailConnection with tokens...');
    // ✅ Pass tokens object with correct structure
    const result = await testGmailConnection({
      accessToken: req.user.accessToken,
      refreshToken: req.user.refreshToken
    });

    console.log('✅ Gmail test successful:', result);
    res.json(result);
  } catch (err) {
    console.error('❌ Gmail test failed:', err.message);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;