const fs = require('fs');
const path = require('path');

// Enhanced log directory management
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

class Logger {
  constructor() {
    this.logFile = path.join(logsDir, 'app.log');
    this.errorFile = path.join(logsDir, 'error.log');
    this.accessFile = path.join(logsDir, 'access.log');
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.maxFiles = 5;
    
    // Performance tracking
    this.stats = {
      totalLogs: 0,
      errorLogs: 0,
      warningLogs: 0,
      infoLogs: 0,
      debugLogs: 0
    };
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      pid: process.pid,
      hostname: require('os').hostname(),
      ...meta
    };

    // Add stack trace for errors
    if (level === 'error' && meta.stack) {
      logEntry.stack = meta.stack;
    }

    return JSON.stringify(logEntry) + '\n';
  }

  rotateLogFile(filename) {
    try {
      if (!fs.existsSync(filename)) return;

      const stats = fs.statSync(filename);
      if (stats.size > this.maxFileSize) {
        const ext = path.extname(filename);
        const base = filename.replace(ext, '');
        
        // Rotate existing files
        for (let i = this.maxFiles - 1; i > 0; i--) {
          const oldFile = `${base}.${i}${ext}`;
          const newFile = `${base}.${i + 1}${ext}`;
          
          if (fs.existsSync(oldFile)) {
            if (i === this.maxFiles - 1) {
              fs.unlinkSync(oldFile); // Delete oldest
            } else {
              fs.renameSync(oldFile, newFile);
            }
          }
        }
        
        // Move current file to .1
        fs.renameSync(filename, `${base}.1${ext}`);
        
        this.info(`Log file rotated: ${filename}`);
      }
    } catch (err) {
      console.error('Log rotation failed:', err);
    }
  }

  writeToFile(filename, content) {
    try {
      // Rotate if needed
      this.rotateLogFile(filename);
      
      fs.appendFileSync(filename, content, { encoding: 'utf8' });
    } catch (err) {
      console.error('Failed to write to log file:', err);
      
      // Try to create directory if it doesn't exist
      try {
        fs.mkdirSync(path.dirname(filename), { recursive: true });
        fs.appendFileSync(filename, content, { encoding: 'utf8' });
      } catch (retryErr) {
        console.error('Log write retry failed:', retryErr);
      }
    }
  }

  log(level, message, meta = {}) {
    const formattedMessage = this.formatMessage(level, message, meta);
    
    // Update stats
    this.stats.totalLogs++;
    this.stats[`${level}Logs`] = (this.stats[`${level}Logs`] || 0) + 1;

    // Console output with colors in development
    if (process.env.NODE_ENV === 'development') {
      const colors = {
        error: '\x1b[31m', // Red
        warn: '\x1b[33m',  // Yellow
        info: '\x1b[36m',  // Cyan
        debug: '\x1b[35m'  // Magenta
      };
      
      const reset = '\x1b[0m';
      const color = colors[level] || '';
      
      console.log(`${color}[${level.toUpperCase()}]${reset} ${message}`, 
        Object.keys(meta).length > 0 ? meta : '');
    }

    // Write to files
    this.writeToFile(this.logFile, formattedMessage);
    
    if (level === 'error') {
      this.writeToFile(this.errorFile, formattedMessage);
    }

    // Critical errors should also go to console in production
    if (level === 'error' && process.env.NODE_ENV === 'production') {
      console.error(`[CRITICAL] ${message}`, meta);
    }
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  error(message, meta = {}) {
    // Ensure error stack traces are captured
    if (meta instanceof Error) {
      const errorMeta = {
        message: meta.message,
        stack: meta.stack,
        name: meta.name
      };
      this.log('error', message, errorMeta);
    } else {
      this.log('error', message, meta);
    }
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      this.log('debug', message, meta);
    }
  }

  // Access logging for HTTP requests
  access(req, res, responseTime) {
    const accessLog = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id || 'anonymous',
      contentLength: res.get('Content-Length') || '0'
    };

    const formattedMessage = this.formatMessage('access', 'HTTP Request', accessLog);
    this.writeToFile(this.accessFile, formattedMessage);
  }

  // Performance monitoring
  performance(label, startTime, meta = {}) {
    const duration = Date.now() - startTime;
    this.info(`Performance: ${label}`, {
      duration: `${duration}ms`,
      ...meta
    });
  }

  // Get logger statistics
  getStats() {
    return {
      ...this.stats,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      logFiles: {
        app: this.getFileSize(this.logFile),
        error: this.getFileSize(this.errorFile),
        access: this.getFileSize(this.accessFile)
      }
    };
  }

  getFileSize(filename) {
    try {
      const stats = fs.statSync(filename);
      return {
        size: stats.size,
        sizeHuman: this.formatBytes(stats.size),
        modified: stats.mtime
      };
    } catch (err) {
      return { size: 0, sizeHuman: '0 B', modified: null };
    }
  }

  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // Enhanced log cleanup with better retention
  cleanOldLogs() {
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    const now = Date.now();

    const logFiles = [
      this.logFile,
      this.errorFile,
      this.accessFile
    ];

    // Also check for rotated files
    logFiles.forEach(baseFile => {
      const ext = path.extname(baseFile);
      const base = baseFile.replace(ext, '');
      
      for (let i = 1; i <= this.maxFiles; i++) {
        const rotatedFile = `${base}.${i}${ext}`;
        logFiles.push(rotatedFile);
      }
    });

    let cleanedCount = 0;
    logFiles.forEach(file => {
      try {
        if (fs.existsSync(file)) {
          const stats = fs.statSync(file);
          if (now - stats.mtime.getTime() > maxAge) {
            fs.unlinkSync(file);
            cleanedCount++;
          }
        }
      } catch (err) {
        // Ignore errors for non-existent files
      }
    });

    if (cleanedCount > 0) {
      this.info(`Cleaned ${cleanedCount} old log files`);
    }
  }

  // Manual log file archiving
  archiveLogs(archivePath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveDir = path.join(archivePath || logsDir, `archive-${timestamp}`);
    
    try {
      fs.mkdirSync(archiveDir, { recursive: true });
      
      const filesToArchive = [this.logFile, this.errorFile, this.accessFile];
      let archivedCount = 0;
      
      filesToArchive.forEach(file => {
        if (fs.existsSync(file)) {
          const filename = path.basename(file);
          const destPath = path.join(archiveDir, filename);
          fs.copyFileSync(file, destPath);
          fs.truncateSync(file, 0); // Clear original file
          archivedCount++;
        }
      });
       
      this.info(`Archived ${archivedCount} log files to ${archiveDir}`);
      return archiveDir;
      
    } catch (err) {
      this.error('Log archiving failed', { error: err.message });
      return null;
    }
  }
}

const logger = new Logger();

// Initialize cleanup interval
logger.cleanOldLogs();
setInterval(() => {
  logger.cleanOldLogs();
}, 24 * 60 * 60 * 1000); // Daily cleanup

module.exports = logger;
