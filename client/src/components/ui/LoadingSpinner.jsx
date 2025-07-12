import React from 'react';
import { motion } from 'framer-motion';

const LoadingSpinner = ({ 
  size = 'md', 
  color = 'primary', 
  text = null,
  className = '',
  fullScreen = false 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const colorClasses = {
    primary: 'border-blue-500',
    secondary: 'border-gray-500',
    success: 'border-green-500',
    warning: 'border-yellow-500',
    error: 'border-red-500',
  };

  const spinnerVariants = {
    animate: {
      rotate: 360,
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: "linear"
      }
    }
  };

  const containerVariants = {
    initial: { opacity: 0 },
    animate: { 
      opacity: 1,
      transition: { duration: 0.3 }
    }
  };

  const Spinner = () => (
    <motion.div
      className={`
        ${sizeClasses[size]} 
        border-2 border-gray-200 
        ${colorClasses[color]} 
        border-t-transparent 
        rounded-full
        ${className}
      `}
      variants={spinnerVariants}
      animate="animate"
    />
  );

  if (fullScreen) {
    return (
      <motion.div
        className="fixed inset-0 bg-white bg-opacity-80 backdrop-blur-sm z-50 flex items-center justify-center"
        variants={containerVariants}
        initial="initial"
        animate="animate"
      >
        <div className="flex flex-col items-center gap-4">
          <Spinner />
          {text && (
            <motion.p
              className="text-gray-600 font-medium"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {text}
            </motion.p>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="flex items-center gap-3"
      variants={containerVariants}
      initial="initial"
      animate="animate"
    >
      <Spinner />
      {text && (
        <span className="text-gray-600 font-medium">{text}</span>
      )}
    </motion.div>
  );
};

export default LoadingSpinner;