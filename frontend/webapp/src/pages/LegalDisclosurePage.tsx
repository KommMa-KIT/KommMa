/**
 * Dummy page for legal disclosure.
 * Note: This page is definitely to be replaced, when making the application public. The current contents have been generated using Claude Sonnet 4.6
 * and we therefore strongly advise to change everything in this page. The layout however, can be kept.
 */

import { Building2, Mail, Phone } from 'lucide-react';

// --- Component ---

/**
 * LegalDisclosurePage
 *
 * Sections:
 *  - Header — page title and statutory reference (§ 5 TMG).
 *  - Betreiber — operator name and postal address.
 *  - Kontakt — phone number and email address.
 *  - Project info — brief description of KommMa and space for additional legal notices.
 */
const LegalDisclosurePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 text-left">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Impressum</h1>
          <p className="text-lg text-gray-600">
            Angaben gemäß § 5 TMG
          </p>
        </div>

        {/* Content card */}
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">

          {/* Betreiber — operator/host details ⚠ replace with accurate address */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-gray-900">Betreiber</h2>
            </div>
            <div className="text-gray-700 space-y-1">
              <p className="font-medium">Karlsruher Institut für Technologie (KIT)</p>
              <p>Kaiserstraße 12</p>
              <p>76131 Karlsruhe</p>
              <p>Deutschland</p>
            </div>
          </section>

          {/* Kontakt — contact information replace with accurate contact details */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Mail className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-gray-900">Kontakt</h2>
            </div>
            <div className="text-gray-700 space-y-2">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-500" />
                <span>+49 721 608-0</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-500"/>
                <a
                  href="mailto:email@kit.edu"
                  className="text-primary hover:underline"
                >
                  email@kit.edu
                </a>
              </div>
            </div>
          </section>

          {/* Project information ⚠ replace placeholder text with accurate description */}
          <section>
            <div className="text-sm text-gray-600">
              <p className="mb-2">
                <strong>KommMa</strong> – Digitales Planungstool zur Priorisierung von Klimaschutzmaßnahmen
              </p>
              <p>
                Hier ist Platz für weitere Informationen über das Projekt, wie beispielsweise rechtliche Hinweise.
              </p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default LegalDisclosurePage;