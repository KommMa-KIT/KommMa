/**
 * ScrollToTop.tsx
 *
 * Utility component with no visual output. React Router preserves the
 * browser's scroll position across client-side navigations (unlike a
 * classic full-page reload), so without this the user can land on a new
 * page already scrolled down if the previous page was scrolled. This
 * component listens for route changes and resets the scroll position to
 * the top whenever the pathname changes.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// --- Component ---

/**
 * ScrollToTop
 *
 * Renders nothing. Should be mounted once, high in the tree (e.g. inside
 * MainLayout, alongside the Outlet), so it re-runs on every route change
 * regardless of which page is active.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}