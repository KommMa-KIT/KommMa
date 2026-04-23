/**
 * MeasureList.tsx
 *
 * Renders the filtered grid of MeasureCard previews on the measures page.
 * Reads the currently filtered measure list and active search query from Redux,
 * and displays a contextual empty state when no measures match the current filter.
 */

import { useSelector } from 'react-redux';
import MeasureCard from './MeasureCard';
import { selectFilteredMeasures, selectSearchQuery } from '../../store/MeasuresSlice';
import { AlertCircle } from 'lucide-react';

// --- Component ---

/**
 * MeasureList
 *
 * Two render paths:
 *  - Empty state: shown when the filtered list is empty, with a search-aware
 *    message distinguishing "no results for query" from "nothing loaded yet".
 *  - Grid: a result counter followed by a responsive 1→2→3 column card grid.
 */
const MeasureList = () => {
  /** The currently visible measures after all active filters have been applied. */
  const measures = useSelector(selectFilteredMeasures);

  /** The active search query string; empty string when no search is active. */
  const searchQuery = useSelector(selectSearchQuery);

  // --- Empty state ---

  /**
   * Distinguish between two empty-state causes so the message is actionable:
   *  - Active search with no hits → prompt the user to refine their query.
   *  - No search active → indicate that no measures have been loaded yet.
   */
  if (measures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <AlertCircle className="h-16 w-16 text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Keine Maßnahmen gefunden
        </h3>
        <p className="text-gray-600 text-center max-w-md">
          {searchQuery
            ? `Keine Ergebnisse für "${searchQuery}". Versuche es mit anderen Suchbegriffen.`
            : 'Es wurden noch keine Maßnahmen geladen.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Result counter — appends the search query when one is active */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{measures.length}</span>{' '}
          {measures.length === 1 ? 'Maßnahme' : 'Maßnahmen'}
          {searchQuery && ` für "${searchQuery}"`}
        </p>
      </div>

      {/* Responsive card grid: 1 column on mobile, 2 on md, 3 on lg */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {measures.map((measure) => (
          <MeasureCard key={measure.id} measure={measure} />
        ))}
      </div>

    </div>
  );
};

export default MeasureList;