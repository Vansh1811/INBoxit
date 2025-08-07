import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, Mail, Calendar, AlertCircle, RefreshCw } from 'lucide-react';
import LoadingSpinner from './ui/LoadingSpinner';
import { showToast } from './ui/Toast';
import apiService from '../services/api';
import './DeletionHistory.css';

function DeletionHistory({ isOpen, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0
  });

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, pagination.currentPage]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const response = await apiService.getDeletionHistory(pagination.currentPage);
      setHistory(response.history || []);
      setPagination(response.pagination || {
        currentPage: 1,
        totalPages: 1,
        totalCount: 0
      });
    } catch (error) {
      console.error('Failed to load deletion history:', error);
      showToast.error('Failed to load deletion history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffHours < 1) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
      }
      if (diffHours < 24) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
      }
      if (diffDays < 7) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
      }
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  const getTotalDeleted = () => {
    return history.reduce((sum, item) => sum + (item.deletedCount || 0), 0);
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, currentPage: newPage }));
  };

  const modalVariants = {
    hidden: { opacity: 0, x: '100%' },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { type: 'spring', damping: 25, stiffness: 300 }
    },
    exit: { 
      opacity: 0, 
      x: '100%',
      transition: { duration: 0.2 }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            className="deletion-history-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="deletion-history-panel"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="deletion-history-header">
              <div className="header-title">
                <History className="w-5 h-5" />
                <h2>Deletion History</h2>
              </div>
              <button className="close-btn" onClick={onClose}>×</button>
            </div>

            <div className="deletion-history-stats">
              <div className="stat-card">
                <Mail className="stat-icon" />
                <div className="stat-content">
                  <span className="stat-value">{getTotalDeleted()}</span>
                  <span className="stat-label">Total Emails Deleted</span>
                </div>
              </div>
              <div className="stat-card">
                <Calendar className="stat-icon" />
                <div className="stat-content">
                  <span className="stat-value">{history.length}</span>
                  <span className="stat-label">Deletion Actions</span>
                </div>
              </div>
            </div>

            <div className="deletion-history-content">
              {loading ? (
                <div className="loading-state">
                  <LoadingSpinner size="md" />
                  <p>Loading deletion history...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="empty-state">
                  <AlertCircle className="empty-icon" />
                  <h3>No Deletion History</h3>
                  <p>You haven't deleted any emails yet.</p>
                </div>
              ) : (
                <div className="history-list">
                  {history.map((item, index) => (
                    <motion.div
                      key={item._id || index}
                      className="history-item"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <div className="history-item-header">
                        <span className="domain">{item.domain}</span>
                        <span className="date">{formatDate(item.deletedAt)}</span>
                      </div>
                      <div className="history-item-stats">
                        <span className="deleted-count">
                          <Mail className="w-4 h-4" />
                          {item.deletedCount} deleted
                        </span>
                        {item.errorCount > 0 && (
                          <span className="error-count">
                            <AlertCircle className="w-4 h-4" />
                            {item.errorCount} errors
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {!loading && pagination.totalPages > 1 && (
                <div className="pagination">
                  <button
                    disabled={pagination.currentPage === 1}
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                  >
                    Previous
                  </button>
                  <span className="page-info">
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </span>
                  <button
                    disabled={pagination.currentPage === pagination.totalPages}
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            <div className="deletion-history-footer">
              <button className="refresh-btn" onClick={loadHistory} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'spinning' : ''}`} />
                Refresh
              </button>
              <button className="close-footer-btn" onClick={onClose}>
                Close
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default DeletionHistory;
