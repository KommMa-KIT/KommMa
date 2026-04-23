/**
 * MeasuresPage.tsx
 *
 * A browsable catalogue of all available climate protection measures, accessible
 * before any calculation has been run. Fetches the measure list from the backend
 * on mount via the MeasuresSlice thunk, and renders one of three states:
 *  - Loading: a MeasureSkeletonGrid placeholder grid.
 *  - Error: an error banner with a retry button; the content area renders null.
 *  - Success: the MeasureSearch bar followed by the filtered MeasureList.
 */

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import MeasureSearch from '../components/measures/MeasureSearch';
import MeasureList from '../components/measures/MeasureList';
import { MeasureSkeletonGrid } from '../components/measures/MeasureSkeleton';
import {
  fetchMeasures,
  selectMeasuresLoading,
  selectMeasuresError,
  clearError,
} from '../store/MeasuresSlice';
import { AppDispatch } from '../store/store';

// --- Component ---

/**
 * MeasuresPage
 *
 * Sections:
 *  - Redux state (loading flag, error message)
 *  - fetchMeasures dispatch on mount
 *  - handleRetry — clears the error and re-dispatches the fetch
 *  - Header — page title and description
 *  - Error banner — shown when the fetch fails; includes a retry button
 *  - Search bar — shown only in the success state
 *  - Content area — switches between skeleton, null, and MeasureList
 */
const MeasuresPage = () => {
  const dispatch = useDispatch<AppDispatch>();

  /** True while the measure fetch is in progress. */
  const loading = useSelector(selectMeasuresLoading);

  /** Error message from a failed fetch; null when healthy. */
  const error = useSelector(selectMeasuresError);

  // --- Effects ---

  /**
   * Fetches all measures from the backend on mount. The dispatch reference is
   * stable, so this effect runs exactly once for the lifetime of the page.
   */
  useEffect(() => {
    dispatch(fetchMeasures());
  }, [dispatch]);

  // --- Handlers ---

  /**
   * Clears the current error state before re-dispatching the fetch, so the UI
   * transitions back to the loading state rather than showing both the error
   * banner and the skeleton simultaneously.
   */
  const handleRetry = () => {
    dispatch(clearError());
    dispatch(fetchMeasures());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Klimaschutzmaßnahmen
          </h1>
          <p className="text-lg text-gray-600 max-w-6xl">
            Hier finden Sie eine Übersicht aller verfügbaren Klimaschutzmaßnahmen. Nutzen Sie die Suchfunktion, um gezielt nach bestimmten Maßnahmen zu suchen.
          </p>
        </div>

        {/* Error banner — shown when the fetch fails, regardless of loading state */}
        {error && (
          <div className="mb-8 bg-red-50 border-l-4 border-red-400 p-4 rounded-lg shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-800 mb-1">
                  Fehler beim Laden der Maßnahmen
                </h3>
                <p className="text-sm text-red-700 mb-3">{error}</p>
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  <RefreshCw className="h-4 w-4" />
                  Erneut versuchen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search bar — only rendered in the success state to avoid appearing
            above an error banner or over a skeleton grid */}
        {!loading && !error && (
          <div className="mb-8">
            <MeasureSearch />
          </div>
        )}

        {/* Content area — three mutually exclusive render states */}
        {loading ? (
          /* Loading state — skeleton grid approximates the eventual card layout */
          <MeasureSkeletonGrid count={6} />
        ) : error ? (
          /* Error state — content area is empty; the banner above carries the message */
          null
        ) : (
          /* Success state — filtered measure list driven by MeasuresSlice */
          <MeasureList />
        )}

      </div>
    </div>
  );
};

export default MeasuresPage;