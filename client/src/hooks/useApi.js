import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';

// Custom hook for API calls with loading, error, and retry logic
export function useApi(apiCall, dependencies = [], options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  const {
    immediate = true,
    onSuccess,
    onError,
    retryCount = 3,
    retryDelay = 1000
  } = options;

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiCall(...args);
      setData(result);
      setLastFetch(new Date());
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      return result;
    } catch (err) {
      setError(err.message || 'An error occurred');
      
      if (onError) {
        onError(err);
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiCall, onSuccess, onError]);

  const retry = useCallback(() => {
    execute();
  }, [execute]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, dependencies);

  return {
    data,
    loading,
    error,
    execute,
    retry,
    lastFetch
  };
}

// Hook for paginated data
export function usePaginatedApi(apiCall, initialPage = 1, initialLimit = 50) {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [allData, setAllData] = useState([]);
  const [hasMore, setHasMore] = useState(true);

  const { data, loading, error, execute } = useApi(
    () => apiCall(page, limit),
    [page, limit],
    {
      onSuccess: (result) => {
        if (page === 1) {
          setAllData(result.services || []);
        } else {
          setAllData(prev => [...prev, ...(result.services || [])]);
        }
        setHasMore(result.hasMore || false);
      }
    }
  );

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  }, [loading, hasMore]);

  const refresh = useCallback(() => {
    setPage(1);
    setAllData([]);
    setHasMore(true);
  }, []);

  return {
    data: allData,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    page,
    setLimit
  };
}

// Hook for services management
export function useServices() {
  const [services, setServices] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    unsubscribed: 0,
    ignored: 0,
    suspicious: 0
  });

  const {
    data,
    loading,
    error,
    execute: fetchServices,
    retry
  } = useApi(
    apiService.getSavedServices,
    [],
    {
      onSuccess: (result) => {
        setServices(result.services || []);
        updateStats(result.services || []);
      }
    }
  );

  const updateStats = useCallback((serviceList) => {
    const total = serviceList.length;
    const active = serviceList.filter(s => !s.unsubscribed && !s.ignored).length;
    const unsubscribed = serviceList.filter(s => s.unsubscribed).length;
    const ignored = serviceList.filter(s => s.ignored).length;
    const suspicious = serviceList.filter(s => s.suspicious).length;

    setStats({ total, active, unsubscribed, ignored, suspicious });
  }, []);

  const updateService = useCallback(async (domain, action) => {
    try {
      await apiService.updateServiceStatus(domain, action);
      
      // Update local state
      setServices(prev => prev.map(service => 
        service.domain === domain 
          ? { 
              ...service, 
              [action]: true,
              [`${action}At`]: new Date().toISOString()
            }
          : service
      ));
      
      // Recalculate stats
      const updatedServices = services.map(service => 
        service.domain === domain 
          ? { ...service, [action]: true }
          : service
      );
      updateStats(updatedServices);
      
      return true;
    } catch (error) {
      console.error(`Failed to ${action} service:`, error);
      throw error;
    }
  }, [services, updateStats]);

  const refreshServices = useCallback(async () => {
    try {
      const result = await apiService.refreshSignupServices();
      setServices(result.services || []);
      updateStats(result.services || []);
      return result;
    } catch (error) {
      console.error('Failed to refresh services:', error);
      throw error;
    }
  }, [updateStats]);

  const batchUpdate = useCallback(async (updates) => {
    try {
      const result = await apiService.batchUpdateServices(updates);
      
      // Refresh services after batch update
      await fetchServices();
      
      return result;
    } catch (error) {
      console.error('Batch update failed:', error);
      throw error;
    }
  }, [fetchServices]);

  return {
    services,
    stats,
    loading,
    error,
    updateService,
    refreshServices,
    batchUpdate,
    retry,
    refetch: fetchServices
  };
}