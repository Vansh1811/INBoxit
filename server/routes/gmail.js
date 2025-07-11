const express = require('express');
const router = express.Router();
const detectSignupEmails = require('../helpers/detectSignupEmails');
const testGmailConnection = require('../helpers/test');
const User = require('../models/User');

router.get('/all-signups', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Not logged in' });
  }

  // ✅ Check if tokens exist
  if (!req.user.accessToken) {
    return res.status(400).json({ error: 'Access token missing - please log in again' });
  }

  try {
    console.log('🔍 Detecting signup services...');
    const results = await detectSignupEmails({
      accessToken: req.user.accessToken,
      refreshToken: req.user.refreshToken
    });

    // Save to user's profile
    if (results.length > 0) {
      await User.findOneAndUpdate(
        { googleId: req.user.id },
        { 
          signupServices: results,
          lastScan: new Date()
        },
        { upsert: true }
      );
      console.log(`✅ Saved ${results.length} services to user profile`);
    }

    res.json({
      services: results,
      count: results.length,
      lastScan: new Date().toISOString(),
      status: 'success'
    });
  } catch (err) {
    console.error('Error fetching emails:', err.message);
    res.status(500).json({ 
      error: 'Failed to fetch signup emails',
      details: err.message 
    });
  }
});

// Get saved services from database
router.get('/saved-services', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Not logged in' });
  }

  try {
    const user = await User.findOne({ googleId: req.user.id });
    const services = user?.signupServices || [];
    
    res.json({
      services,
      count: services.length,
      lastScan: user?.lastScan,
      status: 'success'
    });
  } catch (err) {
    console.error('Error fetching saved services:', err.message);
    res.status(500).json({ error: 'Failed to fetch saved services' });
  }
});

// Update service status (unsubscribe/ignore)
router.post('/update-service', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Not logged in' });
  }

  const { domain, action } = req.body; // action: 'unsubscribe' or 'ignore'

  try {
    const user = await User.findOne({ googleId: req.user.id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const serviceIndex = user.signupServices.findIndex(s => s.domain === domain);
    if (serviceIndex === -1) {
      return res.status(404).json({ error: 'Service not found' });
    }

    if (action === 'unsubscribe') {
      user.signupServices[serviceIndex].unsubscribed = true;
    } else if (action === 'ignore') {
      user.signupServices[serviceIndex].ignored = true;
    }

    await user.save();
    
    res.json({
      message: `Service ${action}d successfully`,
      status: 'success'
    });
  } catch (err) {
    console.error('Error updating service:', err.message);
    res.status(500).json({ error: 'Failed to update service' });
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