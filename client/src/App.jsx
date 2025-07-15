import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';
import ErrorBoundary from './components/ErrorBoundary';
import './components/ErrorBoundary.css';
import Header from './components/Header';
import LoginSection from './components/LoginSection';
import ConnectionStatus from './components/ConnectionStatus';
import Dashboard from './pages/Dashboard';
import LoadingSpinner from './components/ui/LoadingSpinner';
import { ToastContainer } from './components/ui/Toast';
import apiService from './services/api';

function App() {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load dark mode preference from localStorage
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode) {
      setDarkMode(JSON.parse(savedDarkMode));
    }
  }, []);

  // Save dark mode preference to localStorage
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const checkLoginStatus = useCallback(async () => {
    try {
      const data = await apiService.checkLoginStatus();
      const userObj = {
        ...data,
        name: data.displayName || data.name,
        email: data.emails?.[0]?.value || data.email,
      };
      setUser(userObj);
      testGmailConnection();
    } catch (err) {
      setUser(null);
      console.error('Login check error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkLoginStatus();
  }, [checkLoginStatus]);

  const testGmailConnection = async () => {
    try {
      const data = await apiService.testConnection();
      setStatus({
        status: 'success',
        services: data.services || [],
        message: data.message,
      });
    } catch (err) {
      setStatus({
        status: 'error',
        message: err.message || 'Connection failed',
      });
    }
  };

  const toggleDarkMode = () => setDarkMode(!darkMode);

  if (isLoading) {
    return (
      <motion.div
        className={`app ${darkMode ? 'dark-mode' : ''}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <LoadingSpinner
          fullScreen={true}
          size="xl"
          text="Loading InboxIt..."
          color="primary"
        />
      </motion.div>
    );
  }

  const appVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1,
      },
    },
  };

  const contentVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94],
      },
    },
  };

  return (
    <ErrorBoundary>
      <motion.div
        className={`app ${darkMode ? 'dark-mode' : ''}`}
        variants={appVariants}
        initial="hidden"
        animate="visible"
      >
        <ToastContainer />

        <motion.div variants={contentVariants}>
          <Header user={user} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
        </motion.div>

        <AnimatePresence mode="wait">
          {!user ? (
            <motion.div
              key="login"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              <LoginSection />
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              <ConnectionStatus status={status} retry={testGmailConnection} />
              <Dashboard />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </ErrorBoundary>
  );
}

export default App;
