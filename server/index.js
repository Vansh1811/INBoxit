const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('./config/passport');
const authRoutes = require('./routes/auth');
const gmailRoutes = require('./routes/gmail');
const mongoose = require('mongoose');
const cors = require('cors');
const servicesRoutes = require('./routes/services');
// const { detectPlatforms, DetectedService } = require('./models/DetectedService');
// const { apiLimiter } = require('./middleware/rateLimiter');
// const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1); // For rate limiting

// --- MIDDLEWARE ---
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// Apply rate limiting - commented out for now
// app.use('/api', apiLimiter);

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

// Commented out platform detection for now
// app.get('/detect-platforms', async (req, res) => {
//   // ... platform detection code
// });

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

// Add basic error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

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
