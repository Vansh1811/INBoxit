const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

class Logger {
  constructor() {
    this.logFile = path.join(logsDir, 'app.log');
    this.errorFile = path.join(logsDir, 'error.log');
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
    };
    return JSON.stringify(logEntry) + '\n';
  }

  writeToFile(filename, content) {
    try {
      fs.appendFileSync(filename, content);
    } catch (err) {
      console.error('Failed to write to log file:', err);
    }
  }

  log(level, message, meta = {}) {
    const formattedMessage = this.formatMessage(level, message, meta);
    
    // Always log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${level.toUpperCase()}] ${message}`, meta);
    }

    // Write to appropriate log file
    this.writeToFile(this.logFile, formattedMessage);
    
    if (level === 'error') {
      this.writeToFile(this.errorFile, formattedMessage);
    }
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, meta);
    }
  }

  // Clean old logs (keep last 7 days)
  cleanOldLogs() {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    const now = Date.now();

    [this.logFile, this.errorFile].forEach(file => {
      try {
        const stats = fs.statSync(file);
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(file);
          this.info(`Cleaned old log file: ${file}`);
        }
      } catch (err) {
        // File doesn't exist or can't be accessed
      }
    });
  }
}

const logger = new Logger();

// Clean logs on startup
logger.cleanOldLogs();

// Clean logs daily
setInterval(() => {
  logger.cleanOldLogs();
}, 24 * 60 * 60 * 1000);

module.exports = logger;