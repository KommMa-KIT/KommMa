/**
 * Navbar.tsx
 *
 * A sticky top navigation bar rendered on every page of the application.
 * Contains the application logo (which navigates home on click) and four
 * navigation links. The "Ergebnis" link is conditionally rendered as a
 * disabled span when no calculation result is available yet, preventing
 * navigation to an empty result page.
 */

import { NavLink, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ResultState } from '@/store/ResultSlice';


// --- Constants ---

/** Path to the application logo shown in the left side of the navbar. */

const logo_path = '/Einzellogo_OhneUnterschrift_Weiß.svg';

// --- Helpers ---
/**
 * Returns the Tailwind className string for a NavLink, applying an active
 * underline indicator via a CSS pseudo-element when the link is active.
 * Extracted to avoid repeating the identical ternary across all four links.
 */
const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  `text-lg font-medium relative pb-1 ${
    isActive
      ? 'after:absolute after:bottom-0 after:left-0 after:w-full after:h-1 after:bg-green-600 after:rounded'
      : ''
  }`;



// --- Component ---

/**
 * Navbar
 *
 * Sections:
 *  - Result availability check — gates the Ergebnis link.
 *  - Logo (left) — clickable, navigates to the home route.
 *  - Navigation links (right): Startseite, Maßnahmen, Dateneingabe, Ergebnis.
 *  - Ergebnis renders as a NavLink when a result exists, or as a disabled
 *    span with a tooltip explanation when no result is available yet.
 */
function Navbar() {
  const result = useSelector(
    (state: { results: ResultState }) => state.results.measureResults
  );

  const resultAvailable = result !== null;
  const navigate = useNavigate();

  return (
    <nav className="sticky top-0 z-50 flex justify-between items-center h-20 px-10 bg-green-900 text-white">
      <div className="flex items-center cursor-pointer">
        <img
          src={logo_path}
          alt="Logo"
          className="h-12"
          onClick={() => navigate('/')}
        />
      </div>

      <div className="flex space-x-10">
        <NavLink to="/" className={navLinkClass}>
          Startseite
        </NavLink>

        <NavLink to="/measures" className={navLinkClass}>
          Maßnahmen
        </NavLink>

        <NavLink to="/input" className={navLinkClass}>
          Dateneingabe
        </NavLink>

        {resultAvailable ? (
          <NavLink to="/result" className={navLinkClass}>
            Ergebnis
          </NavLink>
        ) : (
          <span
            className="inline-flex items-center text-lg font-medium relative pb-1 text-gray-300 cursor-not-allowed rounded px-2 h-8"
            title="Diese Seite ist erst verfügbar, nachdem eine Berechnung durchgeführt wurde."
          >
            Ergebnis
          </span>
        )}
      </div>
    </nav>
  );
}

export default Navbar;