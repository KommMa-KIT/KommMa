/**
 * MeasureSearch.tsx
 *
 * A controlled search input that dispatches query updates to the Redux store,
 * where they are consumed by selectFilteredMeasures to filter the measure list
 * in real time. Renders an inline clear button when a query is active.
 */

import { Search, X } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setSearchQuery,
  clearSearch,
  selectSearchQuery,
} from '../../store/MeasuresSlice';

// --- Component ---

/**
 * MeasureSearch
 *
 * Thin Redux-connected wrapper around a text input. Every keystroke dispatches
 * setSearchQuery; the clear button dispatches clearSearch. Filtering itself is
 * handled entirely in the MeasuresSlice selector, so this component has no
 * local filter logic.
 */
const MeasureSearch = () => {
  const dispatch = useDispatch();

  /** The active search query string from the Redux store; empty string when inactive. */
  const searchQuery = useSelector(selectSearchQuery);

  // --- Handlers ---

  /** Dispatches the updated query string on every input change. */
  const handleSearch = (value: string) => {
    dispatch(setSearchQuery(value));
  };

  /** Resets the search query to its initial empty state. */
  const handleClearSearch = () => {
    dispatch(clearSearch());
  };

  return (
    <div className="space-y-4">

      {/* Search input with inset search icon and conditional clear button */}
      <div className="flex gap-3">
        <div className="relative flex-1">

          {/* Decorative search icon — inset on the left, non-interactive */}
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />

          <input
            type="text"
            placeholder="Maßnahmen durchsuchen..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
          />

          {/* Clear button — only rendered when a query is active */}
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Suche löschen"
            >
              <X className="h-5 w-5" />
            </button>
          )}

        </div>
      </div>
    </div>
  );
};

export default MeasureSearch;