import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Filter, SortAsc, SortDesc } from 'lucide-react';

const SearchBar = ({ 
  onSearch, 
  onFilter, 
  onSort,
  placeholder = "Search services...",
  filters = [],
  sortOptions = [],
  className = ""
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState([]);
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const searchRef = useRef(null);
  const filterRef = useRef(null);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch?.(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, onSearch]);

  // Handle filter changes
  useEffect(() => {
    onFilter?.(activeFilters);
  }, [activeFilters, onFilter]);

  // Handle sort changes
  useEffect(() => {
    if (sortBy) {
      onSort?.({ field: sortBy, order: sortOrder });
    }
  }, [sortBy, sortOrder, onSort]);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFilterToggle = (filterId) => {
    setActiveFilters(prev => 
      prev.includes(filterId)
        ? prev.filter(id => id !== filterId)
        : [...prev, filterId]
    );
  };

  const clearSearch = () => {
    setSearchTerm('');
    searchRef.current?.focus();
  };

  const clearAllFilters = () => {
    setActiveFilters([]);
    setSearchTerm('');
    setSortBy('');
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className={`w-full max-w-2xl mx-auto ${className}`}>
      {/* Main Search Bar */}
      <div className="relative">
        <motion.div
          className="relative flex items-center bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200"
          whileFocus={{ scale: 1.02 }}
        >
          <Search className="absolute left-4 w-5 h-5 text-gray-400" />
          
          <input
            ref={searchRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-12 pr-20 py-4 text-gray-700 bg-transparent border-none rounded-xl focus:outline-none focus:ring-0 placeholder-gray-400"
          />

          <div className="absolute right-2 flex items-center gap-1">
            {searchTerm && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={clearSearch}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </motion.button>
            )}

            {filters.length > 0 && (
              <div className="relative" ref={filterRef}>
                <motion.button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={`p-2 rounded-lg transition-colors ${
                    activeFilters.length > 0 || isFilterOpen
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Filter className="w-4 h-4" />
                  {activeFilters.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                      {activeFilters.length}
                    </span>
                  )}
                </motion.button>

                {/* Filter Dropdown */}
                <AnimatePresence>
                  {isFilterOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50"
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-gray-700">Filters</h3>
                          {activeFilters.length > 0 && (
                            <button
                              onClick={clearAllFilters}
                              className="text-sm text-blue-600 hover:text-blue-700"
                            >
                              Clear all
                            </button>
                          )}
                        </div>

                        <div className="space-y-2">
                          {filters.map((filter) => (
                            <label
                              key={filter.id}
                              className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={activeFilters.includes(filter.id)}
                                onChange={() => handleFilterToggle(filter.id)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">{filter.label}</span>
                              {filter.count && (
                                <span className="ml-auto text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                  {filter.count}
                                </span>
                              )}
                            </label>
                          ))}
                        </div>

                        {sortOptions.length > 0 && (
                          <>
                            <hr className="my-3" />
                            <div>
                              <h4 className="font-medium text-gray-700 mb-2">Sort by</h4>
                              <div className="space-y-1">
                                {sortOptions.map((option) => (
                                  <button
                                    key={option.value}
                                    onClick={() => setSortBy(option.value)}
                                    className={`w-full text-left p-2 text-sm rounded-lg transition-colors ${
                                      sortBy === option.value
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                              
                              {sortBy && (
                                <button
                                  onClick={toggleSortOrder}
                                  className="flex items-center gap-2 mt-2 p-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                  {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                                  {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>

        {/* Active Filters Display */}
        <AnimatePresence>
          {activeFilters.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 flex flex-wrap gap-2"
            >
              {activeFilters.map((filterId) => {
                const filter = filters.find(f => f.id === filterId);
                return (
                  <motion.span
                    key={filterId}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full"
                  >
                    {filter?.label}
                    <button
                      onClick={() => handleFilterToggle(filterId)}
                      className="hover:bg-blue-200 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.span>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SearchBar;