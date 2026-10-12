/**
 * PrivacyPolicyPage.tsx
 *
 * Placeholder Datenschutzerklärung (privacy policy) page required by German
 * law (DSGVO / GDPR). The "Stand" date is generated dynamically at render time.
 *
 * ⚠ WARNING: The current content was generated as placeholder text and MUST be
 * replaced with legally reviewed, accurate information before this application
 * is made public. The page layout and section structure may be kept.
 */

import { Shield, Cookie, Database, Lock, Eye, FileText, Mail } from 'lucide-react';

// --- Component ---

/**
 * PrivacyPolicyPage
 *
 * Nine numbered sections matching standard German DSGVO disclosure requirements:
 *  1. Verantwortlicher — data controller identity and address.        ⚠ replace
 *  2. Datenschutzbeauftragter — data protection officer contact.      ⚠ replace
 *  3. Erhebung und Speicherung — data collected on visit and tool use.⚠ replace
 *  4. Rechtsgrundlage — legal basis for processing (Art. 6 DSGVO).   ⚠ replace
 *  5. Cookies — cookie usage disclosure.                              ⚠ replace
 *  6. Datensicherheit — SSL and security measures.                    ⚠ replace
 *  7. Ihre Rechte — user rights under Arts. 15–21 DSGVO.             ⚠ replace
 *  8. Dauer der Speicherung — retention periods.                      ⚠ replace
 *  9. Änderungen — policy change notice.                              ⚠ replace
 */
const PrivacyPolicyPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 text-left">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Datenschutzerklärung</h1>
          <p className="text-lg text-gray-600">
            Informationen zur Verarbeitung Ihrer Daten gemäß DSGVO
          </p>
          {/* "Stand" date is rendered dynamically so it always reflects the current date */}
          <p className="text-sm text-gray-500 mt-2">
            Stand: {new Date().toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Content card */}
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">

          {/* 1. Verantwortlicher ⚠ replace with accurate controller details */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-gray-900">1. Verantwortlicher</h2>
            </div>
            <div className="text-gray-700 space-y-3">
              <p>
                Verantwortlich für die Datenverarbeitung auf dieser Website ist:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-medium">Karlsruher Institut für Technologie (KIT)</p>
                <p>Kaiserstraße 12</p>
                <p>76131 Karlsruhe</p>
                <p className="mt-2">
                  E-Mail: <a href="mailto:info@kit.edu" className="text-primary hover:underline">info@kit.edu</a>
                </p>
              </div>
            </div>
          </section>

          {/* 2. Datenschutzbeauftragter ⚠ replace with accurate DPO contact */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Mail className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-gray-900">2. Datenschutzbeauftragter</h2>
            </div>
            <div className="text-gray-700 space-y-3">
              <p>
                Bei Fragen zum Datenschutz können Sie sich an unseren Datenschutzbeauftragten wenden:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-medium">Datenschutzbeauftragter des KIT</p>
                <p className="mt-2">
                  E-Mail: <a href="mailto:datenschutz@kit.edu" className="text-primary hover:underline">datenschutz@kit.edu</a>
                </p>
              </div>
            </div>
          </section>

          {/* 3. Erhebung und Speicherung ⚠ replace with accurate data collection details */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-gray-900">3. Erhebung und Speicherung personenbezogener Daten</h2>
            </div>
            <div className="text-gray-700 space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">3.1 Beim Besuch der Website</h3>
                <p className="text-sm leading-relaxed mb-2">
                  Beim Aufrufen unserer Website werden durch den Browser automatisch Informationen an den Server 
                  unserer Website gesendet. Diese Informationen werden temporär in einem sogenannten Logfile gespeichert:
                </p>
                <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                  <li>IP-Adresse des anfragenden Rechners</li>
                  <li>Datum und Uhrzeit des Zugriffs</li>
                  <li>Name und URL der abgerufenen Datei</li>
                  <li>Website, von der aus der Zugriff erfolgt (Referrer-URL)</li>
                  <li>Verwendeter Browser und ggf. das Betriebssystem Ihres Rechners</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-2">3.2 Bei Nutzung des Planungstools</h3>
                <p className="text-sm leading-relaxed mb-2">
                  Bei der Verwendung des KommMa-Planungstools werden folgende Daten verarbeitet:
                </p>
                <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                  <li>Eingaben zu kommunalen Daten (z.B. Gemeindeschlüssel, Einwohnerzahl)</li>
                  <li>Auswahl von Klimaschutzmaßnahmen und Präferenzen</li>
                  <li>Berechnungsergebnisse und Empfehlungen</li>
                </ul>
                <p className="text-sm leading-relaxed mt-2">
                  <strong>Wichtig:</strong> Alle Eingaben werden ausschließlich lokal in Ihrem Browser gespeichert. 
                  Es erfolgt keine dauerhafte Speicherung auf unseren Servern.
                </p>
              </div>
            </div>
          </section>

          {/* 4. Rechtsgrundlage ⚠ replace with legally reviewed basis */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-gray-900">4. Rechtsgrundlage</h2>
            </div>
            <div className="text-gray-700 space-y-3">
              <p className="text-sm leading-relaxed">
                Die Verarbeitung erfolgt gemäß Art. 6 Abs. 1 lit. f DSGVO auf Basis unseres berechtigten Interesses 
                an der Bereitstellung eines funktionsfähigen und nutzerfreundlichen Webauftritts.
              </p>
            </div>
          </section>

          {/* 5. Cookies ⚠ replace if cookie usage changes */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Cookie className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-gray-900">5. Cookies</h2>
            </div>
            <div className="text-gray-700 space-y-3">
              <p className="text-sm leading-relaxed">
                Unsere Website verwendet Cookies. Cookies sind kleine Textdateien, die im Internetbrowser bzw. 
                vom Internetbrowser auf dem Computersystem eines Nutzers gespeichert werden.
              </p>
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                <p className="text-sm font-medium text-blue-900 mb-1">Technisch notwendige Cookies</p>
                <p className="text-sm text-blue-800">
                  Wir verwenden ausschließlich technisch notwendige Cookies, um die Funktionalität 
                  der Website zu gewährleisten (z.B. Session-Cookies für die Speicherung Ihrer Eingaben).
                </p>
              </div>
            </div>
          </section>

          {/* 6. Datensicherheit ⚠ replace with accurate security measures */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-gray-900">6. Datensicherheit</h2>
            </div>
            <div className="text-gray-700 space-y-3">
              <p className="text-sm leading-relaxed">
                Wir verwenden innerhalb des Website-Besuchs das verbreitete SSL-Verfahren (Secure Socket Layer) 
                in Verbindung mit der jeweils höchsten Verschlüsselungsstufe, die von Ihrem Browser unterstützt wird.
              </p>
              <p className="text-sm leading-relaxed">
                Wir bedienen uns im Übrigen geeigneter technischer und organisatorischer Sicherheitsmaßnahmen, 
                um Ihre Daten gegen zufällige oder vorsätzliche Manipulationen, teilweisen oder vollständigen Verlust, 
                Zerstörung oder gegen den unbefugten Zugriff Dritter zu schützen.
              </p>
            </div>
          </section>

          {/* 7. Ihre Rechte ⚠ replace if applicable rights change */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-gray-900">7. Ihre Rechte</h2>
            </div>
            <div className="text-gray-700 space-y-3">
              <p className="text-sm leading-relaxed mb-3">
                Sie haben gegenüber uns folgende Rechte hinsichtlich der Sie betreffenden personenbezogenen Daten:
              </p>
              <ul className="list-disc list-inside text-sm space-y-2 ml-4">
                <li><strong>Recht auf Auskunft</strong> (Art. 15 DSGVO)</li>
                <li><strong>Recht auf Berichtigung</strong> (Art. 16 DSGVO)</li>
                <li><strong>Recht auf Löschung</strong> (Art. 17 DSGVO)</li>
                <li><strong>Recht auf Einschränkung der Verarbeitung</strong> (Art. 18 DSGVO)</li>
                <li><strong>Recht auf Datenübertragbarkeit</strong> (Art. 20 DSGVO)</li>
                <li><strong>Widerspruchsrecht</strong> (Art. 21 DSGVO)</li>
              </ul>
              <p className="text-sm leading-relaxed mt-4">
                Sie haben zudem das Recht, sich bei einer Datenschutz-Aufsichtsbehörde über die Verarbeitung 
                Ihrer personenbezogenen Daten durch uns zu beschweren.
              </p>
            </div>
          </section>

          {/* 8. Dauer der Speicherung ⚠ replace with accurate retention periods */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-gray-900">8. Dauer der Speicherung</h2>
            </div>
            <div className="text-gray-700 space-y-3">
              <p className="text-sm leading-relaxed">
                Logfiles werden nach spätestens 7 Tagen automatisch gelöscht.
              </p>
              <p className="text-sm leading-relaxed">
                Ihre Eingaben im Planungstool werden ausschließlich lokal in Ihrem Browser gespeichert und 
                können von Ihnen jederzeit durch Löschen der Browser-Daten entfernt werden.
              </p>
            </div>
          </section>

          {/* 9. Änderungen ⚠ replace if change notification process differs */}
          <section className="pt-6 border-t border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Änderungen dieser Datenschutzerklärung</h2>
            <div className="text-gray-700 space-y-3">
              <p className="text-sm leading-relaxed">
                Wir behalten uns vor, diese Datenschutzerklärung anzupassen, damit sie stets den aktuellen 
                rechtlichen Anforderungen entspricht oder um Änderungen unserer Leistungen in der Datenschutzerklärung 
                umzusetzen. Für Ihren erneuten Besuch gilt dann die neue Datenschutzerklärung.
              </p>
            </div>
          </section>

          {/* Contact box — data protection enquiries */}
          <section className="bg-gray-50 p-6 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3">Fragen zum Datenschutz?</h3>
            <p className="text-sm text-gray-700">
              Bei Fragen zur Erhebung, Verarbeitung oder Nutzung Ihrer personenbezogenen Daten, bei Auskünften, 
              Berichtigung, Sperrung oder Löschung von Daten wenden Sie sich bitte an:
            </p>
            <p className="text-sm text-gray-700 mt-2">
              E-Mail: <a href="mailto:datenschutz@kit.edu" className="text-primary hover:underline font-medium">datenschutz@kit.edu</a>
            </p>
          </section>

        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;