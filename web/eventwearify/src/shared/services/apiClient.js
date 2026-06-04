  const API_BASE_URL = 'http://localhost:8080/api';

  const getAuthToken = () => {
    return localStorage.getItem('token') || localStorage.getItem('accessToken');
  };

  const isAuthenticated = () => {
    const token = getAuthToken();
    return token && token !== 'undefined' && token !== 'null';
  };

  const clearAuthAndRedirect = () => {
    console.warn('Clearing authentication and redirecting to login...');
    localStorage.clear();
    sessionStorage.clear();
    
    // Prevent redirect loop - only redirect if not already on auth page
    if (!window.location.pathname.includes('/auth')) {
      window.location.href = '/auth';
    }
  };

  export const authFetch = async (endpoint, options = {}) => {
    const token = getAuthToken();

    // Check if token exists BEFORE making request
    if (!token) {
      console.error('No auth token found - redirecting to login');
      clearAuthAndRedirect();
      throw new Error('Authentication required');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };

    const url = `${API_BASE_URL}${endpoint}`;
    console.log(`API Request: ${options.method || 'GET'} ${url}`);
    console.log(`Auth token present: ${!!token}`);

    try {
      const response = await fetch(url, { ...options, headers });

      // Handle 401 Unauthorized - session expired
      if (response.status === 401) {
        console.warn('Received 401 Unauthorized - token invalid or blacklisted');
        localStorage.clear();
        sessionStorage.clear();
        window.dispatchEvent(new CustomEvent('sessionExpired'));
        throw new Error('Session expired. Please login again.');
      }

      if (response.status === 204) {
        return null;
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || data.error || `API Error: ${response.status}`);
        }
        return data;
      } else {
        const text = await response.text();
        if (!response.ok) {
          console.error('Non-JSON response:', text.substring(0, 200));
          throw new Error(`Server error (${response.status}). Please check if backend is running.`);
        }
        if (!text) return null;
        try {
          return JSON.parse(text);
        } catch {
          throw new Error('Invalid response format from server');
        }
      }
    } catch (error) {
      console.error('Fetch error:', error);
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Cannot connect to server. Please make sure the backend is running on port 8080');
      }
      throw error;
    }
  };

  export const publicFetch = async (endpoint, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };
 
  const url = `${API_BASE_URL}${endpoint}`;
 
  try {
    const response = await fetch(url, { ...options, headers });
 
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || `API Error: ${response.status}`);
      }
      return data;
    } else {
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`Server error (${response.status}).`);
      }
      try {
        return JSON.parse(text);
      } catch {
        throw new Error('Invalid response format from server');
      }
    }
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to server. Please make sure the backend is running on port 8080');
    }
    throw error;
  }
};

  export const API_BASE_URL_ROOT = API_BASE_URL;