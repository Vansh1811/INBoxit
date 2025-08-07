import React, { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import * as Sentry from '@sentry/react';
import './EnhancedErrorBoundary.css';

class EnhancedErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      isOnline: navigator.onLine
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Log to Sentry in production
    if (process.env.NODE_ENV === 'production') {
      Sentry.withScope((scope) => {
        scope.setExtras(errorInfo);
        Sentry.captureException(error);
      });
    }

    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));

    // Store error in localStorage for debugging
    const errorLog = {
      message: error.toString(),
      stack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    };
    
    try {
      const existingLogs = JSON.parse(localStorage.getItem('errorLogs') || '[]');
      existingLogs.push(errorLog);
      // Keep only last 10 errors
      if (existingLogs.length > 10) {
        existingLogs.shift();
      }
      localStorage.setItem('errorLogs', JSON.stringify(existingLogs));
    } catch (e) {
      console.error('Failed to store error log:', e);
    }
  }

  componentDidMount() {
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  handleOnline = () => {
    this.setState({ isOnline: true });
  };

  handleOffline = () => {
    this.setState({ isOnline: false });
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleReportError = () => {
    const { error, errorInfo } = this.state;
    const errorReport = {
      message: error?.toString(),
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    // Send error report to your backend
    fetch('/api/error-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorReport)
    }).catch(console.error);

    alert('Error report sent. Thank you for helping us improve!');
  };

  render() {
    const { hasError, error, isOnline, errorCount } = this.state;
    const { children, fallback } = this.props;

    if (!isOnline) {
      return (
        <div className="error-boundary offline">
          <div className="error-content">
            <AlertTriangle className="error-icon" />
            <h2>You're Offline</h2>
            <p>Please check your internet connection and try again.</p>
            <button onClick={this.handleReload} className="retry-button">
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        </div>
      );
    }

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Too many errors, suggest reload
      if (errorCount > 3) {
        return (
          <div className="error-boundary critical">
            <div className="error-content">
              <AlertTriangle className="error-icon critical" />
              <h2>Multiple Errors Detected</h2>
              <p>The application is experiencing issues. Please reload the page.</p>
              <button onClick={this.handleReload} className="reload-button">
                <RefreshCw className="w-4 h-4" />
                Reload Application
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="error-boundary">
          <div className="error-content">
            <AlertTriangle className="error-icon" />
            <h1>Oops! Something went wrong</h1>
            <p>We're sorry, but something unexpected happened.</p>
            
            {process.env.NODE_ENV === 'development' && error && (
              <details className="error-details">
                <summary>Error Details (Development Only)</summary>
                <pre>{error.toString()}</pre>
                <pre>{error.stack}</pre>
              </details>
            )}

            <div className="error-actions">
              <button onClick={this.handleReset} className="retry-button">
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <button onClick={this.handleGoHome} className="home-button">
                <Home className="w-4 h-4" />
                Go Home
              </button>
              <button onClick={this.handleReportError} className="report-button">
                Report Issue
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

export default EnhancedErrorBoundary;
