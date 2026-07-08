/**
 * FAQPage.tsx
 *
 * Static FAQ (Frequently Asked Questions) page for the application. Presents
 * questions grouped into topical sections, each rendered as an accordion so
 * users can scan questions quickly and expand only what they need.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, HelpCircle, ArrowLeft } from 'lucide-react';
import Button from '../components/Button';

// --- Types ---

interface FAQItem {
  /** The question text shown as the accordion trigger. */
  question: string;
  /** The answer text shown when the item is expanded. */
  answer: string;
}

interface FAQSection {
  /** Section heading (e.g. "Allgemein", "Daten & Aktualität"). */
  title: string;
  /** Questions belonging to this section. */
  items: FAQItem[];
}

// --- Data ---

/**
 * Static FAQ content grouped by topic. Kept as plain data rather than fetched
 * from the backend since the content changes rarely and doesn't depend on
 * user or session state.
 */
const FAQ_SECTIONS: FAQSection[] = [
  {
    title: 'Allgemein',
    items: [
      {
        question: 'Was ist KommMa?',
        answer:
          'KommMa ist ein Priorisierungstool für kommunale Klimaschutzmaßnahmen. Es unterstützt Entscheidungsträger:innen dabei, die wirkungsvollsten Maßnahmen für ihre Kommune zu identifizieren, miteinander zu vergleichen und umzusetzen.',
      },
      {
        question: 'Für wen ist KommMa gedacht?',
        answer:
          'KommMa richtet sich an Klimaschutzmanager:innen, Verwaltungsmitarbeitende und politische Entscheidungsträger:innen in Kommunen, die Klimaschutzmaßnahmen planen, bewerten oder priorisieren möchten.',
      },
      {
        question: 'Kostet die Nutzung von KommMa etwas?',
        answer:
          'lorem ipsum.',
      },
    ],
  },
  {
    title: 'Erste Schritte',
    items: [
      {
        question: 'Wie starte ich eine neue Analyse?',
        answer:
          'Klicken Sie auf der Startseite auf „Neue Analyse starten". Sie werden anschließend durch die einzelnen Kategorien geführt, in denen Sie die relevanten Daten Ihrer Kommune eingeben.',
      },
      {
        question: 'Kann ich das Tool erst testen, bevor ich eigene Daten eingebe?',
        answer:
          'Ja. Auf der Startseite finden Sie prototypische Beispielkommunen. Wählen Sie eine davon aus, um die Funktionsweise des Tools mit vordefinierten Daten kennenzulernen.',
      },
      {
        question: 'Kann ich eine begonnene Analyse später fortsetzen?',
        answer:
          'Ja, über „Sitzung importieren" können Sie eine zuvor exportierte Sitzung wieder laden und Ihre Analyse an der gespeicherten Stelle fortsetzen.',
      },
    ],
  },
  {
    title: 'Daten & Aktualität',
    items: [
      {
        question: 'Woher stammen die Daten, die KommMa verwendet?',
        answer:
          'KommMa greift auf öffentlich verfügbare kommunale und statistische Datensätze zurück, die regelmäßig auf Aktualität geprüft werden.',
      },
      {
        question: 'Was bedeutet der Hinweis „Veraltete Daten" auf der Startseite?',
        answer:
          'Dieser Hinweis erscheint, wenn eine oder mehrere der zugrunde liegenden Datenquellen seit längerem nicht aktualisiert wurden. Berechnungen sind weiterhin möglich, sollten aber mit dieser Einschränkung im Hinterkopf interpretiert werden.',
      },
      {
        question: 'Werden meine eingegebenen Daten gespeichert?',
        answer:
          'Ihre Eingaben werden ausschließlich in Ihrer Sitzung verarbeitet. Möchten Sie eine Analyse dauerhaft sichern, nutzen Sie die Export-Funktion, um sie später wieder zu importieren.',
      },
    ],
  },
  {
    title: 'Ergebnisse & Auswertung',
    items: [
      {
        question: 'Wie werden Maßnahmen priorisiert?',
        answer:
          'KommMa bewertet Maßnahmen anhand mehrerer Kriterien, etwa Zeit, Kosten und Treibhausgasemissionseinsparungen und erstellt daraus eine vergleichende Rangfolge, die Ihnen als Entscheidungsgrundlage dient.',
      },
      {
        question: 'Kann ich die Ergebnisse exportieren?',
        answer:
          'Ja, Ergebnisse lassen sich via pdf und csv exportieren.',
      },
      {
        question: 'Ersetzt KommMa eine fachliche Beratung?',
        answer:
          'Nein. KommMa dient als Orientierungshilfe und Priorisierungswerkzeug, ersetzt aber keine vertiefte fachliche oder rechtliche Beratung bei der konkreten Umsetzung von Maßnahmen.',
      },
    ],
  },
];

// --- Component ---

/**
 * FAQPage
 *
 * Sections:
 *  - Header with title, description, and back-to-start action.
 *  - One block per FAQSection, rendering its title and its FAQItems.
 *  - Each FAQItem is an accordion row; open state is tracked per-item via a
 *    composite key ("sectionIndex-itemIndex") so multiple items can be open
 *    across different sections simultaneously.
 */
const FAQPage = () => {
  const navigate = useNavigate();

  /** Set of currently expanded item keys ("sectionIndex-itemIndex"). */
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  // --- Handlers ---

  /** Toggles the expanded state of a single FAQ item. */
  const toggleItem = (key: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <>
      {/* Header section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10 py-16 px-4">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-4xl font-semibold tracking-tight text-balance text-green-900 sm:text-5xl">
              Häufig gestellte Fragen
            </h1>
          </div>

          <p className="text-lg text-muted-foreground mb-8 max-w-2xl">
            Antworten auf die häufigsten Fragen rund um KommMa.
          </p>

          <Button variant="outline" onClick={() => navigate('/')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Zurück zur Startseite
          </Button>
        </div>
      </div>

      {/* FAQ content */}
      <div className="bg-gray-100 py-16 px-4">
        <div className="container mx-auto max-w-3xl space-y-12">
          {FAQ_SECTIONS.map((section, sectionIndex) => (
            <div key={section.title}>
              <h2 className="text-2xl font-bold text-green-900 mb-4">
                {section.title}
              </h2>

              <div className="space-y-3">
                {section.items.map((item, itemIndex) => {
                  const key = `${sectionIndex}-${itemIndex}`;
                  const isOpen = openItems.has(key);

                  return (
                    <div
                      key={key}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                    >
                      <button
                        onClick={() => toggleItem(key)}
                        className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 hover:bg-gray-50 transition-colors"
                        aria-expanded={isOpen}
                      >
                        <span className="font-medium text-gray-900">
                          {item.question}
                        </span>
                        <ChevronDown
                          className={`h-5 w-5 text-gray-500 flex-shrink-0 transition-transform duration-200 ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {isOpen && (
                        <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed">
                          {item.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default FAQPage;