import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, Calendar, User, X, Trash2, Eye } from 'lucide-react';
import Modal from './ui/Modal/Modal';
import LoadingSpinner from './ui/LoadingSpinner';
import apiService from '../services/api';
import './EmailPreview.css';

function EmailPreview({ isOpen, onClose, domain, platform, onConfirmDelete }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState([]);

  useEffect(() => {
    if (isOpen && domain) {
      loadEmailPreview();
    }
  }, [isOpen, domain]);

  const loadEmailPreview = async () => {
    setLoading(true);
    try {
      // This would need a new backend endpoint
      const preview = await apiService.getEmailPreview(domain, 10);
      setEmails(preview.emails || []);
    } catch (error) {
      console.error('Failed to load email preview:', error);
      // Mock data for demonstration
      setEmails([
        {
          id: '1',
          subject: `Welcome to ${platform}!`,
          from: `noreply@${domain}`,
          date: new Date().toISOString(),
          snippet: 'Thank you for signing up...'
        },
        {
          id: '2', 
          subject: `${platform} Weekly Newsletter`,
          from: `updates@${domain}`,
          date: new Date(Date.now() - 86400000).toISOString(),
          snippet: 'Check out this week\'s highlights...'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedEmails.length === emails.length) {
      setSelectedEmails([]);
    } else {
      setSelectedEmails(emails.map(e => e.id));
    }
  };

  const handleConfirm = () => {
    onConfirmDelete(selectedEmails.length || emails.length);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Preview Emails from ${platform}`}
      size="large"
      type="info"
    >
      <div className="email-preview-container">
        {loading ? (
          <div className="preview-loading">
            <LoadingSpinner size="md" />
            <p>Loading email preview...</p>
          </div>
        ) : (
          <>
            <div className="preview-header">
              <p className="preview-info">
                <Mail className="w-4 h-4" />
                Showing {emails.length} recent emails from {domain}
              </p>
              <button className="select-all-btn" onClick={handleSelectAll}>
                {selectedEmails.length === emails.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="email-list">
              {emails.map((email) => (
                <motion.div
                  key={email.id}
                  className={`email-item ${selectedEmails.includes(email.id) ? 'selected' : ''}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ x: 4 }}
                >
                  <input
                    type="checkbox"
                    checked={selectedEmails.includes(email.id)}
                    onChange={() => {
                      if (selectedEmails.includes(email.id)) {
                        setSelectedEmails(prev => prev.filter(id => id !== email.id));
                      } else {
                        setSelectedEmails(prev => [...prev, email.id]);
                      }
                    }}
                  />
                  <div className="email-content">
                    <div className="email-subject">{email.subject}</div>
                    <div className="email-meta">
                      <span><User className="w-3 h-3" /> {email.from}</span>
                      <span><Calendar className="w-3 h-3" /> {new Date(email.date).toLocaleDateString()}</span>
                    </div>
                    <div className="email-snippet">{email.snippet}</div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="preview-footer">
              <div className="deletion-warning">
                ⚠️ Emails will be moved to trash and permanently deleted after 30 days
              </div>
              <div className="preview-actions">
                <button className="btn-cancel" onClick={onClose}>
                  Cancel
                </button>
                <button className="btn-delete" onClick={handleConfirm}>
                  <Trash2 className="w-4 h-4" />
                  Delete {selectedEmails.length || emails.length} Emails
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default EmailPreview;
