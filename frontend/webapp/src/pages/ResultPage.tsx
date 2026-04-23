/**
 * ResultPage.tsx
 *
 * Top-level page for displaying personalised climate-measure recommendations.
 * Manages view switching (overview / list / matrix / graph), filter/sort dialogs,
 * export dialogs, and the individualisation progress bar.
 *
 * Data flow:
 *  - Measures are fetched from the MeasuresSlice on mount.
 *  - Ranked results and filter state are read from the ResultSlice.
 *  - GraphInitializer loads dependency-graph edges in the background.
 */

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AlertTriangle, BarChart3, Grid3x3, List, Network, SlidersHorizontal, Download } from 'lucide-react';
import { ResultMeasureSkeletonList } from '../components/results/ResultMeasureSkeleton';
import IndividualisationProgressBar from '../components/results/IndividualisationProgressBar';
import FilterSortDialog from '../components/results/FilterSortDialog';
import ExportDialog from '../components/results/ExportDialog';
import exportService from '../services/ExportService';
import graphService from '../services/GraphService';
import {
  selectRankedMeasures,
  selectIndividualismLevels,
  selectResultsLoading,
  selectResultsError,
  selectFilters,
  selectVisibleMeasures,
  setFilters,
} from '../store/ResultSlice';
import {
  fetchMeasures,
  selectMeasuresLoading,
} from '../store/MeasuresSlice';
import { AppDispatch } from '../store/store';
import OverviewView from '../components/results/Overview';
import ListView from '../components/results/ListView';
import GraphView from '../components/results/GraphView';
import MatrixView from '../components/results/MatrixView';
import GraphInitializer from '../components/GraphInitializer';
import Button from '../components/Button';

type ViewType = 'overview' | 'list' | 'matrix' | 'graph';

/**
 * ResultPage
 *
 * Sections:
 *  - **Page header** – title, Filter & Sort button, Export button.
 *  - **Individualisation bar** – shows how personalised the current input data is.
 *  - **Tab navigation** – switches between Overview, List, Matrix, and Graph views.
 *  - **Active view** – renders the selected view component.
 *  - **Dialogs** – FilterSortDialog and ExportDialog (rendered outside the tab area).
 *
 * Loading state renders skeleton cards; error state shows an alert banner.
 */
const ResultPage = () => {
  const dispatch           = useDispatch<AppDispatch>();
  const rankedMeasures     = useSelector(selectRankedMeasures);
  const individualismLevels = useSelector(selectIndividualismLevels);
  const resultsLoading     = useSelector(selectResultsLoading);
  const resultsError       = useSelector(selectResultsError);
  const measuresLoading    = useSelector(selectMeasuresLoading);
  const filters            = useSelector(selectFilters);
  const visibleMeasures    = useSelector(selectVisibleMeasures);

  const [activeView,       setActiveView]       = useState<ViewType>('overview');
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Fetch measure definitions on mount
  useEffect(() => {
    dispatch(fetchMeasures());
  }, [dispatch]);

  const hasResults = rankedMeasures.length > 0;
  const loading    = measuresLoading || resultsLoading;
  const error      = resultsError;

  const tabs: { id: ViewType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Übersicht',   icon: BarChart3 },
    { id: 'list',     label: 'Liste',       icon: List      },
    { id: 'matrix',   label: 'Matrix',      icon: Grid3x3   },
    { id: 'graph',    label: 'Beziehungen', icon: Network   },
  ];

  // --- Export handlers ---

  /**
   * Exports visible measures to PDF, including the dependency-graph edge table when
   * graph data is available. Falls back to a graph-free export on fetch failure.
   */
  const handleExportPDF = async () => {
    const measuresToExport = visibleMeasures.map((item: any, index: number) => ({
      ...item,
      rank: index + 1,
    }));

    try {
      const edges = await graphService.fetchGraph();
      exportService.exportPDF(measuresToExport, edges);
    } catch (err) {
      console.warn('Graph edges unavailable, exporting without relationships:', err);
      exportService.exportPDF(measuresToExport);
    }
  };

  /**
   * Exports visible measures to a semicolon-delimited CSV file.
   */
  const handleExportCSV = () => {
    const measuresToExport = visibleMeasures.map((item: any, index: number) => ({
      ...item,
      rank: index + 1,
    }));
    exportService.exportCSV(measuresToExport);
  };

  /** Commits updated filters to the Redux store. */
  const handleFiltersChange = (newFilters: any) => {
    dispatch(setFilters(newFilters));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10">
      {/* Loads dependency-graph edges in the background */}
      <GraphInitializer />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Page header */}
        <div className="mb-8">
          <div className="relative flex items-center justify-between mb-3">
            <Button
              onClick={() => setFilterDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              disabled={!hasResults || loading}
            >
              <SlidersHorizontal className="h-5 w-5" />
              Filtern & Sortieren
            </Button>

            <h1 className="absolute left-1/2 -translate-x-1/2 text-4xl font-bold text-gray-900 whitespace-nowrap">
              Ihre personalisierten Empfehlungen
            </h1>

            <Button
              onClick={() => setExportDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              disabled={!hasResults || loading}
            >
              <Download className="h-5 w-5" />
              Exportieren
            </Button>
          </div>

          <p className="text-lg text-gray-600 text-center mx-auto max-w-4xl px-4">
            Basierend auf Ihren Angaben haben wir diese Klimaschutzmaßnahmen für Sie zusammengestellt.
            Die Bewertungen zeigen, wie gut jede Maßnahme zu Ihren Präferenzen passt.
          </p>
        </div>

        {/* Individualisation progress bar */}
        {hasResults && (
          <div className="mb-6">
            <IndividualisationProgressBar
              score={individualismLevels.total}
              levels={individualismLevels}
            />
          </div>
        )}

        {/* Dialogs */}
        <FilterSortDialog
          open={filterDialogOpen}
          onOpenChange={setFilterDialogOpen}
          filters={filters}
          onFiltersChange={handleFiltersChange}
        />
        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          onExportPDF={handleExportPDF}
          onExportCSV={handleExportCSV}
        />

        {/* Error banner */}
        {error && (
          <div className="mb-8 bg-red-50 border-l-4 border-red-400 p-4 rounded-lg shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-800 mb-1">
                  Fehler beim Laden der Daten. Bitte navigieren Sie zurück zur Eingabeseite und laden Sie
                  Ihre Eingabe herunter, bevor Sie die Seite neu laden.
                </h3>
                <p className="text-sm text-red-700 mb-3">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab navigation */}
        {hasResults && !loading && (
          <div className="mb-6 border-b border-gray-200">
            <nav className="flex gap-8" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                    activeView === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* View content */}
        {loading ? (
          <ResultMeasureSkeletonList count={3} />
        ) : error ? null : (
          <>
            {activeView === 'overview' && <OverviewView onNavigateToView={setActiveView} />}
            {activeView === 'list'     && <ListView />}
            {activeView === 'graph'    && <GraphView />}
            {activeView === 'matrix'   && <MatrixView />}
          </>
        )}
      </div>
    </div>
  );
};

export default ResultPage;