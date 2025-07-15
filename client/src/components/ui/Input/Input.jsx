import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import './Input.css';

const Input = forwardRef(({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  onBlur,
  onFocus,
  error,
  success,
  helperText,
  required = false,
  disabled = false,
  leftIcon = null,
  rightIcon = null,
  size = 'md',
  fullWidth = false,
  className = '',
  id,
  name,
  autoComplete,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  const handleFocus = (e) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Build CSS classes
  const containerClasses = [
    'input-container',
    size && `input-container--${size}`,
    fullWidth && 'input-container--full-width',
    disabled && 'input-container--disabled',
    error && 'input-container--error',
    success && 'input-container--success',
    isFocused && 'input-container--focused',
    className
  ].filter(Boolean).join(' ');

  const inputClasses = [
    'input',
    leftIcon && 'input--has-left-icon',
    (rightIcon || isPassword || error || success) && 'input--has-right-icon'
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
          {required && <span className="input-label__required">*</span>}
        </label>
      )}
      
      <div className="input-wrapper">
        {leftIcon && (
          <div className="input-icon input-icon--left">
            {leftIcon}
          </div>
        )}
        
        <input
          ref={ref}
          id={inputId}
          name={name}
          type={inputType}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          className={inputClasses}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={
            [
              error && `${inputId}-error`,
              success && `${inputId}-success`,
              helperText && `${inputId}-helper`
            ].filter(Boolean).join(' ') || undefined
          }
          {...props}
        />
        
        <div className="input-icon input-icon--right">
          {isPassword && (
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="input-password-toggle"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
          
          {!isPassword && error && (
            <AlertCircle size={16} className="input-status-icon input-status-icon--error" />
          )}
          
          {!isPassword && success && (
            <CheckCircle size={16} className="input-status-icon input-status-icon--success" />
          )}
          
          {!isPassword && !error && !success && rightIcon && rightIcon}
        </div>
      </div>
      
      {(error || success || helperText) && (
        <div className="input-feedback">
          {error && (
            <div id={`${inputId}-error`} className="input-feedback__error">
              {error}
            </div>
          )}
          
          {success && !error && (
            <div id={`${inputId}-success`} className="input-feedback__success">
              {success}
            </div>
          )}
          
          {helperText && !error && !success && (
            <div id={`${inputId}-helper`} className="input-feedback__helper">
              {helperText}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;