// routes/platforms.js - New file to create
const express = require('express');
const { detectPlatforms, DetectedService } = require('../models/DetectedService');
const { ensureAuthenticated } = require('../middleware/auth');

const router = express.Router();

// Scan and detect platforms
router.get('/scan', ensureAuthenticated, async (req, res) => {
  try {
    console.log('🔍 Scanning user emails for platforms...');
    const platforms = await detectPlatforms(req.user);
    
    res.json({
      message: 'Scan completed',
      detected: platforms,
      count: platforms.length
    });

  } catch (error) {
    console.error('Scan failed:', error);
    res.status(500).json({ error: 'Failed to scan emails' });
  }
});

// Get detected platforms
router.get('/list', ensureAuthenticated, async (req, res) => {
  try {
    const platforms = await DetectedService.find({ user: req.user._id });
    
    res.json({
      platforms: platforms.map(p => ({
        platform: p.platform,
        sender: p.sender,
        date: p.date
      })),
      count: platforms.length
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to get platforms' });
  }
});

module.exports = router;