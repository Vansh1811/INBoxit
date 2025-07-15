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
app.set('trust proxy', 1); // For rate limiting

// --- MIDDLEWARE ---
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());
app.use('/api', apiLimiter);

// --- MONGOOSE CONNECTION ---
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 10000, // Optional: faster failure
  autoIndex: true
})
  .then(() => logger.info('✅ MongoDB connected successfully'))
  .catch(err => {
    logger.error('❌ MongoDB connection error:', { error: err.message });
    process.exit(1);
  });

// --- SESSION CONFIG ---
app.use(session({
  secret: process.env.SESSION_SECRET || 'defaultsecret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    touchAfter: 24 * 3600
  }),
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// --- ROUTES ---
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

// --- DETECT PLATFORMS ---
app.get('/detect-platforms', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Please login first' });

    logger.info('Starting platform detection', { userId: req.user.id });

    const platforms = await detectPlatforms(req.user);
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
    res.status(500).json({ error: 'Failed to detect platforms' });
  }
});

// --- FETCH SAVED PLATFORMS ---
app.get('/my-platforms', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Please login first' });

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

// --- GMAIL CONNECTION TEST ---
app.get('/test-connection', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'User not authenticated' });

    const services = req.user.accessToken ? ['Gmail'] : [];

    res.json({
      services,
      status: 'success',
      message: `Found ${services.length} connected services`
    });
  } catch (error) {
    logger.error('Error fetching services', {
      userId: req.user?.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// --- ERROR HANDLING ---
app.use(notFoundHandler);
app.use(errorHandler);

// --- GRACEFUL SHUTDOWN ---
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

// --- START SERVER ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info('🚀 Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });
});
