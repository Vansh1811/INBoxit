// API service for managing all HTTP requests
const API_BASE_URL = 'http://localhost:5000';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async request(endpoint, options = {}, retryCount = 0) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 401 && data.action === 'REAUTH_REQUIRED') {
          this.handleReauthRequired();
          throw new Error('Authentication required - please log in again');
        }
        
        if (response.status === 429) {
          // Rate limited - retry after delay
          if (retryCount < this.maxRetries) {
            const retryAfter = response.headers.get('Retry-After') || this.retryDelay;
            await this.delay(retryAfter * 1000);
            return this.request(endpoint, options, retryCount + 1);
          }
        }
        
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      // Retry on network errors
      if (retryCount < this.maxRetries && this.isRetryableError(error)) {
        await this.delay(this.retryDelay * Math.pow(2, retryCount));
        return this.request(endpoint, options, retryCount + 1);
      }
      
      console.error(`API Error (${endpoint}):`, error.message);
      throw error;
    }
  }

  isRetryableError(error) {
    return error.name === 'TypeError' || // Network error
           error.message.includes('fetch');
  }

  handleReauthRequired() {
    // Redirect to login or show login modal
    window.location.href = '/auth/google';
  }

  // Authentication methods
  async checkLoginStatus() {
    return this.request('/auth/me');
  }

  async logout() {
    return this.request('/auth/logout');
  }

  // Gmail methods
  async testGmailConnection() {
    return this.request('/gmail/test-connection');
  }

  async fetchSignupServices() {
    return this.request('/gmail/all-signups?refresh=false');
  }

  async refreshSignupServices() {
    return this.request('/gmail/all-signups?refresh=true');
  }

  async getSavedServices() {
    return this.request('/gmail/saved-services');
  }

  async updateServiceStatus(domain, action) {
    return this.request('/gmail/update-service', {
      method: 'POST',
      body: JSON.stringify({ domain, action }),
    });
  }

  // Platform detection methods
  async detectPlatforms() {
    return this.request('/detect-platforms');
  }

  async getMyPlatforms() {
    return this.request('/my-platforms');
  }

  // Test connection method
  async testConnection() {
    return this.request('/test-connection');
  }

  // New methods for enhanced functionality
  async getNewServices() {
    return this.request('/gmail/new-services');
  }

  async getServicesWithPagination(page = 1, limit = 50) {
    return this.request(`/gmail/saved-services?page=${page}&limit=${limit}`);
  }

  async searchServices(query) {
    return this.request(`/gmail/saved-services?q=${encodeURIComponent(query)}`);
  }

  // Batch operations
  async batchUpdateServices(updates) {
    const promises = updates.map(({ domain, action }) => 
      this.updateServiceStatus(domain, action)
    );
    
    try {
      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      return {
        successful,
        failed,
        total: updates.length
      };
    } catch (error) {
      throw new Error('Batch update failed');
    }
  }
}

// Create and export a singleton instance
const apiService = new ApiService();
export default apiService;