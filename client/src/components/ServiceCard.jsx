import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Calendar, Globe, Mail, MoreVertical, Shield, Trash2, EyeOff, Undo2 } from 'lucide-react';
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
  const [status, setStatus] = useState({
    unsubscribed,
    ignored
  });
  const [showActions, setShowActions] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suspiciousAnalysis, setSuspiciousAnalysis] = useState(null);

  // Analyze service for suspicious patterns on mount
  React.useEffect(() => {
    if (!suspiciousAnalysis && !isAnalyzing) {
      setIsAnalyzing(true);
      const analysis = suspiciousEmailDetector.analyzeService({
        platform,
        email,
        domain,
        subject,
        date
      });
      setSuspiciousAnalysis(analysis);
      setIsAnalyzing(false);
    }
  }, [platform, email, domain, subject, date, suspiciousAnalysis, isAnalyzing]);

  const handleAction = async (action) => {
    setIsLoading(true);
    try {
      const actionPromise = action === 'unsubscribe' ? onUnsubscribe(domain) : onIgnore(domain);
      
      showToast.promise(actionPromise, {
        loading: `${action === 'unsubscribe' ? 'Unsubscribing from' : 'Ignoring'} ${platform}...`,
        success: `✅ ${platform} ${action === 'unsubscribe' ? 'unsubscribed' : 'ignored'} successfully`,
        error: `❌ Failed to ${action} ${platform}`
      });
      
      await actionPromise;
      setStatus(prev => ({
        ...prev,
        [action === 'unsubscribe' ? 'unsubscribed' : 'ignored']: true
      }));
      setShowActions(false);
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsLoading(true);
    try {
      const restorePromise = onUnsubscribe ? onUnsubscribe(domain, 'restore') : Promise.resolve();
      
      showToast.promise(restorePromise, {
        loading: `Restoring ${platform}...`,
        success: `✅ ${platform} restored successfully`,
        error: `❌ Failed to restore ${platform}`
      });
      
      await restorePromise;
      setStatus({ unsubscribed: false, ignored: false });
      setShowActions(false);
    } catch (error) {
      console.error('Failed to restore:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getFaviconUrl = (domain) => {
    // Use DuckDuckGo favicon API for better reliability
    return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
  };

  const getStatusColor = () => {
    if (status.unsubscribed) return 'unsubscribed';
    if (status.ignored) return 'ignored';
    if (suspicious || suspiciousAnalysis?.isSuspicious) return 'suspicious';
    return 'active';
  };

  const getSuspiciousLevel = () => {
    if (!suspiciousAnalysis) return null;
    
    const { score, category } = suspiciousAnalysis;
    
    if (score < 0.3) return { level: 'safe', color: 'green', icon: Shield };
    if (score < 0.6) return { level: 'questionable', color: 'yellow', icon: AlertTriangle };
    if (score < 0.8) return { level: 'suspicious', color: 'orange', icon: AlertTriangle };
    return { level: 'dangerous', color: 'red', icon: AlertTriangle };
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Unknown date';
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: {
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    },
    hover: {
      y: -8,
      scale: 1.02,
      transition: {
        duration: 0.2,
        ease: "easeOut"
      }
    }
  };

  const suspiciousLevel = getSuspiciousLevel();

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
          <motion.div
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ duration: 0.2 }}
          >
            <img 
              src={getFaviconUrl(domain)} 
              alt={`${platform} favicon`}
              className="service-favicon"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </motion.div>
          <div className="service-details">
            <h3 className="service-platform">{platform}</h3>
            <p className="service-email">{email}</p>
          </div>
        </div>
        
        <div className="service-status">
          {/* AI Suspicious Analysis Badge */}
          {suspiciousLevel && suspiciousLevel.level !== 'safe' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`status-badge ${suspiciousLevel.level}`}
              title={`Suspicious score: ${Math.round((suspiciousAnalysis?.score || 0) * 100)}%`}
            >
              <suspiciousLevel.icon className="w-3 h-3 mr-1" />
              {suspiciousLevel.level}
            </motion.div>
          )}
          
          {/* Status Badges */}
          {status.unsubscribed && <span className="status-badge unsubscribed">✅ Unsubscribed</span>}
          {status.ignored && <span className="status-badge ignored">👁️ Ignored</span>}
          
          {/* Actions Menu */}
          <div className="relative">
            <motion.button
              onClick={() => setShowActions(!showActions)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
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
                  className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50"
                >
                  <div className="py-2">
                    {!status.unsubscribed && !status.ignored && (
                      <>
                        <button
                          onClick={() => handleAction('unsubscribe')}
                          disabled={isLoading}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Unsubscribe
                        </button>
                        <button
                          onClick={() => handleAction('ignore')}
                          disabled={isLoading}
                          className="w-full px-4 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <EyeOff className="w-4 h-4" />
                          Ignore
                        </button>
                      </>
                    )}
                    
                    {(status.unsubscribed || status.ignored) && (
                      <button
                        onClick={handleRestore}
                        disabled={isLoading}
                        className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                      >
                        <Undo2 className="w-4 h-4" />
                        Restore
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* AI Analysis Details */}
      {suspiciousAnalysis && suspiciousAnalysis.reasons.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="suspicious-analysis"
        >
          <div className="analysis-header">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium text-gray-700">
              AI Analysis ({Math.round((suspiciousAnalysis.score || 0) * 100)}% suspicious)
            </span>
          </div>
          <div className="analysis-reasons">
            {suspiciousAnalysis.reasons.slice(0, 2).map((reason, index) => (
              <div key={index} className="reason-item">
                <span className="text-xs text-gray-600">{reason}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {subject && (
        <div className="service-subject">
          <p title={subject}>
            <strong>Last email:</strong> {subject.length > 60 ? `${subject.substring(0, 60)}...` : subject}
          </p>
        </div>
      )}

      <div className="service-meta">
        <motion.span 
          className="service-date"
          whileHover={{ scale: 1.05 }}
        >
          <Calendar className="w-3 h-3 mr-1" />
          {formatDate(date)}
        </motion.span>
        <motion.span 
          className="service-domain"
          whileHover={{ scale: 1.05 }}
        >
          <Globe className="w-3 h-3 mr-1" />
          {domain}
        </motion.span>
      </div>

      {/* Quick Action Buttons */}
      <AnimatePresence>
        {!status.unsubscribed && !status.ignored && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="service-actions"
          >
            <motion.button
              className="action-btn unsubscribe-btn"
              onClick={() => handleAction('unsubscribe')}
              disabled={isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Trash2 className="w-4 h-4" />
              {isLoading ? 'Processing...' : 'Unsubscribe'}
            </motion.button>
            <motion.button
              className="action-btn ignore-btn"
              onClick={() => handleAction('ignore')}
              disabled={isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <EyeOff className="w-4 h-4" />
              {isLoading ? 'Processing...' : 'Ignore'}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Managed Service Actions */}
      <AnimatePresence>
        {(status.unsubscribed || status.ignored) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="service-actions"
          >
            <motion.button
              className="action-btn restore-btn"
              onClick={handleRestore}
              disabled={isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Undo2 className="w-4 h-4" />
              {isLoading ? 'Restoring...' : 'Restore Service'}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default ServiceCard;