// API service for managing all HTTP requests
const API_BASE_URL = 'http://localhost:5000';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // Helper method for making requests with credentials
  async request(endpoint, options = {}) {
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
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error.message);
      throw error;
    }
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
    return this.request('/gmail/all-signups');
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
}

// Create and export a singleton instance
const apiService = new ApiService();
export default apiService;