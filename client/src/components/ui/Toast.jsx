import React from 'react';
import { Toaster, toast } from 'react-hot-toast';

// Custom toast configuration with premium styling
export const toastConfig = {
  duration: 4000,
  position: 'top-right',
  style: {
    background: '#ffffff',
    color: '#1a202c',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
    padding: '16px 20px',
    fontSize: '14px',
    fontWeight: '500',
    maxWidth: '400px',
  },
  success: {
    iconTheme: {
      primary: '#10b981',
      secondary: '#ffffff',
    },
    style: {
      borderLeft: '4px solid #10b981',
    },
  },
  error: {
    iconTheme: {
      primary: '#ef4444',
      secondary: '#ffffff',
    },
    style: {
      borderLeft: '4px solid #ef4444',
    },
  },
  loading: {
    iconTheme: {
      primary: '#3b82f6',
      secondary: '#ffffff',
    },
    style: {
      borderLeft: '4px solid #3b82f6',
    },
  },
};

// Enhanced toast functions with consistent messaging
export const showToast = {
  success: (message, options = {}) => {
    toast.success(message, {
      ...toastConfig.success,
      ...options,
    });
  },
  
  error: (message, options = {}) => {
    toast.error(message, {
      ...toastConfig.error,
      ...options,
    });
  },
  
  loading: (message, options = {}) => {
    return toast.loading(message, {
      ...toastConfig.loading,
      ...options,
    });
  },
  
  promise: (promise, messages) => {
    return toast.promise(promise, {
      loading: messages.loading || 'Processing...',
      success: messages.success || 'Success!',
      error: messages.error || 'Something went wrong',
    }, toastConfig);
  },
  
  dismiss: (toastId) => {
    toast.dismiss(toastId);
  },
  
  dismissAll: () => {
    toast.dismiss();
  },
};

// Toast container component
export function ToastContainer() {
  return (
    <Toaster
      position={toastConfig.position}
      toastOptions={toastConfig}
      containerStyle={{
        top: 20,
        right: 20,
      }}
    />
  );
}

export default ToastContainer;