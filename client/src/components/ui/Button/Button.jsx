import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import './Button.css';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon = null,
  rightIcon = null,
  fullWidth = false,
  className = '',
  onClick,
  type = 'button',
  ...props
}) => {
  const baseClasses = 'btn';
  const variantClasses = `btn--${variant}`;
  const sizeClasses = `btn--${size}`;
  const fullWidthClass = fullWidth ? 'btn--full-width' : '';
  const disabledClass = (disabled || loading) ? 'btn--disabled' : '';

  const buttonClasses = [
    baseClasses,
    variantClasses,
    sizeClasses,
    fullWidthClass,
    disabledClass,
    className
  ].filter(Boolean).join(' ');

  const handleClick = (e) => {
    if (disabled || loading) return;
    onClick?.(e);
  };

  return (
    <motion.button
      className={buttonClasses}
      onClick={handleClick}
      disabled={disabled || loading}
      type={type}
      whileHover={!disabled && !loading ? { scale: 1.02 } : undefined}
      whileTap={!disabled && !loading ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.15 }}
      {...props}
    >
      {loading && (
        <Loader2 
          className="btn__spinner" 
          size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16}
        />
      )}
      
      {!loading && leftIcon && (
        <span className="btn__icon btn__icon--left">
          {leftIcon}
        </span>
      )}
      
      <span className="btn__content">
        {children}
      </span>
      
      {!loading && rightIcon && (
        <span className="btn__icon btn__icon--right">
          {rightIcon}
        </span>
      )}
    </motion.button>
  );
};

export default Button;