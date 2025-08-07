require('dotenv').config();

const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('./config/passport');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const logger = require('./utils/logger');
const { errorHandler, notFoundHandler, requestTimeout } = require('./middleware/errorHandler');
const {
  apiLimiter,
  gmailLimiter,
  authLimiter,
  getRateLimitStats,
  shutdownRateLimit
} = require('./middleware/rateLimiter');
const { cache } = require('./utils/cache');

const authRoutes = require('./routes/auth');
const gmailRoutes = require('./routes/gmail');
const servicesRoutes = require('./routes/services');

const app = express();

// Security and performance middleware
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://accounts.google.com", "https://gmail.googleapis.com"]
    }
  }
}));

app.use(compression());

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(requestTimeout(30000));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(session({
  name: 'inboxit.sid',
  secret: process.env.SESSION_SECRET || 'defaultsecret',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    touchAfter: 24 * 3600,
    collectionName: 'sessions',
    autoRemove: 'native'
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: req.user?.id || 'anonymous'
    });
  });
  next();
});

// Health check route
app.get('/health', async (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    memoryUsage: process.memoryUsage(),
    database: {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name
    },
    cache: cache.getStats(),
    rateLimiting: await getRateLimitStats().catch(() => ({ error: 'Stats unavailable' }))
  };

  if (mongoose.connection.readyState !== 1) {
    healthCheck.status = 'unhealthy';
    return res.status(503).json(healthCheck);
  }

  res.json(healthCheck);
});

// Apply rate limiters
app.use('/auth', authLimiter);
app.use('/gmail', gmailLimiter);
app.use('/', apiLimiter);

// Routes
app.use('/auth', authRoutes);
app.use('/gmail', gmailRoutes);
app.use('/', servicesRoutes);

// ✅ Debug route to check user session state
app.get('/debug-user', (req, res) => {
  res.json({
    isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
    user: req.user || null,
    sessionCookie: req.headers.cookie || 'No cookie set'
  });
});

// Test connection route
app.get('/test-connection', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please log in to test your connection',
        timestamp: new Date().toISOString()
      });
    }

    const services = [];
    const diagnostics = {
      userId: req.user.id,
      email: req.user.email,
      hasAccessToken: !!req.user.accessToken,
      hasRefreshToken: !!req.user.refreshToken,
      tokenExpiry: req.user.tokenExpiry
    };

    if (req.user.accessToken) {
      services.push({
        name: 'Gmail',
        status: 'connected',
        lastConnected: req.user.tokenExpiry
      });
    }

    logger.info('Connection test completed', {
      userId: req.user.id,
      email: req.user.email,
      servicesCount: services.length
    });

    res.json({
      services,
      count: services.length,
      status: 'success',
      message: `Found ${services.length} connected services`,
      diagnostics: process.env.NODE_ENV === 'development' ? diagnostics : undefined,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Connection test failed', {
      userId: req.user?.id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      error: 'Connection test failed',
      message: 'Unable to test service connections',
      timestamp: new Date().toISOString()
    });
  }
});

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully...`);
  try {
    await shutdownRateLimit();
    await mongoose.connection.close();
    cache.clear();
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', {
    reason: reason.toString(),
    stack: reason.stack
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });
  gracefulShutdown('uncaughtException');
});

// Connect to MongoDB
const connectToMongoDB = async (retryCount = 0) => {
  const maxRetries = 5;
  const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 30000);

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      autoIndex: process.env.NODE_ENV !== 'production'
    });

    logger.info('✅ MongoDB connected successfully', {
      host: mongoose.connection.host,
      name: mongoose.connection.name
    });

  } catch (error) {
    logger.error(`❌ MongoDB connection attempt ${retryCount + 1} failed`, {
      error: error.message,
      retryCount: retryCount + 1,
      maxRetries
    });

    if (retryCount < maxRetries) {
      logger.info(`Retrying MongoDB connection in ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return connectToMongoDB(retryCount + 1);
    } else {
      logger.error('❌ Max MongoDB connection retries exceeded');
      process.exit(1);
    }
  }
};

// Start server
const startServer = async () => {
  try {
    await connectToMongoDB();

    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      logger.info('🚀 Server started successfully', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        timestamp: new Date().toISOString()
      });
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${PORT} is already in use`);
      } else {
        logger.error('❌ Server error', { error: error.message });
      }
      process.exit(1);
    });

  } catch (error) {
    logger.error('❌ Server startup failed', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

startServer();

module.exports = app;
