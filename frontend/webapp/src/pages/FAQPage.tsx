/**
 * FAQPage.tsx
 *
 * Static FAQ (Frequently Asked Questions) page for the application. Presents
 * questions grouped into topical sections, each rendered as an accordion so
 * users can scan questions quickly and expand only what they need.
 *
 * The content itself lives in `../content/faq.json`, so questions and answers
 * can be edited without touching the component. Answers are written in
 * Markdown and rendered with react-markdown.
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronDown, ArrowLeft } from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import Button from '../components/Button';
import faqData from '../content/faq.json';

// --- Types ---

interface FAQItem {
  /** The question text shown as the accordion trigger. */
  question: string;
  /** The answer text (Markdown) shown when the item is expanded. */
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
 * FAQ content grouped by topic, loaded from the JSON file. Kept as static
 * data rather than fetched from the backend since the content changes rarely
 * and doesn't depend on user or session state. The explicit type annotation
 * makes the compiler verify that the JSON matches the expected structure.
 */
const FAQ_SECTIONS: FAQSection[] = faqData;

// --- Markdown rendering ---

const LINK_CLASS = 'text-green-800 underline hover:text-green-900';

/**
 * Element overrides for rendered answers. Internal links (starting with "/")
 * use the router's Link to avoid a full page reload; http(s) links open in a
 * new tab; other schemes such as mailto: use the default behavior. List and
 * paragraph styles are set here because Tailwind's reset removes the browser
 * defaults.
 */
const MARKDOWN_COMPONENTS: Components = {
  a: ({ href = '', children }) => {
    if (href.startsWith('/')) {
      return (
        <Link to={href} className={LINK_CLASS}>
          {children}
        </Link>
      );
    }

    const isWebLink = /^https?:\/\//.test(href);
    return (
      <a
        href={href}
        target={isWebLink ? '_blank' : undefined}
        rel={isWebLink ? 'noopener noreferrer' : undefined}
        className={LINK_CLASS}
      >
        {children}
      </a>
    );
  },
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc pl-5 mb-2 last:mb-0 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 mb-2 last:mb-0 space-y-1">{children}</ol>
  ),
};

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
                        <div className="px-5 pb-4 text-sm text-left text-gray-600 leading-relaxed">
                          <ReactMarkdown components={MARKDOWN_COMPONENTS}>
                            {item.answer}
                          </ReactMarkdown>
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