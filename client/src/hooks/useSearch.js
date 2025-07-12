import { useState, useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';

export function useSearch(data, searchOptions = {}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState([]);
  const [sortConfig, setSortConfig] = useState({ field: '', order: 'asc' });

  // Configure Fuse.js for fuzzy search
  const fuseOptions = {
    threshold: 0.3, // Lower = more strict matching
    keys: searchOptions.searchFields || ['platform', 'domain', 'email'],
    includeScore: true,
    includeMatches: true,
    ...searchOptions.fuseOptions
  };

  const fuse = useMemo(() => {
    return new Fuse(data || [], fuseOptions);
  }, [data, fuseOptions]);

  // Search functionality
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) {
      return data || [];
    }

    const results = fuse.search(searchTerm);
    return results.map(result => ({
      ...result.item,
      _searchScore: result.score,
      _searchMatches: result.matches
    }));
  }, [fuse, searchTerm, data]);

  // Filter functionality
  const filteredResults = useMemo(() => {
    if (!filters.length) {
      return searchResults;
    }

    return searchResults.filter(item => {
      return filters.every(filter => {
        switch (filter) {
          case 'unsubscribed':
            return item.unsubscribed === true;
          case 'active':
            return !item.unsubscribed && !item.ignored;
          case 'ignored':
            return item.ignored === true;
          case 'suspicious':
            return item.suspicious === true;
          case 'recent':
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            return new Date(item.date) > oneWeekAgo;
          default:
            return true;
        }
      });
    });
  }, [searchResults, filters]);

  // Sort functionality
  const sortedResults = useMemo(() => {
    if (!sortConfig.field) {
      return filteredResults;
    }

    return [...filteredResults].sort((a, b) => {
      const aValue = a[sortConfig.field];
      const bValue = b[sortConfig.field];

      let comparison = 0;

      if (sortConfig.field === 'date') {
        comparison = new Date(aValue) - new Date(bValue);
      } else if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return sortConfig.order === 'desc' ? -comparison : comparison;
    });
  }, [filteredResults, sortConfig]);

  // Handlers
  const handleSearch = useCallback((term) => {
    setSearchTerm(term);
  }, []);

  const handleFilter = useCallback((newFilters) => {
    setFilters(newFilters);
  }, []);

  const handleSort = useCallback((config) => {
    setSortConfig(config);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  const clearFilters = useCallback(() => {
    setFilters([]);
  }, []);

  const clearSort = useCallback(() => {
    setSortConfig({ field: '', order: 'asc' });
  }, []);

  const clearAll = useCallback(() => {
    setSearchTerm('');
    setFilters([]);
    setSortConfig({ field: '', order: 'asc' });
  }, []);

  // Statistics
  const stats = useMemo(() => {
    const total = data?.length || 0;
    const filtered = sortedResults.length;
    const hasActiveSearch = searchTerm.trim().length > 0;
    const hasActiveFilters = filters.length > 0;
    const hasActiveSort = sortConfig.field.length > 0;

    return {
      total,
      filtered,
      hasActiveSearch,
      hasActiveFilters,
      hasActiveSort,
      isFiltering: hasActiveSearch || hasActiveFilters || hasActiveSort
    };
  }, [data, sortedResults, searchTerm, filters, sortConfig]);

  return {
    // Results
    results: sortedResults,
    stats,
    
    // State
    searchTerm,
    filters,
    sortConfig,
    
    // Handlers
    handleSearch,
    handleFilter,
    handleSort,
    
    // Clear functions
    clearSearch,
    clearFilters,
    clearSort,
    clearAll
  };
}

export default useSearch;