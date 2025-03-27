import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

console.log('API Base URL:', BASE_URL);

// Create axios instance
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Increase timeout for slower connections
  timeout: 15000
});

// Add request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`API Request to ${config.url}:`, {
      method: config.method,
      url: config.url,
      data: config.data,
      params: config.params,
      headers: config.headers
    });
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`API Response from ${response.config.url}:`, {
      status: response.status,
      statusText: response.statusText,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('API Response Error:', error);
    // Add more details about the error
    if (error.response) {
      console.error('Error details:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers
      });
    } else if (error.request) {
      console.error('No response received:', {
        request: error.request,
        config: error.config
      });
    } else {
      console.error('Error during request setup:', error.message);
    }
    console.error('Error config:', error.config);
    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getProfile: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/updatedetails', data),
  updatePassword: (data) => api.put('/auth/updatepassword', data),
  updatePreferences: (data) => api.put('/auth/preferences', data),
};

// Accounts API
export const accountsAPI = {
  getAccounts: (params) => api.get('/accounts', { params }),
  getAccount: (id) => api.get(`/accounts/${id}`),
  createAccount: (data) => api.post('/accounts', data),
  updateAccount: (id, data) => api.put(`/accounts/${id}`, data),
  deleteAccount: (id) => api.delete(`/accounts/${id}`),
};

// Categories API
export const categoriesAPI = {
  getCategories: (params) => api.get('/categories', { params }),
  getCategory: (id) => api.get(`/categories/${id}`),
  createCategory: (data) => api.post('/categories', data),
  updateCategory: (id, data) => api.put(`/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/categories/${id}`),
  getCategoryAccounts: (id, params) => api.get(`/categories/${id}/accounts`, { params }),
};

// Metrics API
export const metricsAPI = {
  getLatestMetrics: (params) => api.get('/metrics/latest', { params }),
  getLatestMetricsForAccount: (accountId) => api.get(`/metrics/latest/${accountId}`),
  getAccountMetrics: (accountId, params) => api.get(`/metrics/account/${accountId}`, { params }),
  getMultipleAccountMetrics: (accountIds, params) => {
    const ids = Array.isArray(accountIds) ? accountIds.join(',') : accountIds;
    return api.get('/metrics/accounts', { params: { ...params, ids } });
  },
  getMetricsByUsername: (username, params) => api.get(`/metrics/username/${username}`, { params }),
  addMetrics: (data) => api.post('/metrics', data),
  // Analysis endpoints
  getGrowthAnalysis: (accountIds, params) => {
    const ids = Array.isArray(accountIds) ? accountIds.join(',') : accountIds;
    return api.get('/metrics/analysis/growth', { params: { ...params, ids } });
  },
  getEngagementAnalysis: (accountIds, params) => {
    const ids = Array.isArray(accountIds) ? accountIds.join(',') : accountIds;
    return api.get('/metrics/analysis/engagement', { params: { ...params, ids } });
  },
  getReachAnalysis: (accountIds, params) => {
    const ids = Array.isArray(accountIds) ? accountIds.join(',') : accountIds;
    return api.get('/metrics/analysis/reach', { params: { ...params, ids } });
  },
  getMetricsSummary: (accountIds, params) => {
    const ids = Array.isArray(accountIds) ? accountIds.join(',') : accountIds;
    return api.get('/metrics/analysis/summary', { params: { ...params, ids } });
  },
};

// Alerts API
export const alertsAPI = {
  getAlerts: () => api.get('/alerts'),
  getAlert: (id) => api.get(`/alerts/${id}`),
  createAlert: (data) => api.post('/alerts', data),
  updateAlert: (id, data) => api.put(`/alerts/${id}`, data),
  deleteAlert: (id) => api.delete(`/alerts/${id}`),
  testAlert: (id) => api.post(`/alerts/${id}/test`),
};

// Scraper API
export const scraperAPI = {
  getStatus: () => api.get('/scraper/status'),
  startScraper: () => api.post('/scraper/start'),
  stopScraper: () => api.post('/scraper/stop'),
  scrapeAccount: (id) => api.post(`/scraper/account/${id}`),
};

export default api; 