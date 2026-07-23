import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { BarChart2, LogIn, UserPlus, AlertCircle, Eye, EyeOff } from 'lucide-react';

const LoginPage = () => {
    // 'login' | 'register'
    const [mode, setMode] = useState('login');

    // Form fields
    const [username, setUsername] = useState('');
    const [email, setEmail]       = useState('');
    const [password, setPassword] = useState('');

    // UI state
    const [loading, setLoading]       = useState(false);
    const [error, setError]           = useState(null);
    const [showPassword, setShowPassword] = useState(false);

    const { login } = useAuth();       // from AuthContext
    const navigate  = useNavigate();   // from React Router

    const switchMode = (m) => {
        setMode(m);
        setError(null);   // clear errors when switching tabs
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); // prevent browser page reload on form submit
        setError(null);
        setLoading(true);

        try {
            if (mode === 'register') {
                // ── Register flow ─────────────────────────────────────────────
                await client.post('/Auth/register', { username, email, password });
                // After registering, automatically log them in
                setMode('login');
                setError(null);
                // Small UX: show a success hint
                setError({ type: 'success', text: 'Account created! Please log in.' });
                setLoading(false);
                return;
            }

            // ── Login flow ────────────────────────────────────────────────────
            // POST /api/Auth/login → { token, userId, username, expiresAt }
            const res = await client.post('/Auth/login', { email, password });

            // LEARNING: We call login() from AuthContext which:
            //   1. Saves token to localStorage (persists across page refresh)
            //   2. Saves user info to localStorage
            //   3. Updates React state → triggers re-render of all AuthContext consumers
            //   4. The ProtectedRoute in App.jsx sees isAuthenticated = true
            //      and allows access to /replay
            login(res.data.token, {
                userId:   res.data.userId,
                username: res.data.username,
            });

            navigate('/live', { replace: true });

        } catch (err) {
            const msg = err.response?.data?.message
                     || err.response?.data
                     || 'Something went wrong. Is the API running?';
            setError({ type: 'error', text: String(msg) });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">

                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-600/30 mb-4">
                        <BarChart2 size={28} className="text-blue-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">
                        Aegis<span className="text-blue-400">Trader</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Deterministic Forex Backtesting Platform
                    </p>
                </div>

                {/* Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl shadow-black/40">

                    {/* Tab switcher */}
                    <div className="flex bg-slate-800/60 rounded-xl p-1 mb-6">
                        <button
                            onClick={() => switchMode('login')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
                                mode === 'login'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                                    : 'text-slate-400 hover:text-slate-300'
                            }`}
                        >
                            <LogIn size={15} /> Login
                        </button>
                        <button
                            onClick={() => switchMode('register')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
                                mode === 'register'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                                    : 'text-slate-400 hover:text-slate-300'
                            }`}
                        >
                            <UserPlus size={15} /> Register
                        </button>
                    </div>

                    {/* Alert */}
                    {error && (
                        <div className={`flex items-start gap-2.5 text-sm rounded-xl px-4 py-3 mb-5 ${
                            error.type === 'success'
                                ? 'bg-green-950/60 text-green-400 border border-green-800/60'
                                : 'bg-red-950/60 text-red-400 border border-red-800/60'
                        }`}>
                            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                            {error.text}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">

                        {/* Username — only shown on Register */}
                        {mode === 'register' && (
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                    Username
                                </label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    placeholder="e.g. abi_binu"
                                    required
                                    autoComplete="username"
                                    id="input-username"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-600/70 focus:ring-1 focus:ring-blue-600/30 transition"
                                />
                            </div>
                        )}

                        {/* Email */}
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                                autoComplete="email"
                                id="input-email"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-600/70 focus:ring-1 focus:ring-blue-600/30 transition"
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Min. 6 characters"
                                    required
                                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                    id="input-password"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 pr-11 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-600/70 focus:ring-1 focus:ring-blue-600/30 transition"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            id="btn-submit-auth"
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition mt-2"
                        >
                            {loading ? (
                                <span className="animate-pulse">
                                    {mode === 'login' ? 'Logging in...' : 'Creating account...'}
                                </span>
                            ) : (
                                <>
                                    {mode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
                                    {mode === 'login' ? 'Login' : 'Create Account'}
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-slate-600 text-xs mt-6">
                    AegisTrader · MCA Project 2025–27 · Abi Binu
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
