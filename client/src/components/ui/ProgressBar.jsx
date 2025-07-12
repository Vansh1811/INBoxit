import React from 'react';
import { motion } from 'framer-motion';

const ProgressBar = ({ 
  progress = 0, 
  className = "",
  color = "blue",
  size = "md",
  showPercentage = true,
  animated = true,
  label = null
}) => {
  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  };

  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500',
    indigo: 'bg-indigo-500'
  };

  const progressVariants = {
    initial: { width: 0 },
    animate: { 
      width: `${Math.min(Math.max(progress, 0), 100)}%`,
      transition: {
        duration: animated ? 1 : 0,
        ease: "easeOut"
      }
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && (
            <span className="text-sm font-medium text-gray-700">{label}</span>
          )}
          {showPercentage && (
            <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
          )}
        </div>
      )}
      
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <motion.div
          className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full`}
          variants={progressVariants}
          initial="initial"
          animate="animate"
        />
      </div>
    </div>
  );
};

export default ProgressBar;