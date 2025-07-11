import React, { useEffect, useState } from 'react';
import './App.css';
import Header from './components/Header';
import LoginSection from './components/LoginSection';
import UserSection from './components/UserSection';
import ConnectionStatus from './components/ConnectionStatus';
import PlatformList from './components/PlatformList';
import ServiceList from './components/ServiceList';

function App() {
  const [user, setUser] = useState(null);
  const [services, setServices] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const res = await fetch('http://localhost:5000/auth/me', {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        const userObj = {
          ...data,
          name: data.displayName || data.name,
          email: data.emails?.[0]?.value || data.email,
        };
        setUser(userObj);
        testGmailConnection();
        loadPlatforms();
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Login check error:', err.message);
    }
  };

  const testGmailConnection = async () => {
    try {
      const res = await fetch('http://localhost:5000/test-connection', {
        credentials: 'include',
      });
      const data = await res.json();

      if (res.ok) {
        setStatus({
          status: 'success',
          email: data.email,
          messagesTotal: data.messagesTotal,
        });
        setServices(data.services || []);
      } else {
        setStatus({
          status: 'error',
          message: data.error || 'Unknown error',
        });
      }
    } catch (err) {
      setStatus({
        status: 'error',
        message: err.message || 'Request failed',
      });
    }
  };

  const loadPlatforms = async () => {
    try {
      const res = await fetch('http://localhost:5000/my-platforms', {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setPlatforms(data.platforms || []);
      }
    } catch (err) {
      console.error('Failed to load platforms:', err);
    }
  };

  const fetchServices = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:5000/detect-platforms', {
        credentials: 'include',
      });
      const data = await res.json();

      if (res.ok) {
        setPlatforms(data.saved || []);
      } else {
        console.error('❌ Error detecting platforms:', data.error);
      }
    } catch (err) {
      console.error('❌ Fetch error:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDarkMode = () => setDarkMode(!darkMode);

const uniqueServices = services.filter(service => {
  const serviceName = typeof service === 'string' ? service : service.platform || service.service;
  return !platforms.some(p => p.platform.toLowerCase() === serviceName?.toLowerCase());
});


  return (
    <div className={`app ${darkMode ? 'dark-mode' : ''}`}>
      <Header user={user} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
      {!user ? (
        <LoginSection />
      ) : (
        <>
          <UserSection
            user={user}
            setUser={setUser}
            services={uniqueServices}
            platforms={platforms}
            setPlatforms={setPlatforms}
            fetchServices={fetchServices}
          />
          <ConnectionStatus status={status} retry={testGmailConnection} />
          <PlatformList platforms={platforms} />
          <ServiceList isLoading={isLoading} services={uniqueServices} />
        </>
      )}
    </div>
  );
}

export default App;
