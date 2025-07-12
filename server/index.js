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

// Trust proxy for rate limiting
app.set('trust proxy', 1);

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
}));

// Apply rate limiting - commented out for now
// app.use('/api', apiLimiter);

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

// Commented out platform detection for now
// app.get('/detect-platforms', async (req, res) => {
//   // ... platform detection code
// });

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

// Add basic error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

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