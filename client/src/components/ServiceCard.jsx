import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Calendar, Globe, MoreVertical, Trash2, EyeOff, Undo2, Shield } from 'lucide-react';
import { showToast } from './ui/Toast';
import { suspiciousEmailDetector } from '../utils/suspiciousEmailDetector';
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
  const [showActions, setShowActions] = useState(false);
  const [suspiciousAnalysis, setSuspiciousAnalysis] = useState(null);
  const [status, setStatus] = useState({ unsubscribed, ignored });

  useEffect(() => {
    const analysis = suspiciousEmailDetector.analyzeService({ platform, email, domain, subject, date });
    setSuspiciousAnalysis(analysis);
  }, [platform, email, domain, subject, date]);

  const handleAction = async (action) => {
    setIsLoading(true);
    try {
      const actionFn = action === 'unsubscribe' ? onUnsubscribe : onIgnore;
      const promise = actionFn(domain);

      showToast.promise(promise, {
        loading: `${action === 'unsubscribe' ? 'Unsubscribing from' : 'Ignoring'} ${platform}...`,
        success: `✅ ${platform} ${action}ed successfully`,
        error: `❌ Failed to ${action} ${platform}`
      });

      await promise;
      setStatus(prev => ({
        ...prev,
        [action === 'unsubscribe' ? 'unsubscribed' : 'ignored']: true
      }));
      setShowActions(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsLoading(true);
    try {
      const restorePromise = onUnsubscribe(domain, 'restore');
      showToast.promise(restorePromise, {
        loading: `Restoring ${platform}...`,
        success: `✅ ${platform} restored`,
        error: `❌ Restore failed`
      });
      await restorePromise;
      setStatus({ unsubscribed: false, ignored: false });
      setShowActions(false);
    } catch (err) {
      console.error('Restore failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = () => {
    if (status.unsubscribed) return 'unsubscribed';
    if (status.ignored) return 'ignored';
    if (suspicious || suspiciousAnalysis?.isSuspicious) return 'suspicious';
    return 'active';
  };

  const suspiciousLevel = (() => {
    if (!suspiciousAnalysis) return null;
    const { score } = suspiciousAnalysis;
    if (score < 0.3) return { level: 'safe', color: 'green', icon: Shield };
    if (score < 0.6) return { level: 'questionable', color: 'yellow', icon: AlertTriangle };
    if (score < 0.8) return { level: 'suspicious', color: 'orange', icon: AlertTriangle };
    return { level: 'dangerous', color: 'red', icon: AlertTriangle };
  })();

  const formatDate = (d) => {
    try {
      return new Date(d).toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3 } },
    hover: { y: -6, scale: 1.02 }
  };

  return (
    <motion.div 
      className={`service-card ${getStatusColor()}`}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      layout
    >
      <div className="service-header">
        <div className="service-info">
         <motion.img 
            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} 
            alt={`${platform} favicon`} 
            className="service-favicon"
            onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/logo192.png'; 
             }}
            whileHover={{ rotate: 5, scale: 1.1 }}
            transition={{ duration: 0.2 }}
          />

          <div className="service-details">
            <h3 className="service-platform">{platform}</h3>
            <p className="service-email">{email}</p>
          </div>
        </div>

        <div className="service-status">
          {suspiciousLevel && suspiciousLevel.level !== 'safe' && (
            <span className={`status-badge ${suspiciousLevel.level}`}>
              <suspiciousLevel.icon className="w-3 h-3 mr-1" />
              {suspiciousLevel.level}
            </span>
          )}
          {status.unsubscribed && <span className="status-badge unsubscribed">✅ Unsubscribed</span>}
          {status.ignored && <span className="status-badge ignored">👁️ Ignored</span>}

          <div className="relative">
            <motion.button
              onClick={() => setShowActions(!showActions)}
              className="action-toggle"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <MoreVertical className="w-4 h-4" />
            </motion.button>

            <AnimatePresence>
              {showActions && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="action-menu"
                >
                  <div className="menu-list">
                    {!status.unsubscribed && !status.ignored && (
                      <>
                        <button onClick={() => handleAction('unsubscribe')} disabled={isLoading}>
                          <Trash2 className="w-4 h-4" /> Unsubscribe
                        </button>
                        <button onClick={() => handleAction('ignore')} disabled={isLoading}>
                          <EyeOff className="w-4 h-4" /> Ignore
                        </button>
                      </>
                    )}
                    {(status.unsubscribed || status.ignored) && (
                      <button onClick={handleRestore} disabled={isLoading}>
                        <Undo2 className="w-4 h-4" /> Restore
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {suspiciousAnalysis?.reasons.length > 0 && (
        <div className="suspicious-analysis">
          <div className="analysis-header">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <span>
              AI flagged this as {Math.round(suspiciousAnalysis.score * 100)}% suspicious
            </span>
          </div>
          <ul className="analysis-reasons">
            {suspiciousAnalysis.reasons.slice(0, 2).map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {subject && (
        <div className="service-subject">
          <p title={subject}><strong>Last email:</strong> {subject.length > 60 ? subject.slice(0, 60) + '...' : subject}</p>
        </div>
      )}

      <div className="service-meta">
        <span><Calendar className="w-3 h-3" /> {formatDate(date)}</span>
        <span><Globe className="w-3 h-3" /> {domain}</span>
      </div>

      {/* Quick Buttons */}
      <AnimatePresence>
        {!status.unsubscribed && !status.ignored && (
          <motion.div
            className="service-actions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <button onClick={() => handleAction('unsubscribe')} disabled={isLoading}>
              <Trash2 className="w-4 h-4" /> {isLoading ? 'Processing...' : 'Unsubscribe'}
            </button>
            <button onClick={() => handleAction('ignore')} disabled={isLoading}>
              <EyeOff className="w-4 h-4" /> {isLoading ? 'Processing...' : 'Ignore'}
            </button>
          </motion.div>
        )}

        {(status.unsubscribed || status.ignored) && (
          <motion.div
            className="service-actions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <button onClick={handleRestore} disabled={isLoading}>
              <Undo2 className="w-4 h-4" /> {isLoading ? 'Restoring...' : 'Restore'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default ServiceCard;
