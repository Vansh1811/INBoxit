import React, { useEffect, useState } from 'react';
import './App.css';
import Header from './components/Header';
import LoginSection from './components/LoginSection';
import ConnectionStatus from './components/ConnectionStatus';
import Dashboard from './pages/Dashboard';
import apiService from './services/api';

function App() {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
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
  };

  const testGmailConnection = async () => {
    try {
      const data = await apiService.testConnection();
      setStatus({
        status: 'success',
        services: data.services || [],
        message: data.message
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
      <div className={`app ${darkMode ? 'dark-mode' : ''}`}>
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading InboxIt...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`app ${darkMode ? 'dark-mode' : ''}`}>
      <Header user={user} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
      {!user ? (
        <LoginSection />
      ) : (
        <>
          <ConnectionStatus status={status} retry={testGmailConnection} />
          <Dashboard />
        </>
      )}
    </div>
  );
}

export default App;
