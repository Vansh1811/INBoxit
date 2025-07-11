const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('./config/passport');
const authRoutes = require('./routes/auth');
const gmailRoutes = require('./routes/gmail');
const mongoose = require('mongoose');
const cors = require('cors');
const servicesRoutes = require('./routes/services');
const { detectPlatforms, DetectedService } = require('./models/DetectedService');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

require('dotenv').config();

const app = express();

// Trust proxy for rate limiting
app.set('trust proxy', 1);

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
}));

// Apply rate limiting
app.use('/api', apiLimiter);

app.use(express.json());

// Connect to MongoDB first
mongoose.connect(process.env.MONGO_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
})
.then(() => {
  logger.info('MongoDB connected successfully');
})
.catch(err => {
  logger.error('MongoDB connection error:', { error: err.message });
  process.exit(1);
});

app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    touchAfter: 24 * 3600 // lazy session update
  }),
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.use('/auth', authRoutes);
app.use('/gmail', gmailRoutes);
app.use('/', servicesRoutes);

// Updated route to detect platforms
app.get('/detect-platforms', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Please login first' });
    }

    logger.info('Starting platform detection', { userId: req.user.id });
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
    logger.error('Platform detection failed', {
      userId: req.user?.id,
      error: error.message
    });
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
    logger.error('Error fetching services', {
      userId: req.user?.id,
      error: error.message
    });
    res.status(500).json({ 
      error: 'Failed to fetch services',
      status: 'error' 
    });
  }
});

// Add error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  mongoose.connection.close(() => {
    logger.info('MongoDB connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  mongoose.connection.close(() => {
    logger.info('MongoDB connection closed');
    process.exit(0);
  });
});

app.listen(5000, () => {
  logger.info('Server started successfully', {
    port: 5000,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });
});