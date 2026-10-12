/**
 * MainLayout.tsx
 *
 * The root layout wrapper applied to every page in the application.
 * Renders the sticky Navbar at the top, the current route's page content
 * via React Router's Outlet in the main content area, and a consistent
 * Footer at the bottom containing the KIT attribution and legal links.
 */

import { Outlet } from 'react-router-dom';
import ScrollToTop from './ScrollToTop';
import Navbar from './Navbar';
import Footer from './Footer';

// --- Component ---

/**
 * MainLayout
 *
 * Sections:
 *  - ScrollToTop — resets scroll position to top on every route change.
 *  - Navbar — sticky top bar, rendered on every route.
 *  - Outlet — React Router placeholder replaced by the active route's component.
 *  - Footer — KIT attribution and legal links, rendered on every route.
 */
export default function MainLayout() {
  return (
    <>
      <ScrollToTop />
      <Navbar />

      {/* Active route content — injected here by React Router */}
      <main>
        <Outlet />
      </main>

      <Footer />
    </>
  );
}