/**
 * MainLayout.tsx
 *
 * The root layout wrapper applied to every page in the application.
 * Renders the sticky Navbar at the top, the current route's page content
 * via React Router's Outlet in the main content area, and a consistent
 * footer at the bottom containing the KIT attribution and legal links.
 */

import { Link, Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';

// --- Component ---

/**
 * MainLayout
 *
 * Sections:
 *  - Navbar — sticky top bar, rendered on every route.
 *  - Outlet — React Router placeholder replaced by the active route's component.
 *  - Footer — two-column layout: KIT attribution (left), legal links (right).
 */
export default function MainLayout() {
  return (
    <>
      <Navbar />

      {/* Active route content — injected here by React Router */}
      <main>
        <Outlet />
      </main>

      {/* Footer — KIT attribution left, legal/external links right */}
      <footer className="bg-black text-sm text-muted-foreground text-white py-4">
        <div className="columns-2 mx-auto px-4">

          {/* Left column — institutional attribution */}
          <div className="text-left max-w-4xl mx-auto px-4">
            KIT - Die Forschungsuniversität in der Helmholtz-Gemeinschaft
          </div>

          {/* Right column — legal links and KIT external link */}
          <div className="text-right max-w-4xl mx-auto px-4 flex justify-end items-center gap-3">
            <Link to="/privacy_policy" className="text-white hover:underline">
              Datenschutz
            </Link>

            <span className="text-gray-400">|</span>

            <Link to="/legal_disclosure" className="text-white hover:underline">
              Impressum
            </Link>

            <span className="text-gray-400">|</span>

            <a href="https://www.kit.edu" className="text-white hover:underline">
              KIT
            </a>
          </div>

        </div>
      </footer>
    </>
  );
}