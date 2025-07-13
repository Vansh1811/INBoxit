import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Filter, BarChart3, TrendingUp, AlertTriangle, CheckCircle, 
  Eye, EyeOff, Settings as SettingsIcon, LogOut, User, Mail
} from 'lucide-react';
import ServiceCard from '../components/ServiceCard';
import SearchBar from '../components/ui/SearchBar';
import Pagination from '../components/ui/Pagination';
import InfiniteScroll from '../components/ui/InfiniteScroll';
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
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastScan, setLastScan] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [viewMode, setViewMode] = useLocalStorage('dashboard-view-mode', 'all');
  const [paginationMode, setPaginationMode] = useLocalStorage('pagination-mode', 'pagination'); // 'pagination' or 'infinite'
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [scanProgress, setScanProgress] = useState(0);
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useLocalStorage('darkMode', false);

  // Load user info
  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const userData = await apiService.checkLoginStatus();
      setUser(userData);
    } catch (error) {
      console.error('Failed to load user info:', error);
    }
  };

  const handleLogout = () => {
    window.location.href = 'http://localhost:5000/auth/logout';
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark', !darkMode);
  };

  // Search and filter configuration
  const searchFilters = [
    { id: 'active', label: 'Active Services', count: services.filter(s => !s.unsubscribed && !s.ignored).length },
    { id: 'unsubscribed', label: 'Unsubscribed', count: services.filter(s => s.unsubscribed).length },
    { id: 'ignored', label: 'Ignored', count: services.filter(s => s.ignored).length },
    { id: 'suspicious', label: 'Suspicious', count: services.filter(s => s.suspicious).length },
    { id: 'recent', label: 'Recent (7 days)', count: services.filter(s => {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      return new Date(s.date) > oneWeekAgo;
    }).length }
  ];

  const sortOptions = [
    { value: 'platform', label: 'Platform Name' },
    { value: 'date', label: 'Date Received' },
    { value: 'domain', label: 'Domain' },
    { value: 'suspicious', label: 'Suspicious Score' }
  ];

  // Use search hook for filtering and sorting
  const {
    results: filteredServices,
    handleSearch,
    handleFilter,
    handleSort,
    stats: searchStats
  } = useSearch(services, {
    searchFields: ['platform', 'domain', 'email', 'subject']
  });

  useEffect(() => {
    loadSavedServices();
  }, []);

  useEffect(() => {
    if (services.length > 0) {
      performAIAnalysis();
    }
  }, [services]);

  const performAIAnalysis = async () => {
    try {
      const analyzedServices = suspiciousEmailDetector.batchAnalyze(services);
      const summary = suspiciousEmailDetector.getAnalysisSummary(analyzedServices);
      setAiAnalysis(summary);
      
      // Update services with analysis
      setServices(prev => prev.map(service => {
        const analyzed = analyzedServices.find(a => a.domain === service.domain);
        return analyzed ? { ...service, suspiciousAnalysis: analyzed.suspiciousAnalysis } : service;
      }));
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
      
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setScanProgress(prev => Math.min(prev + 10, 90));
      }, 200);
      
      const data = await apiService.fetchSignupServices();
      clearInterval(progressInterval);
      setScanProgress(100);
      
      setServices(data.services || []);
      setLastScan(data.lastScan);
      
      // Show success message
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
    try {
      await apiService.updateServiceStatus(domain, action || 'unsubscribe');
      
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
  
  // Pagination logic
  const totalPages = Math.ceil(displayServices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedServices = paginationMode === 'pagination' 
    ? displayServices.slice(startIndex, startIndex + itemsPerPage)
    : displayServices.slice(0, currentPage * itemsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadMoreServices = () => {
    if (currentPage * itemsPerPage < displayServices.length) {
      setCurrentPage(prev => prev + 1);
    }
  };
  
  // Calculate comprehensive stats
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
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      className="dashboard"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <ToastContainer />
      
      <div className="dashboard-header">
        {/* User Info & Controls */}
        <div className="user-controls">
          {user && (
            <div className="user-info">
              <div className="user-avatar">
                <User className="w-5 h-5" />
              </div>
              <div className="user-details">
                <span className="user-name">{user.name || user.email}</span>
                <span className="user-email">{user.email}</span>
              </div>
            </div>
          )}
          
          <div className="header-actions">
            <Link to="/settings" className="icon-button">
              <SettingsIcon className="w-5 h-5" />
            </Link>
            <button onClick={toggleDarkMode} className="icon-button">
              {darkMode ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            </button>
            <button onClick={handleLogout} className="icon-button logout">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="header-content">
          <motion.h1 
            className="dashboard-title"
            variants={itemVariants}
          >
            📧 Email Services Dashboard
          </motion.h1>
          <motion.p 
            className="dashboard-subtitle"
            variants={itemVariants}
          >
            AI-powered email subscription management
          </motion.p>
        </div>
        
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

      {/* Progress Bar for Scanning */}
      <AnimatePresence>
        {scanProgress > 0 && scanProgress < 100 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6"
          >
            <ProgressBar 
              progress={scanProgress} 
              label="Scanning emails..." 
              color="blue"
              animated={true}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enhanced Stats Cards */}
      <motion.div 
        className="dashboard-stats"
        variants={itemVariants}
      >
        <AnimatedCard className="stat-card" delay={0.1}>
          <div className="stat-icon">
            <BarChart3 className="w-6 h-6 text-blue-500" />
          </div>
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Total Services</div>
        </AnimatedCard>
        
        <AnimatedCard className="stat-card" delay={0.2}>
          <div className="stat-icon">
            <CheckCircle className="w-6 h-6 text-green-500" />
          </div>
          <div className="stat-number">{stats.active}</div>
          <div className="stat-label">Active</div>
        </AnimatedCard>
        
        <AnimatedCard className="stat-card" delay={0.3}>
          <div className="stat-icon">
            <EyeOff className="w-6 h-6 text-gray-500" />
          </div>
          <div className="stat-number">{stats.unsubscribed}</div>
          <div className="stat-label">Unsubscribed</div>
        </AnimatedCard>
        
        <AnimatedCard className="stat-card" delay={0.4}>
          <div className="stat-icon">
            <Eye className="w-6 h-6 text-gray-400" />
          </div>
          <div className="stat-number">{stats.ignored}</div>
          <div className="stat-label">Ignored</div>
        </AnimatedCard>
        
        {stats.suspicious > 0 && (
          <AnimatedCard className="stat-card suspicious" delay={0.5}>
            <div className="stat-icon">
              <AlertTriangle className="w-6 h-6 text-orange-500" />
            </div>
            <div className="stat-number">{stats.suspicious}</div>
            <div className="stat-label">Suspicious</div>
          </AnimatedCard>
        )}
      </motion.div>

      {/* AI Analysis Summary */}
      {aiAnalysis && (
        <motion.div 
          className="ai-analysis-summary"
          variants={itemVariants}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="analysis-header">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            <h3>AI Security Analysis</h3>
          </div>
          <div className="analysis-content">
            <div className="analysis-stat">
              <span className="stat-value">{aiAnalysis.suspiciousPercentage}%</span>
              <span className="stat-desc">Suspicious Services</span>
            </div>
            {aiAnalysis.recommendations.length > 0 && (
              <div className="recommendations">
                {aiAnalysis.recommendations.slice(0, 2).map((rec, index) => (
                  <div key={index} className={`recommendation ${rec.type}`}>
                    <AlertTriangle className="w-4 h-4" />
                    <span>{rec.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Search and Filter Bar */}
      <motion.div 
        className="search-section"
        variants={itemVariants}
      >
        <SearchBar
          onSearch={handleSearch}
          onFilter={handleFilter}
          onSort={handleSort}
          filters={searchFilters}
          sortOptions={sortOptions}
          placeholder="Search services by name, domain, or email..."
        />
      </motion.div>

      {/* View Mode Tabs */}
      <motion.div 
        className="view-mode-tabs"
        variants={itemVariants}
      >
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

      {/* Pagination Mode Toggle */}
      <motion.div 
        className="pagination-controls"
        variants={itemVariants}
      >
        <div className="pagination-mode-toggle">
          <button
            onClick={() => setPaginationMode('pagination')}
            className={`mode-btn ${paginationMode === 'pagination' ? 'active' : ''}`}
          >
            Pages
          </button>
          <button
            onClick={() => setPaginationMode('infinite')}
            className={`mode-btn ${paginationMode === 'infinite' ? 'active' : ''}`}
          >
            Infinite Scroll
          </button>
        </div>
        
        <div className="results-info">
          Showing {paginatedServices.length} of {displayServices.length} services
        </div>
      </motion.div>

      <div className="dashboard-info">
        <p className="last-scan">
          <strong>Last scan:</strong> {formatLastScan(lastScan)} • 
          <strong> Total services:</strong> {services.length}
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <motion.div 
          className="error-banner"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span>❌ {error}</span>
          <button onClick={loadSavedServices}>Retry</button>
        </motion.div>
      )}

      {/* Loading Banner */}
      {loading && (
        <motion.div 
          className="loading-banner"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <LoadingSpinner size="md" color="primary" />
          <span>🔍 Scanning your emails for services...</span>
        </motion.div>
      )}

      {/* Empty State */}
      {!loading && services.length === 0 && (
        <motion.div 
          className="empty-state"
          variants={itemVariants}
        >
          <div className="empty-icon">📭</div>
          <h3>No Services Found</h3>
          <p>Click "Refresh Services" to scan your emails for signup services.</p>
          <motion.button 
            className="refresh-btn" 
            onClick={refreshServices}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            🔍 Start Scanning
          </motion.button>
        </motion.div>
      )}

      {/* Services Grid */}
      {paginationMode === 'pagination' ? (
        <AnimatePresence mode="wait">
          {paginatedServices.length > 0 && (
            <motion.div 
              className="services-section"
              variants={itemVariants}
              key={viewMode}
            >
              <motion.h2 
                className="section-title"
                variants={itemVariants}
              >
                {viewMode === 'all' && `📧 All Services (${displayServices.length})`}
                {viewMode === 'active' && `🔴 Active Services (${displayServices.length})`}
                {viewMode === 'managed' && `✅ Managed Services (${displayServices.length})`}
                {viewMode === 'suspicious' && `⚠️ Suspicious Services (${displayServices.length})`}
              </motion.h2>
              
              <motion.div 
                className="services-grid"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                <AnimatePresence>
                  {paginatedServices.map((service, index) => (
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
              
              {/* Pagination */}
              {totalPages > 1 && (
                <motion.div 
                  className="pagination-wrapper"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    className="dashboard-pagination"
                  />
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        // Infinite Scroll Mode
        <AnimatePresence mode="wait">
          {displayServices.length > 0 && (
            <motion.div 
              className="services-section"
              variants={itemVariants}
              key={viewMode}
            >
              <motion.h2 
                className="section-title"
                variants={itemVariants}
              >
                {viewMode === 'all' && `📧 All Services (${displayServices.length})`}
                {viewMode === 'active' && `🔴 Active Services (${displayServices.length})`}
                {viewMode === 'managed' && `✅ Managed Services (${displayServices.length})`}
                {viewMode === 'suspicious' && `⚠️ Suspicious Services (${displayServices.length})`}
              </motion.h2>
              
              <InfiniteScroll
                hasMore={currentPage * itemsPerPage < displayServices.length}
                loading={false}
                onLoadMore={loadMoreServices}
                className="infinite-scroll-container"
              >
                <motion.div 
                  className="services-grid"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <AnimatePresence>
                    {paginatedServices.map((service, index) => (
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
              </InfiniteScroll>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </motion.div>
  );
}

export default Dashboard;