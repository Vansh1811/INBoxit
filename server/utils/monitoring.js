const Sentry = require('@sentry/node');
const { ProfilingIntegration } = require('@sentry/profiling-node');

// Initialize Sentry for error tracking and performance monitoring
const initMonitoring = (app) => {
  if (process.env.NODE_ENV === 'production') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app }),
        new ProfilingIntegration(),
      ],
      tracesSampleRate: 1.0,
      profilesSampleRate: 1.0,
      environment: process.env.NODE_ENV,
    });

    // Request handler creates a separate execution context
    app.use(Sentry.Handlers.requestHandler());
    
    // TracingHandler creates a trace for every incoming request
    app.use(Sentry.Handlers.tracingHandler());
  }
};

// Custom metrics tracking
class MetricsTracker {
  constructor() {
    this.metrics = {
      emailsScanned: 0,
      emailsDeleted: 0,
      platformsDiscovered: 0,
      apiCalls: 0,
      errors: 0,
      userSignups: 0,
      activeUsers: new Set(),
    };
  }

  track(metric, value = 1, userId = null) {
    if (this.metrics[metric] !== undefined) {
      this.metrics[metric] += value;
    }
    
    if (userId && metric === 'activeUsers') {
      this.metrics.activeUsers.add(userId);
    }

    // Send to analytics service (e.g., Mixpanel, Amplitude)
    this.sendToAnalytics(metric, value, userId);
  }

  sendToAnalytics(metric, value, userId) {
    // Implement your analytics service integration here
    console.log(`Metric: ${metric}, Value: ${value}, User: ${userId}`);
  }

  getMetrics() {
    return {
      ...this.metrics,
      activeUsers: this.metrics.activeUsers.size,
    };
  }

  reset() {
    this.metrics = {
      emailsScanned: 0,
      emailsDeleted: 0,
      platformsDiscovered: 0,
      apiCalls: 0,
      errors: 0,
      userSignups: 0,
      activeUsers: new Set(),
    };
  }
}

// Performance monitoring
class PerformanceMonitor {
  constructor() {
    this.timers = new Map();
  }

  startTimer(label) {
    this.timers.set(label, Date.now());
  }

  endTimer(label) {
    const startTime = this.timers.get(label);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.timers.delete(label);
      
      // Log slow operations
      if (duration > 1000) {
        console.warn(`Slow operation detected: ${label} took ${duration}ms`);
        Sentry.captureMessage(`Slow operation: ${label}`, {
          level: 'warning',
          extra: { duration },
        });
      }
      
      return duration;
    }
    return null;
  }
}

// Health check endpoint data
const getHealthStatus = () => {
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(uptime / 60)} minutes`,
    memory: {
      used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
    },
    node: {
      version: process.version,
      env: process.env.NODE_ENV,
    },
  };
};

module.exports = {
  initMonitoring,
  MetricsTracker: new MetricsTracker(),
  PerformanceMonitor: new PerformanceMonitor(),
  getHealthStatus,
  Sentry,
};
