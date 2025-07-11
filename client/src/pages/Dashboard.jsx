import React, { useState, useEffect } from 'react';
import ServiceCard from '../components/ServiceCard';
import apiService from '../services/api';
import './Dashboard.css';

function Dashboard() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastScan, setLastScan] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    unsubscribed: 0,
    ignored: 0,
    suspicious: 0
  });

  useEffect(() => {
    loadSavedServices();
  }, []);

  useEffect(() => {
    updateStats();
  }, [services]);

  const loadSavedServices = async () => {
    try {
      setLoading(true);
      const data = await apiService.getSavedServices();
      setServices(data.services || []);
      setLastScan(data.lastScan);
      setError(null);
    } catch (err) {
      setError('Failed to load services');
      console.error('Load services error:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshServices = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await apiService.fetchSignupServices();
      setServices(data.services || []);
      setLastScan(data.lastScan);
      
      // Show success message
      showToast(`✅ Found ${data.count} services`, 'success');
    } catch (err) {
      setError('Failed to refresh services');
      showToast('❌ Failed to refresh services', 'error');
      console.error('Refresh services error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async (domain) => {
    try {
      await apiService.updateServiceStatus(domain, 'unsubscribe');
      
      setServices(prev => 
        prev.map(service => 
          service.domain === domain 
            ? { ...service, unsubscribed: true }
            : service
        )
      );
      
      showToast('✅ Marked as unsubscribed', 'success');
    } catch (err) {
      showToast('❌ Failed to unsubscribe', 'error');
      throw err;
    }
  };

  const handleIgnore = async (domain) => {
    try {
      await apiService.updateServiceStatus(domain, 'ignore');
      
      setServices(prev => 
        prev.map(service => 
          service.domain === domain 
            ? { ...service, ignored: true }
            : service
        )
      );
      
      showToast('👁️ Service ignored', 'success');
    } catch (err) {
      showToast('❌ Failed to ignore service', 'error');
      throw err;
    }
  };

  const updateStats = () => {
    const total = services.length;
    const unsubscribed = services.filter(s => s.unsubscribed).length;
    const ignored = services.filter(s => s.ignored).length;
    const suspicious = services.filter(s => s.suspicious).length;
    
    setStats({ total, unsubscribed, ignored, suspicious });
  };

  const showToast = (message, type) => {
    // Simple toast implementation - you can replace with a proper toast library
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 600;
      z-index: 1000;
      animation: slideIn 0.3s ease;
      background: ${type === 'success' ? '#28a745' : '#dc3545'};
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3000);
  };

  const formatLastScan = (dateString) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} minutes ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  const activeServices = services.filter(s => !s.unsubscribed && !s.ignored);
  const managedServices = services.filter(s => s.unsubscribed || s.ignored);

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <h1 className="dashboard-title">📧 Email Services Dashboard</h1>
          <p className="dashboard-subtitle">
            Manage your email subscriptions and services
          </p>
        </div>
        
        <div className="header-actions">
          <button 
            className="refresh-btn"
            onClick={refreshServices}
            disabled={loading}
          >
            {loading ? '🔄 Scanning...' : '🔄 Refresh Services'}
          </button>
        </div>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Total Services</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{activeServices.length}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.unsubscribed}</div>
          <div className="stat-label">Unsubscribed</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.ignored}</div>
          <div className="stat-label">Ignored</div>
        </div>
        {stats.suspicious > 0 && (
          <div className="stat-card suspicious">
            <div className="stat-number">{stats.suspicious}</div>
            <div className="stat-label">Suspicious</div>
          </div>
        )}
      </div>

      <div className="dashboard-info">
        <p className="last-scan">
          <strong>Last scan:</strong> {formatLastScan(lastScan)}
        </p>
      </div>

      {error && (
        <div className="error-banner">
          <span>❌ {error}</span>
          <button onClick={loadSavedServices}>Retry</button>
        </div>
      )}

      {loading && (
        <div className="loading-banner">
          <div className="loading-spinner"></div>
          <span>🔍 Scanning your emails for services...</span>
        </div>
      )}

      {!loading && services.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No Services Found</h3>
          <p>Click "Refresh Services" to scan your emails for signup services.</p>
          <button className="refresh-btn" onClick={refreshServices}>
            🔍 Start Scanning
          </button>
        </div>
      )}

      {activeServices.length > 0 && (
        <div className="services-section">
          <h2 className="section-title">
            🔴 Active Services ({activeServices.length})
          </h2>
          <div className="services-grid">
            {activeServices.map((service, index) => (
              <ServiceCard
                key={service.domain || index}
                platform={service.platform}
                email={service.email}
                domain={service.domain}
                subject={service.subject}
                date={service.date}
                suspicious={service.suspicious}
                unsubscribed={service.unsubscribed}
                ignored={service.ignored}
                onUnsubscribe={handleUnsubscribe}
                onIgnore={handleIgnore}
              />
            ))}
          </div>
        </div>
      )}

      {managedServices.length > 0 && (
        <div className="services-section">
          <h2 className="section-title">
            ✅ Managed Services ({managedServices.length})
          </h2>
          <div className="services-grid">
            {managedServices.map((service, index) => (
              <ServiceCard
                key={service.domain || index}
                platform={service.platform}
                email={service.email}
                domain={service.domain}
                subject={service.subject}
                date={service.date}
                suspicious={service.suspicious}
                unsubscribed={service.unsubscribed}
                ignored={service.ignored}
                onUnsubscribe={handleUnsubscribe}
                onIgnore={handleIgnore}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;