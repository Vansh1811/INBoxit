<<<<<<< HEAD
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, BarChart3, TrendingUp, AlertTriangle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import ServiceCard from '../components/ServiceCard';
import SearchBar from '../components/ui/SearchBar';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ProgressBar from '../components/ui/ProgressBar';
import AnimatedCard from '../components/ui/AnimatedCard';
import { ToastContainer, showToast } from '../components/ui/Toast';
import { useSearch } from '../hooks/useSearch';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { suspiciousEmailDetector } from '../utils/suspiciousEmailDetector';
import apiService from '../services/api';
import './Dashboard.css';

function Dashboard() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastScan, setLastScan] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [viewMode, setViewMode] = useLocalStorage('dashboard-view-mode', 'all');
  const [scanProgress, setScanProgress] = useState(0);

  const searchFilters = [
    { id: 'active', label: 'Active Services', count: services.filter(s => !s.unsubscribed && !s.ignored).length },
    { id: 'unsubscribed', label: 'Unsubscribed', count: services.filter(s => s.unsubscribed).length },
    { id: 'ignored', label: 'Ignored', count: services.filter(s => s.ignored).length },
    { id: 'suspicious', label: 'Suspicious', count: services.filter(s => s.suspicious).length },
    {
      id: 'recent', label: 'Recent (7 days)', count: services.filter(s => {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        return new Date(s.date) > oneWeekAgo;
      }).length
    }
  ];

  const sortOptions = [
    { value: 'platform', label: 'Platform Name' },
    { value: 'date', label: 'Date Received' },
    { value: 'domain', label: 'Domain' },
    { value: 'suspicious', label: 'Suspicious Score' }
  ];

  const {
    results: filteredServices,
    handleSearch,
    handleFilter,
    handleSort
  } = useSearch(services, {
    searchFields: ['platform', 'domain', 'email', 'subject']
  });

  useEffect(() => {
    loadSavedServices();
  }, []);

 useEffect(() => {
  if (services.length > 0 && !aiAnalysis) {
    performAIAnalysis();
  }
}, [services]);

  const performAIAnalysis = async () => {
    try {
      const analyzedServices = suspiciousEmailDetector.batchAnalyze(services);
      const summary = suspiciousEmailDetector.getAnalysisSummary(analyzedServices);
      setAiAnalysis(summary);
      setServices(prev =>
        prev.map(service => {
          const analyzed = analyzedServices.find(a => a.domain === service.domain);
          return analyzed ? { ...service, suspiciousAnalysis: analyzed.suspiciousAnalysis } : service;
        })
      );
    } catch (error) {
      console.error('AI analysis failed:', error);
    }
  };

  const loadSavedServices = async () => {
    try {
      setLoading(true);
      setScanProgress(0);
      const data = await apiService.getSavedServices();
      setServices(data.services || []);
      setLastScan(data.lastScan);
      setError(null);
      setScanProgress(100);
    } catch (err) {
      setError('Failed to load services');
      showToast.error('Failed to load services');
      console.error('Load services error:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshServices = async () => {
    try {
      setLoading(true);
      setScanProgress(0);
      setError(null);
      const progressInterval = setInterval(() => {
        setScanProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const data = await apiService.fetchSignupServices();
      clearInterval(progressInterval);
      setScanProgress(100);
      setServices(data.services || []);
      setLastScan(data.lastScan);
      showToast.success(`Found ${data.count || 0} services`);
    } catch (err) {
      setError('Failed to refresh services');
      showToast.error('Failed to refresh services');
      console.error('Refresh services error:', err);
    } finally {
      setLoading(false);
      setTimeout(() => setScanProgress(0), 1000);
    }
  };

  const handleUnsubscribe = async (domain) => {
    const action = 'unsubscribe'; // ✅ Fix: Defined action
    try {
      await apiService.updateServiceStatus(domain, action);
      setServices(prev =>
        prev.map(service =>
          service.domain === domain
            ? {
                ...service,
                unsubscribed: action === 'restore' ? false : true,
                ignored: action === 'restore' ? false : service.ignored
              }
            : service
        )
      );
    } catch (err) {
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
    } catch (err) {
      throw err;
    }
  };

  const handleBulkAction = async (action, selectedDomains) => {
    const loadingToast = showToast.loading(`Processing ${selectedDomains.length} services...`);
    try {
      const promises = selectedDomains.map(domain =>
        apiService.updateServiceStatus(domain, action)
      );
      await Promise.all(promises);
      setServices(prev => prev.map(service =>
        selectedDomains.includes(service.domain)
          ? { ...service, [action]: true }
          : service
      ));
      showToast.dismiss(loadingToast);
      showToast.success(`${action} ${selectedDomains.length} services successfully`);
    } catch (error) {
      showToast.dismiss(loadingToast);
      showToast.error(`Failed to ${action} services`);
    }
  };

  const getFilteredServicesByView = () => {
    switch (viewMode) {
      case 'active':
        return filteredServices.filter(s => !s.unsubscribed && !s.ignored);
      case 'managed':
        return filteredServices.filter(s => s.unsubscribed || s.ignored);
      case 'suspicious':
        return filteredServices.filter(s => s.suspicious || s.suspiciousAnalysis?.isSuspicious);
      default:
        return filteredServices;
    }
  };

  const displayServices = getFilteredServicesByView();

  const stats = {
    total: services.length,
    active: services.filter(s => !s.unsubscribed && !s.ignored).length,
    unsubscribed: services.filter(s => s.unsubscribed).length,
    ignored: services.filter(s => s.ignored).length,
    suspicious: services.filter(s => s.suspicious || s.suspiciousAnalysis?.isSuspicious).length
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div className="dashboard" variants={containerVariants} initial="hidden" animate="visible">
      <ToastContainer />

      <div className="dashboard-header">
        <div className="header-content">
          <motion.h1 className="dashboard-title" variants={itemVariants}>
            📧 Email Services Dashboard
          </motion.h1>
          <motion.p className="dashboard-subtitle" variants={itemVariants}>
            AI-powered email subscription management
          </motion.p>
        </div>
        <div className="header-actions">
          <motion.button
            className="refresh-btn"
            onClick={refreshServices}
            disabled={loading}
            variants={itemVariants}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" color="primary" />
                Scanning...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Refresh Services
              </>
            )}
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {scanProgress > 0 && scanProgress < 100 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6"
          >
            <ProgressBar progress={scanProgress} label="Scanning emails..." color="blue" animated={true} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div className="dashboard-stats" variants={itemVariants}>
        <AnimatedCard className="stat-card" delay={0.1}>
          <div className="stat-icon"><BarChart3 className="w-6 h-6 text-blue-500" /></div>
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Total Services</div>
        </AnimatedCard>

        <AnimatedCard className="stat-card" delay={0.2}>
          <div className="stat-icon"><CheckCircle className="w-6 h-6 text-green-500" /></div>
          <div className="stat-number">{stats.active}</div>
          <div className="stat-label">Active</div>
        </AnimatedCard>

        <AnimatedCard className="stat-card" delay={0.3}>
          <div className="stat-icon"><EyeOff className="w-6 h-6 text-gray-500" /></div>
          <div className="stat-number">{stats.unsubscribed}</div>
          <div className="stat-label">Unsubscribed</div>
        </AnimatedCard>

        <AnimatedCard className="stat-card" delay={0.4}>
          <div className="stat-icon"><Eye className="w-6 h-6 text-gray-400" /></div>
          <div className="stat-number">{stats.ignored}</div>
          <div className="stat-label">Ignored</div>
        </AnimatedCard>

        {stats.suspicious > 0 && (
          <AnimatedCard className="stat-card suspicious" delay={0.5}>
            <div className="stat-icon"><AlertTriangle className="w-6 h-6 text-orange-500" /></div>
            <div className="stat-number">{stats.suspicious}</div>
            <div className="stat-label">Suspicious</div>
          </AnimatedCard>
        )}
      </motion.div>

      {aiAnalysis && (
        <motion.div className="ai-analysis-summary" variants={itemVariants}>
          <div className="analysis-header">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            <h3>AI Security Analysis</h3>
          </div>
          <div className="analysis-content">
            <div className="analysis-stat">
              <span className="stat-value">{aiAnalysis.suspiciousPercentage}%</span>
              <span className="stat-desc">Suspicious Services</span>
            </div>
            {aiAnalysis.recommendations.slice(0, 2).map((rec, index) => (
              <div key={index} className={`recommendation ${rec.type}`}>
                <AlertTriangle className="w-4 h-4" />
                <span>{rec.message}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div className="search-section" variants={itemVariants}>
        <SearchBar
          onSearch={handleSearch}
          onFilter={handleFilter}
          onSort={handleSort}
          filters={searchFilters}
          sortOptions={sortOptions}
          placeholder="Search services by name, domain, or email..."
        />
      </motion.div>

      <motion.div className="view-mode-tabs" variants={itemVariants}>
        {[
          { id: 'all', label: 'All Services', count: services.length },
          { id: 'active', label: 'Active', count: stats.active },
          { id: 'managed', label: 'Managed', count: stats.unsubscribed + stats.ignored },
          { id: 'suspicious', label: 'Suspicious', count: stats.suspicious }
        ].map((tab) => (
          <motion.button
            key={tab.id}
            onClick={() => setViewMode(tab.id)}
            className={`view-tab ${viewMode === tab.id ? 'active' : ''}`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {tab.label}
            <span className="tab-count">{tab.count}</span>
          </motion.button>
        ))}
      </motion.div>

      <div className="dashboard-info">
        <p className="last-scan">
          <strong>Last scan:</strong> {formatLastScan(lastScan)} •
          <strong> Showing:</strong> {displayServices.length} of {services.length} services
        </p>
      </div>

      {error && (
        <motion.div className="error-banner" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <span>❌ {error}</span>
          <button onClick={loadSavedServices}>Retry</button>
        </motion.div>
      )}

      {loading && (
        <motion.div className="loading-banner" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <LoadingSpinner size="md" color="primary" />
          <span>🔍 Scanning your emails for services...</span>
        </motion.div>
      )}

      {!loading && services.length === 0 && (
        <motion.div className="empty-state" variants={itemVariants}>
          <div className="empty-icon">📭</div>
          <h3>No Services Found</h3>
          <p>Click "Refresh Services" to scan your emails for signup services.</p>
          <motion.button className="refresh-btn" onClick={refreshServices} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            🔍 Start Scanning
          </motion.button>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {displayServices.length > 0 && (
          <motion.div className="services-section" variants={itemVariants} key={viewMode}>
            <motion.h2 className="section-title" variants={itemVariants}>
              {viewMode === 'all' && `📧 All Services (${displayServices.length})`}
              {viewMode === 'active' && `🔴 Active Services (${displayServices.length})`}
              {viewMode === 'managed' && `✅ Managed Services (${displayServices.length})`}
              {viewMode === 'suspicious' && `⚠️ Suspicious Services (${displayServices.length})`}
            </motion.h2>

            <motion.div className="services-grid" variants={containerVariants} initial="hidden" animate="visible">
              <AnimatePresence>
                {displayServices.map((service, index) => (
                  <ServiceCard
                    key={service.domain || index}
                    platform={service.platform}
                    email={service.email}
                    domain={service.domain}
                    subject={service.subject}
                    date={service.date}
                    suspicious={service.suspicious || service.suspiciousAnalysis?.isSuspicious}
                    unsubscribed={service.unsubscribed}
                    ignored={service.ignored}
                    onUnsubscribe={handleUnsubscribe}
                    onIgnore={handleIgnore}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default Dashboard;
=======
{"code":"rate-limited","message":"You have hit the rate limit. Please upgrade to keep chatting.","providerLimitHit":false,"isRetryable":true}
>>>>>>> 2a63b5ef8fb2e0fba5897b9255366c028fd10bf4
