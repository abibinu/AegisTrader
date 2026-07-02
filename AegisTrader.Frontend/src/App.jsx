import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ReplayPage from './pages/ReplayPage';
import AnalyticsPage from './pages/AnalyticsPage';

/**
 * LEARNING: React Router gives us client-side navigation (no page reload).
 *
 * Route structure:
 *   /         → redirect to /replay (main app)
 *   /replay   → The Replay Engine (chart + trade panel)
 *   /analytics/:sessionId → Analytics for a specific session
 *
 * :sessionId is a URL parameter — React Router parses it and
 * AnalyticsPage reads it with useParams().
 */
function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <BrowserRouter>
        <Routes>
          {/* Redirect root to replay page */}
          <Route path="/" element={<Navigate to="/replay" replace />} />

          {/* Main Replay Engine */}
          <Route path="/replay" element={<ReplayPage />} />

          {/* Analytics Dashboard (session-specific) */}
          <Route path="/analytics/:sessionId" element={<AnalyticsPage />} />

          {/* Catch-all: redirect unknown paths back to replay */}
          <Route path="*" element={<Navigate to="/replay" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;