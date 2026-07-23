import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ReplayPage    from './pages/ReplayPage';
import LivePage      from './pages/LivePage';
import AnalyticsPage from './pages/AnalyticsPage';
import LoginPage     from './pages/LoginPage';

/**
 * ProtectedRoute — guards a route so only authenticated users can access it.
 *
 * LEARNING: This is a wrapper component. It checks isAuthenticated from
 * AuthContext. If the user is not logged in, it redirects to /login using
 * <Navigate replace>. The `replace` prop means the login page replaces the
 * current history entry — pressing "back" won't take the user back to the
 * protected page they were blocked from.
 *
 * If authenticated, it renders the children (the actual page).
 */
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated } = useAuth();
    return isAuthenticated ? children : <Navigate to="/login" replace />;
};

/**
 * LEARNING: Why is <AuthProvider> OUTSIDE <BrowserRouter>?
 *
 * AuthProvider doesn't depend on routing — it just manages a token in memory.
 * BrowserRouter depends on the DOM's URL history.
 * The order here doesn't technically matter, but we put AuthProvider outside
 * so it wraps the entire app tree, including any router logic.
 *
 * However, ProtectedRoute uses useAuth() — so it MUST be inside AuthProvider.
 * And it uses <Navigate> — so it MUST be inside BrowserRouter.
 * That's why ProtectedRoute is defined inside this file and used inside both.
 */
function App() {
    return (
        <AuthProvider>
            <div className="min-h-screen bg-slate-950 text-white">
                <BrowserRouter>
                    <Routes>
                        {/* Public: Login / Register */}
                        <Route path="/login" element={<LoginPage />} />

                        {/* Protected: Replay Engine */}
                        <Route
                            path="/replay"
                            element={
                                <ProtectedRoute>
                                    <ReplayPage />
                                </ProtectedRoute>
                            }
                        />

                        {/* Protected: Live Trading Arena */}
                        <Route
                            path="/live"
                            element={
                                <ProtectedRoute>
                                    <LivePage />
                                </ProtectedRoute>
                            }
                        />

                        {/* Protected: Analytics Dashboard */}
                        <Route
                            path="/analytics/:sessionId"
                            element={
                                <ProtectedRoute>
                                    <AnalyticsPage />
                                </ProtectedRoute>
                            }
                        />

                        {/* Root redirect: if logged in → /replay, else → /login */}
                        <Route
                            path="/"
                            element={<Navigate to="/replay" replace />}
                        />

                        {/* Catch-all */}
                        <Route path="*" element={<Navigate to="/replay" replace />} />
                    </Routes>
                </BrowserRouter>
            </div>
        </AuthProvider>
    );
}

export default App;