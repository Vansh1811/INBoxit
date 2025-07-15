import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings as SettingsIcon, 
  Shield, 
  Clock, 
  Mail, 
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { showToast } from '../components/ui/Toast';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import './Settings.css';

function Settings() {
  const [settings, setSettings] = useState({
    suspiciousDetection: true,
    autoScan: false,
    scanFrequency: 'weekly',
    emailNotifications: true,
    ignoredDomains: [],
    newIgnoredDomain: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanLogs, setScanLogs] = useState([]);

  useEffect(() => {
    loadSettings();
    loadScanLogs();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      // Load from localStorage for now
      const savedSettings = localStorage.getItem('inboxit-settings');
      if (savedSettings) {
        setSettings(prev => ({ ...prev, ...JSON.parse(savedSettings) }));
      }
    } catch (error) {
      showToast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const loadScanLogs = async () => {
    try {
      // Mock scan logs for now
      const mockLogs = [
        {
          id: 1,
          date: new Date().toISOString(),
          servicesFound: 23,
          suspicious: 5,
          duration: '2m 34s',
          status: 'completed'
        },
        {
          id: 2,
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          servicesFound: 18,
          suspicious: 3,
          duration: '1m 52s',
          status: 'completed'
        },
        {
          id: 3,
          date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          servicesFound: 31,
          suspicious: 8,
          duration: '3m 12s',
          status: 'completed'
        }
      ];
      setScanLogs(mockLogs);
    } catch (error) {
      console.error('Failed to load scan logs:', error);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      
      // Save to localStorage for now
      localStorage.setItem('inboxit-settings', JSON.stringify(settings));
      
      // In a real app, you'd save to your backend
      // await apiService.updateUserSettings(settings);
      
      showToast.success('Settings saved successfully!');
    } catch (error) {
      showToast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const addIgnoredDomain = () => {
    const domain = settings.newIgnoredDomain.trim().toLowerCase();
    if (domain && !settings.ignoredDomains.includes(domain)) {
      setSettings(prev => ({
        ...prev,
        ignoredDomains: [...prev.ignoredDomains, domain],
        newIgnoredDomain: ''
      }));
    }
  };

  const removeIgnoredDomain = (domain) => {
    setSettings(prev => ({
      ...prev,
      ignoredDomains: prev.ignoredDomains.filter(d => d !== domain)
    }));
  };

  const triggerManualScan = async () => {
    try {
      showToast.loading('Starting manual scan...');
      // Trigger scan logic here
      await new Promise(resolve => setTimeout(resolve, 2000)); // Mock delay
      showToast.success('Scan completed successfully!');
      loadScanLogs(); // Refresh logs
    } catch (error) {
      showToast.error('Scan failed');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  if (loading) {
    return (
      <div className="settings-page">
        <LoadingSpinner fullScreen={true} text="Loading settings..." />
      </div>
    );
  }

  return (
    <motion.div 
      className="settings-page"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="settings-container">
        <motion.div className="settings-header" variants={itemVariants}>
          <div className="header-content">
            <div className="header-icon">
              <SettingsIcon className="w-8 h-8 text-blue-500" />
            </div>
            <div>
              <h1 className="settings-title">Settings</h1>
              <p className="settings-subtitle">Customize your InboxIt experience</p>
            </div>
          </div>
          
          <motion.button
            onClick={saveSettings}
            disabled={saving}
            className="save-button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {saving ? (
              <LoadingSpinner size="sm" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </motion.button>
        </motion.div>

        <div className="settings-content">
          {/* Privacy & Security */}
          <motion.section className="settings-section" variants={itemVariants}>
            <div className="section-header">
              <Shield className="w-5 h-5 text-green-500" />
              <h2>Privacy & Security</h2>
            </div>
            
            <div className="setting-item">
              <div className="setting-info">
                <h3>Suspicious Email Detection</h3>
                <p>Use AI to automatically detect potentially harmful or spam services</p>
              </div>
              <motion.label 
                className="toggle-switch"
                whileTap={{ scale: 0.95 }}
              >
                <input
                  type="checkbox"
                  checked={settings.suspiciousDetection}
                  onChange={(e) => handleSettingChange('suspiciousDetection', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </motion.label>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <h3>Ignored Domains</h3>
                <p>Email domains that will be excluded from scans and analysis</p>
              </div>
              <div className="ignored-domains">
                <div className="domain-input">
                  <input
                    type="text"
                    value={settings.newIgnoredDomain}
                    onChange={(e) => handleSettingChange('newIgnoredDomain', e.target.value)}
                    placeholder="Enter domain (e.g., example.com)"
                    onKeyPress={(e) => e.key === 'Enter' && addIgnoredDomain()}
                  />
                  <motion.button
                    onClick={addIgnoredDomain}
                    className="add-domain-btn"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Add
                  </motion.button>
                </div>
                <div className="domain-list">
                  {settings.ignoredDomains.map((domain, index) => (
                    <motion.div
                      key={domain}
                      className="domain-tag"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <span>{domain}</span>
                      <button
                        onClick={() => removeIgnoredDomain(domain)}
                        className="remove-domain"
                      >
                        ×
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>

          {/* Scanning & Automation */}
          <motion.section className="settings-section" variants={itemVariants}>
            <div className="section-header">
              <Clock className="w-5 h-5 text-blue-500" />
              <h2>Scanning & Automation</h2>
            </div>
            
            <div className="setting-item">
              <div className="setting-info">
                <h3>Automatic Scanning</h3>
                <p>Automatically scan for new email services at regular intervals</p>
              </div>
              <motion.label 
                className="toggle-switch"
                whileTap={{ scale: 0.95 }}
              >
                <input
                  type="checkbox"
                  checked={settings.autoScan}
                  onChange={(e) => handleSettingChange('autoScan', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </motion.label>
            </div>

            {settings.autoScan && (
              <motion.div 
                className="setting-item"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="setting-info">
                  <h3>Scan Frequency</h3>
                  <p>How often should we scan your emails for new services</p>
                </div>
                <select
                  value={settings.scanFrequency}
                  onChange={(e) => handleSettingChange('scanFrequency', e.target.value)}
                  className="frequency-select"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </motion.div>
            )}

            <div className="setting-item">
              <div className="setting-info">
                <h3>Manual Scan</h3>
                <p>Trigger a complete scan of your email history right now</p>
              </div>
              <motion.button
                onClick={triggerManualScan}
                className="manual-scan-btn"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <RefreshCw className="w-4 h-4" />
                Start Scan
              </motion.button>
            </div>
          </motion.section>

          {/* Notifications */}
          <motion.section className="settings-section" variants={itemVariants}>
            <div className="section-header">
              <Mail className="w-5 h-5 text-purple-500" />
              <h2>Notifications</h2>
            </div>
            
            <div className="setting-item">
              <div className="setting-info">
                <h3>Email Notifications</h3>
                <p>Receive email updates about scan results and suspicious services</p>
              </div>
              <motion.label 
                className="toggle-switch"
                whileTap={{ scale: 0.95 }}
              >
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </motion.label>
            </div>
          </motion.section>

          {/* Scan History */}
          <motion.section className="settings-section" variants={itemVariants}>
            <div className="section-header">
              <Info className="w-5 h-5 text-orange-500" />
              <h2>Scan History</h2>
            </div>
            
            <div className="scan-logs">
              {scanLogs.length === 0 ? (
                <div className="empty-logs">
                  <p>No scan history available</p>
                </div>
              ) : (
                scanLogs.map((log, index) => (
                  <motion.div
                    key={log.id}
                    className="scan-log-item"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="log-status">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                    <div className="log-details">
                      <div className="log-header">
                        <span className="log-date">{formatDate(log.date)}</span>
                        <span className="log-duration">{log.duration}</span>
                      </div>
                      <div className="log-stats">
                        <span>{log.servicesFound} services found</span>
                        {log.suspicious > 0 && (
                          <span className="suspicious-count">
                            <AlertTriangle className="w-4 h-4" />
                            {log.suspicious} suspicious
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.section>
        </div>
      </div>
    </motion.div>
  );
}

export default Settings;