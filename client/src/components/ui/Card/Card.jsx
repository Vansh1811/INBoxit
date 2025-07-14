import React from 'react';
import { motion } from 'framer-motion';
import './Card.css';

const Card = ({
  children,
  variant = 'default',
  padding = 'md',
  shadow = 'md',
  hover = false,
  interactive = false,
  className = '',
  onClick,
  ...props
}) => {
  const cardClasses = [
    'card',
    `card--${variant}`,
    `card--padding-${padding}`,
    `card--shadow-${shadow}`,
    hover && 'card--hover',
    interactive && 'card--interactive',
    onClick && 'card--clickable',
    className
  ].filter(Boolean).join(' ');

  const MotionComponent = interactive || onClick ? motion.div : 'div';
  
  const motionProps = (interactive || onClick) ? {
    whileHover: hover ? { y: -4, scale: 1.02 } : { scale: 1.02 },
    whileTap: { scale: 0.98 },
    transition: { duration: 0.2, ease: 'easeOut' }
  } : {};

  return (
    <MotionComponent
      className={cardClasses}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(e);
        }
      } : undefined}
      {...motionProps}
      {...props}
    >
      {children}
    </MotionComponent>
  );
};

// Card sub-components
const CardHeader = ({ children, className = '', ...props }) => (
  <div className={`card__header ${className}`} {...props}>
    {children}
  </div>
);

const CardBody = ({ children, className = '', ...props }) => (
  <div className={`card__body ${className}`} {...props}>
    {children}
  </div>
);

const CardFooter = ({ children, className = '', ...props }) => (
  <div className={`card__footer ${className}`} {...props}>
    {children}
  </div>
);

const CardTitle = ({ children, level = 3, className = '', ...props }) => {
  const Tag = `h${level}`;
  return (
    <Tag className={`card__title ${className}`} {...props}>
      {children}
    </Tag>
  );
};

const CardDescription = ({ children, className = '', ...props }) => (
  <p className={`card__description ${className}`} {...props}>
    {children}
  </p>
);

// Attach sub-components
Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
Card.Title = CardTitle;
Card.Description = CardDescription;

export default Card;