import React, { useEffect, useRef, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';
import { motion } from 'framer-motion';
import LoadingSpinner from './LoadingSpinner';

const InfiniteScroll = ({
  children,
  hasMore = false,
  loading = false,
  onLoadMore,
  threshold = 0.1,
  rootMargin = '100px',
  className = "",
  loadingComponent = null,
  endMessage = null
}) => {
  const { ref, inView } = useInView({
    threshold,
    rootMargin,
    triggerOnce: false
  });

  const loadMoreRef = useRef(onLoadMore);
  loadMoreRef.current = onLoadMore;

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loading && loadMoreRef.current) {
      loadMoreRef.current();
    }
  }, [hasMore, loading]);

  useEffect(() => {
    if (inView) {
      handleLoadMore();
    }
  }, [inView, handleLoadMore]);

  const LoadingComponent = loadingComponent || (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex justify-center items-center py-8"
    >
      <LoadingSpinner size="md" text="Loading more services..." />
    </motion.div>
  );

  const EndMessage = endMessage || (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-8 text-gray-500 dark:text-gray-400"
    >
      <div className="text-4xl mb-2">🎉</div>
      <p className="font-medium">You've reached the end!</p>
      <p className="text-sm">All services have been loaded.</p>
    </motion.div>
  );

  return (
    <div className={className}>
      {children}
      
      {/* Intersection Observer Target */}
      <div ref={ref} className="h-1" />
      
      {/* Loading State */}
      {loading && LoadingComponent}
      
      {/* End Message */}
      {!hasMore && !loading && EndMessage}
    </div>
  );
};

export default InfiniteScroll;