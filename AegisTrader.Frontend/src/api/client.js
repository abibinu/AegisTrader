import axios from 'axios';

/**
 * LEARNING: Axios Interceptors
 *
 * An interceptor is middleware for HTTP requests/responses.
 * Instead of manually adding the Authorization header in every single
 * API call across every component, we add it ONCE here — the interceptor
 * runs automatically on every outgoing request.
 *
 * Request interceptor:  runs BEFORE the request is sent
 * Response interceptor: runs AFTER the response arrives (or errors)
 */

const client = axios.create({
    baseURL: 'http://localhost:5273/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// ── Request Interceptor ────────────────────────────────────────────────────────
// Before every request: read the token from localStorage and attach it.
// If there's no token (user is not logged in), the request goes through
// without a header — the server will return 401, which the response interceptor handles.
client.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('aegis_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config; // Must return config to continue the request
    },
    (error) => Promise.reject(error)
);

// ── Response Interceptor ───────────────────────────────────────────────────────
// After every response: if the server returns 401 Unauthorized,
// it means the token is expired or invalid. Clear auth state and redirect to login.
//
// This handles "silent token expiry" — the user doesn't need to manually log out
// when their 7-day token expires. The next API call will automatically
// bounce them back to the login page.
client.interceptors.response.use(
    (response) => response, // success — pass through unchanged
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid — clear storage and redirect
            localStorage.removeItem('aegis_token');
            localStorage.removeItem('aegis_user');
            // Only redirect if not already on the login page
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default client;