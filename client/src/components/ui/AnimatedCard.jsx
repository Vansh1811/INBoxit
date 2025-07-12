import React from 'react';
import { motion } from 'framer-motion';

const AnimatedCard = ({ 
  children, 
  className = "",
  hover = true,
  tap = true,
  delay = 0,
  direction = "up",
  ...props 
}) => {
  const directions = {
    up: { y: 20 },
    down: { y: -20 },
    left: { x: 20 },
    right: { x: -20 },
    scale: { scale: 0.95 }
  };

  const cardVariants = {
    hidden: {
      opacity: 0,
      ...directions[direction]
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.5,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  };

  const hoverVariants = hover ? {
    scale: 1.02,
    y: -4,
    transition: {
      duration: 0.2,
      ease: "easeOut"
    }
  } : {};

  const tapVariants = tap ? {
    scale: 0.98,
    transition: {
      duration: 0.1
    }
  } : {};

  return (
    <motion.div
      className={`${className}`}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={hoverVariants}
      whileTap={tapVariants}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default AnimatedCard;