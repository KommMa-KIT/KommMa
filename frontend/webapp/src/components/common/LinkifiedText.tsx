/**
 * LinkifiedText.tsx
 *
 * A text renderer that turns URLs inside plain text into clickable links.
 * Recognizes http(s):// URLs and bare www. addresses, keeps trailing sentence
 * punctuation outside of the link, and renders everything as regular React
 * children, so no HTML is injected. Links open in a new tab.
 */

import { Fragment } from 'react';

// --- Patterns ---

/**
 * URL_REGEX
 *
 * Matches http(s):// URLs and bare www. addresses in plain text. A match runs
 * until the next whitespace, "<" or ">" character, so it may still include
 * trailing punctuation (see TRAILING_PUNCTUATION).
 *
 * The pattern is wrapped in a capture group on purpose: String.split includes
 * captured groups in its result, which LinkifiedText relies on to keep the
 * matched URLs in the output.
 */
const URL_REGEX = /(https?:\/\/[^\s<>]+|www\.[^\s<>]+)/gi;

/**
 * TRAILING_PUNCTUATION
 *
 * Matches punctuation at the end of a URL candidate that most likely belongs
 * to the surrounding sentence rather than to the URL, e.g. the period in
 * "Visit https://example.com." or the closing parenthesis in
 * "(see https://example.com)".
 *
 * URLs that legitimately end in one of these characters (for example a
 * Wikipedia link ending in ")") will have that character split off.
 */
const TRAILING_PUNCTUATION = /[.,;:!?)\]}"']+$/;

// --- Types ---

interface LinkifiedTextProps {
  /** Plain text that may contain http(s):// URLs or www. addresses. */
  text: string;
}

// --- Component ---

/**
 * LinkifiedText
 *
 * Renders the given text and wraps every URL it contains in an anchor tag.
 *
 *  - http://, https:// and bare www. URLs are detected.
 *  - Bare www. URLs get an https:// prefix in the href, while the visible
 *    link text stays exactly as written.
 *  - Trailing sentence punctuation is rendered after the link, not inside it.
 *  - Links open in a new tab with rel="noopener noreferrer".
 *
 * The component returns a fragment, so it can be placed inside any text
 * container (<p>, <span>, ...) without adding extra DOM nodes.
 */
const LinkifiedText = ({ text }: LinkifiedTextProps) => {
  /**
   * Because URL_REGEX contains a capture group, split() returns text segments
   * and matched URLs alternately: text, URL, text, URL, ... Even indices are
   * therefore plain text, odd indices are URLs.
   */
  const parts = text.split(URL_REGEX);

  return (
    <>
      {parts.map((part, index) => {
        // Even indices: plain text between (or around) URLs.
        if (index % 2 === 0) {
          return <Fragment key={index}>{part}</Fragment>;
        }

        /**
         * Odd indices: URL candidates. Trailing punctuation is separated so it
         * is rendered after the link instead of becoming part of it.
         */
        const trailing = part.match(TRAILING_PUNCTUATION)?.[0] ?? '';
        const url = trailing ? part.slice(0, -trailing.length) : part;

        /**
         * Bare www. addresses need a protocol, otherwise the browser would
         * resolve the href as a relative path.
         */
        const href = url.startsWith('www.') ? `https://${url}` : url;

        return (
          <Fragment key={index}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary hover:text-tertiary hover:underline transition-colors break-all"
            >
              {url}
            </a>
            {trailing}
          </Fragment>
        );
      })}
    </>
  );
};

export default LinkifiedText;