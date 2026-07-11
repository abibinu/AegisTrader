import { createContext, useContext, useState, useCallback } from 'react';

/**
 * LEARNING: React Context API
 *
 * The problem without Context:
 *   App → ReplayPage → Header → UserAvatar  (needs to know who's logged in)
 *   Without Context, you'd pass `user` as a prop through every component — "prop drilling".
 *
 * With Context:
 *   Any component can call useAuth() and get the user directly, no props needed.
 *   AND when the user logs in/out, every component that uses useAuth()
 *   automatically re-renders with the new state.
 *
 * Storage: We use localStorage to persist the token across page refreshes.
 * When the page reloads, we read the token back from localStorage immediately.
 */

// 1. Create the context object — this is the "channel" components subscribe to
const AuthContext = createContext(null);

// ── Token storage key ─────────────────────────────────────────────────────────
const TOKEN_KEY = 'aegis_token';
const USER_KEY  = 'aegis_user';

// ── Helper: safely parse stored user ─────────────────────────────────────────
const readStoredUser = () => {
    try {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

// ── AuthProvider ──────────────────────────────────────────────────────────────
// This component wraps the entire app and "provides" the auth state to all children.
// It initialises from localStorage so the user stays logged in after a page refresh.

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
    const [user,  setUser]  = useState(() => readStoredUser());

    /**
     * login() — called after a successful POST /api/Auth/login response.
     * Saves the token + user to state AND localStorage.
     *
     * @param {string} jwtToken  - the raw JWT string from the API
     * @param {object} userData  - { userId, username } from the API response
     */
    const login = useCallback((jwtToken, userData) => {
        localStorage.setItem(TOKEN_KEY, jwtToken);
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
        setToken(jwtToken);
        setUser(userData);
    }, []);

    /**
     * logout() — clears all auth state.
     * React Router will redirect to /login because ProtectedRoute checks isAuthenticated.
     */
    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
    }, []);

    const value = {
        token,
        user,
        login,
        logout,
        isAuthenticated: !!token,  // !! converts token string to boolean
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// ── useAuth hook ──────────────────────────────────────────────────────────────
// A custom hook so any component can call: const { user, logout, isAuthenticated } = useAuth();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used inside an <AuthProvider>. Check your App.jsx.');
    }
    return context;
};
