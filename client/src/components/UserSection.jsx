import React, { useEffect, useState } from 'react';
import './UserSection.css';

function UserSection() {
  const [services, setServices] = useState([]);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!fetched) {
      fetchConnectedServices();
    }
  }, [fetched]);

  const fetchConnectedServices = async () => {
    setLoading(true);
    try {
      const servicesRes = await fetch('http://localhost:5000/test-connection', {
        credentials: 'include',
      });
      if (servicesRes.ok) {
        const servicesData = await servicesRes.json();
        setServices(servicesData.services || []);
      }

      setFetched(true);
    } catch (err) {
      setError('Failed to fetch data. Make sure backend is running.');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const scanForPlatforms = async () => {
    setScanning(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:5000/detect-platforms', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Platforms detected:', data.detected);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to scan emails');
      }
    } catch (err) {
      setError('Failed to scan emails. Check your connection.');
      console.error('Scan error:', err);
    } finally {
      setScanning(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setFetched(false);
    setServices([]);
  };

  if (error) {
    return (
      <div className="error-container">
        <h2>❌ Error</h2>
        <p>{error}</p>
        <button onClick={handleRetry} className="retry-button">
          🔄 Retry
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="user-section">
        <h2>📋 Connected Services:</h2>
        <p>⏳ Loading your connected services...</p>
      </div>
    );
  }

  return (
    <div className="user-section">
      <h2>📋 Connected Services:</h2>

      {services.length > 0 && (
        <div>
          <p>✅ Found {services.length} connected service{services.length > 1 ? 's' : ''}:</p>
          <ul className="services-list">
            {services.map((service, index) => (
              <li key={index} className="service-item">
                🔗 {service}
                <span className="connected-status">✅ {service} Connected</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="scan-button-container">
        <button
          onClick={scanForPlatforms}
          disabled={scanning}
          className="scan-button"
        >
          {scanning ? '🔄 Scanning emails...' : '🔍 Scan for Platforms'}
        </button>
      </div>
    </div>
  );
}

export default UserSection;
