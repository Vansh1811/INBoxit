import React, { useState } from 'react';
import './ServiceCard.css';

function ServiceCard({ 
  platform, 
  email, 
  domain, 
  subject, 
  date, 
  suspicious = false, 
  unsubscribed = false,
  ignored = false,
  onUnsubscribe, 
  onIgnore 
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({
    unsubscribed,
    ignored
  });

  const handleAction = async (action) => {
    setIsLoading(true);
    try {
      await (action === 'unsubscribe' ? onUnsubscribe(domain) : onIgnore(domain));
      setStatus(prev => ({
        ...prev,
        [action === 'unsubscribe' ? 'unsubscribed' : 'ignored']: true
      }));
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  const getFaviconUrl = (domain) => {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  };

  const getStatusColor = () => {
    if (status.unsubscribed) return 'unsubscribed';
    if (status.ignored) return 'ignored';
    if (suspicious) return 'suspicious';
    return 'active';
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Unknown date';
    }
  };

  return (
    <div className={`service-card ${getStatusColor()}`}>
      <div className="service-header">
        <div className="service-info">
          <img 
            src={getFaviconUrl(domain)} 
            alt={`${platform} favicon`}
            className="service-favicon"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          <div className="service-details">
            <h3 className="service-platform">{platform}</h3>
            <p className="service-email">{email}</p>
          </div>
        </div>
        
        <div className="service-status">
          {suspicious && <span className="status-badge suspicious">🚨 Suspicious</span>}
          {status.unsubscribed && <span className="status-badge unsubscribed">✅ Unsubscribed</span>}
          {status.ignored && <span className="status-badge ignored">👁️ Ignored</span>}
        </div>
      </div>

      {subject && (
        <div className="service-subject">
          <p title={subject}>
            <strong>Last email:</strong> {subject.length > 60 ? `${subject.substring(0, 60)}...` : subject}
          </p>
        </div>
      )}

      <div className="service-meta">
        <span className="service-date">📅 {formatDate(date)}</span>
        <span className="service-domain">🌐 {domain}</span>
      </div>

      {!status.unsubscribed && !status.ignored && (
        <div className="service-actions">
          <button
            className="action-btn unsubscribe-btn"
            onClick={() => handleAction('unsubscribe')}
            disabled={isLoading}
          >
            {isLoading ? '⏳' : '🚫'} Unsubscribe
          </button>
          <button
            className="action-btn ignore-btn"
            onClick={() => handleAction('ignore')}
            disabled={isLoading}
          >
            {isLoading ? '⏳' : '👁️'} Ignore
          </button>
        </div>
      )}
    </div>
  );
}

export default ServiceCard;