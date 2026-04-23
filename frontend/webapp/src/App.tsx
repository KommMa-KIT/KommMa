/**
 * App.tsx
 *
 * Root application component. Defines the full client-side route tree using
 * React Router. All standard routes are nested under the MainLayout route so
 * they inherit the shared Navbar and footer. The catch-all 404 route is
 * deliberately placed outside MainLayout so NotFoundPage renders without the
 * navigation chrome.
 *
 * Route summary:
 *  /                → StartPage
 *  /measures        → MeasuresPage
 *  /input           → InputPage
 *  /result          → ResultPage (guarded by ResultProtectedRoute)
 *  /legal_disclosure → LegalDisclosurePage
 *  /privacy_policy  → PrivacyPolicyPage
 *  /*               → NotFoundPage (no layout wrapper)
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import './App.css';

import StartPage             from './pages/StartPage';
import MeasuresPage          from './pages/MeasuresPage';
import InputPage             from './pages/InputPage';
import ResultPage            from './pages/ResultPage';
import MainLayout            from './layout/MainLayout';
import NotFoundPage          from './pages/NotFoundPage';
import LegalDisclosurePage   from './pages/LegalDisclosurePage';
import ResultProtectedRoute  from './routing/ResultProtectedRoute';
import PrivacyPolicyPage     from './pages/PrivacyPolicy';

// --- Component ---

/**
 * App
 *
 * Thin routing shell — contains no logic or state. All routes nested under
 * the MainLayout Route inherit its Navbar and footer via React Router's
 * Outlet mechanism. The /result route is additionally wrapped in
 * ResultProtectedRoute, which redirects to "/" when no calculation result
 * is available.
 */
const App = () => (
  <div className="App">
    <Router>
      <Routes>

        {/* Routes wrapped in MainLayout — render with Navbar and footer */}
        <Route element={<MainLayout />}>
          <Route path="/"                element={<StartPage />} />
          <Route path="/measures"        element={<MeasuresPage />} />
          <Route path="/input"           element={<InputPage />} />
          <Route path="/legal_disclosure" element={<LegalDisclosurePage />} />
          <Route path="/privacy_policy"  element={<PrivacyPolicyPage />} />

          {/* /result — guarded by ResultProtectedRoute; redirects to "/" when
              no calculation result is present in the Redux store */}
          <Route
            path="/result"
            element={
              <ResultProtectedRoute>
                <ResultPage />
              </ResultProtectedRoute>
            }
          />
        </Route>

        {/* Catch-all 404 — intentionally outside MainLayout so NotFoundPage
            renders without the Navbar and footer */}
        <Route path="/*" element={<NotFoundPage />} />

      </Routes>
    </Router>
  </div>
);

export default App;