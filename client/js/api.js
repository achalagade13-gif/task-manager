/**
 * Centralized API Client Wrapper
 */
const API_BASE_URL = '/api';

// Track consecutive 401s to avoid false logouts from serverless cold starts
let _consecutive401s = 0;
const MAX_401_BEFORE_LOGOUT = 2;

class ApiClient {
  static getToken() {
    return localStorage.getItem('tm_token');
  }

  static setToken(token) {
    if (token) {
      localStorage.setItem('tm_token', token);
      _consecutive401s = 0; // reset on fresh token
    } else {
      localStorage.removeItem('tm_token');
    }
  }

  static async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = this.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(options.headers || {})
    };

    const config = {
      method: options.method || 'GET',
      headers,
      ...(options.body && { body: JSON.stringify(options.body) })
    };

    // skipAuthRedirect: true means this is a soft background request.
    // A 401 here must NOT wipe the token or redirect.
    const skipAuthRedirect = options.skipAuthRedirect === true;

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        const isAuthEndpoint =
          endpoint.includes('/auth/login') ||
          endpoint.includes('/auth/register');

        if (!isAuthEndpoint && !skipAuthRedirect) {
          _consecutive401s++;

          // Only force logout after multiple 401s — prevents false logout
          // on serverless cold-start latency or transient DB errors
          if (_consecutive401s >= MAX_401_BEFORE_LOGOUT) {
            _consecutive401s = 0;
            this.setToken(null);
            localStorage.removeItem('tm_user');
            const path = window.location.pathname;
            if (path !== '/login' && path !== '/register' && path !== '/') {
              window.location.href = '/login?expired=true';
            }
          }
        }
      } else {
        // Reset on any successful response
        if (response.ok) _consecutive401s = 0;
      }

      if (!response.ok) {
        const error = new Error(data.message || 'An error occurred during request');
        error.status = response.status;
        error.data = data;
        error.errors = data.errors || null;
        throw error;
      }

      return data;
    } catch (err) {
      throw err;
    }
  }

  static get(endpoint, params = null) {
    let url = endpoint;
    if (params) {
      const query = new URLSearchParams(params).toString();
      if (query) url += `?${query}`;
    }
    return this.request(url, { method: 'GET' });
  }

  static post(endpoint, body) {
    return this.request(endpoint, { method: 'POST', body });
  }

  static put(endpoint, body) {
    return this.request(endpoint, { method: 'PUT', body });
  }

  static patch(endpoint, body) {
    return this.request(endpoint, { method: 'PATCH', body });
  }

  static delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

window.api = ApiClient;
