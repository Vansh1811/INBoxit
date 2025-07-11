import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import ConnectionStatus from '../components/ConnectionStatus';
import LoginSection from '../components/LoginSection';
import UserSection from '../components/UserSection';
import ServiceList from '../components/ServiceList'; // new wrapper to map ServiceCard
import '../App.css';

function Home() {
  const [user, setUser] = useState(null);
  const [services, setServices] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const res = await fetch('http://localhost:5000/auth/me', {
          method: 'GET',
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
          testGmailConnection();
        } else {
          setUser(null);
        }
      } catch {
        setError('Failed to check login status');
      }
    };

    checkLoginStatus();
  }, []);

  const testGmailConnection = async () => {
    try {
      setConnectionStatus('testing');
      const res = await fetch('http://localhost:5000/gmail/test-connection', {
        method: 'GET',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('failed');
        setError(data.error || 'Gmail connection failed');
      }
    } catch {
      setConnectionStatus('failed');
      setError('Failed to test Gmail connection');
    }
  };

  const fetchServices = async () => {
    if (!user || connectionStatus !== 'connected') return;
    try {
      setLoading(true);
      const res = await fetch('http://localhost:5000/gmail/all-signups', {
        method: 'GET',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setServices(Array.isArray(data) ? data : []);
        if (!data.length) {
          setError('No signup services found.');
        }
      } else {
        setError(data.error || 'Failed to fetch services');
      }
    } catch {
      setError('Network error while fetching services');
    } finally {
      setLoading(false);
    }
  };

  const toggleDarkMode = () => setDarkMode(!darkMode);

  return (
    <div className={`container ${darkMode ? 'dark' : ''}`}>
      <Header user={user} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
      
      <ConnectionStatus
        status={{
          status: connectionStatus === 'connected' ? 'success' : connectionStatus === 'failed' ? 'error' : '',
          message: error,
        }}
        retry={testGmailConnection}
      />

      {error && <div className="error-msg">{error}</div>}

      {!user ? (
        <LoginSection />
      ) : (
        <>
          <UserSection
            user={user}
            setUser={setUser}
            setServices={setServices}
            fetchServices={fetchServices}
          />

          <div className="refresh-btn">
            <button onClick={fetchServices} disabled={loading}>
              {loading ? '🔄 Loading...' : '🔄 Refresh Services'}
            </button>
          </div>

          {loading ? (
            <p>Scanning your emails for signup services...</p>
          ) : (
            <ServiceList services={services} />
          )}
        </>
      )}
    </div>
  );
}

export default Home;
