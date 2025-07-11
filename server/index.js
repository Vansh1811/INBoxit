const express = require('express');
const session = require('express-session');
const passport = require('./config/passport');
const authRoutes = require('./routes/auth');
const gmailRoutes = require('./routes/gmail');
const mongoose = require('mongoose');
const cors = require('cors');
const servicesRoutes = require('./routes/services');
const { detectPlatforms, DetectedService } = require('./models/DetectedService');

require('dotenv').config();

const app = express();

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());

app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true
  }
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

app.use('/auth', authRoutes);
app.use('/gmail', gmailRoutes);
app.use('/', servicesRoutes);

// Updated route to detect platforms
app.get('/detect-platforms', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Please login first' });
    }

    console.log('Starting platform detection...');
    const platforms = await detectPlatforms(req.user);
    
    // Get saved platforms from database
    const savedPlatforms = await DetectedService.find({ user: req.user._id });
    
    res.json({
      detected: platforms,
      saved: savedPlatforms,
      count: savedPlatforms.length,
      status: 'success'
    });

  } catch (error) {
    console.error('Detection failed:', error);
    res.status(500).json({ 
      error: 'Failed to detect platforms',
      status: 'error' 
    });
  }
});

// Get user's connected platforms
app.get('/my-platforms', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Please login first' });
    }

    const platforms = await DetectedService.find({ user: req.user._id });
    res.json({
      platforms,
      count: platforms.length,
      status: 'success'
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch platforms' });
  }
});

app.get('/test-connection', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const services = [];
    
    if (req.user.accessToken) {
      services.push('Gmail');
    }
    
    res.json({ 
      services: services,
      status: 'success',
      message: `Found ${services.length} connected services`
    });
    
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ 
      error: 'Failed to fetch services',
      status: 'error' 
    });
  }
});

app.listen(5000, () => {
  console.log('🚀 Server listening on http://localhost:5000');
});