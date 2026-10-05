import { Fragment } from 'react';

/** Findet http(s)-URLs und www.-Adressen im Text. */
const URL_REGEX = /(https?:\/\/[^\s<>]+|www\.[^\s<>]+)/gi;

/** Satzzeichen, die am Ende einer URL meist nicht mehr dazugehören. */
const TRAILING_PUNCTUATION = /[.,;:!?)\]}"']+$/;

const LinkifiedText = ({ text }: { text: string }) => {
  // split mit Capture-Group liefert abwechselnd: Text, URL, Text, URL, ...
  const parts = text.split(URL_REGEX);

  return (
    <>
      {parts.map((part, index) => {
        // Ungerade Indizes sind die gematchten URLs
        if (index % 2 === 0) {
          return <Fragment key={index}>{part}</Fragment>;
        }

        // Abschließende Satzzeichen vom Link abtrennen
        const trailing = part.match(TRAILING_PUNCTUATION)?.[0] ?? '';
        const url = trailing ? part.slice(0, -trailing.length) : part;
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