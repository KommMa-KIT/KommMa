/**
 * Footer.tsx
 *
 * The application-wide footer rendered at the bottom of every page by
 * MainLayout. Displays the KIT institutional attribution on the left and a
 * row of legal and external links on the right. Internal links are rendered
 * as React Router links, external links as plain anchors.
 */

import { Fragment } from 'react';
import { Link } from 'react-router-dom';

// --- Types ---

/** A footer link pointing to a route inside the application. */
interface InternalFooterLink {
  label: string;
  to: string;
}

/** A footer link pointing to an external website. */
interface ExternalFooterLink {
  label: string;
  href: string;
}

type FooterLink = InternalFooterLink | ExternalFooterLink;

// --- Constants ---

/** Shared Tailwind classes applied to every footer link. */
const footerLinkClass = 'text-white hover:underline';

/** Institutional attribution shown in the left column. */
const attributionText = 'KIT - Die Forschungsuniversität in der Helmholtz-Gemeinschaft';

/**
 * Links shown in the right column, in display order.
 * A separator is rendered between consecutive entries.
 */
const footerLinks: FooterLink[] = [
  { label: 'FAQ', to: '/faq' },
  { label: 'Datenschutz', to: '/privacy_policy' },
  // { label: 'Impressum', to: '/legal_disclosure' },
  { label: 'Impressum', href: 'https://www.kommma-im-klimaschutz.de/impressum.php' },
  { label: 'KIT', href: 'https://www.kit.edu' },
];

// --- Component ---

/**
 * Footer
 *
 * Sections:
 *  - Left column — institutional attribution.
 *  - Right column — legal and external links separated by vertical bars.
 *    The internal "Impressum" route is kept commented out in footerLinks
 *    in favour of the external imprint page.
 */
function Footer() {
  return (
    <footer className="bg-black text-sm text-white py-4">
      <div className="columns-2 mx-auto px-4">

        {/* Left column — institutional attribution */}
        <div className="text-left max-w-4xl mx-auto px-4">
          {attributionText}
        </div>

        {/* Right column — legal links and KIT external link */}
        <div className="text-right max-w-4xl mx-auto px-4 flex justify-end items-center gap-3">
          {footerLinks.map((link, index) => (
            <Fragment key={link.label}>
              {index > 0 && <span className="text-gray-400">|</span>}

              {'to' in link ? (
                <Link to={link.to} className={footerLinkClass}>
                  {link.label}
                </Link>
              ) : (
                <a href={link.href} className={footerLinkClass}>
                  {link.label}
                </a>
              )}
            </Fragment>
          ))}
        </div>

      </div>
    </footer>
  );
}

export default Footer;