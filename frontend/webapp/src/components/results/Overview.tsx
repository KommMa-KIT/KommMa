/**
 * OverviewView.tsx
 *
 * The landing view of the results page, combining three sections:
 *  1. An explanatory info panel summarising how measures were scored.
 *  2. A togglable preview canvas that switches between GraphViewCanvas and
 *     MatrixCanvas, with a chevron toggle and pagination indicators. Clicking
 *     the canvas navigates to the corresponding full view.
 *  3. The full ranked ResultMeasureList below the fold.
 *
 * Graph edge data is fetched on mount for the graph preview. The matrix preview
 * requires no additional fetch as it uses the already-loaded ranked measures.
 */

import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Network, BarChart3, ChevronRight, ChevronLeft } from 'lucide-react';
import { selectRankedMeasures } from '../../store/ResultSlice';
import ResultMeasureList from './ResultMeasureList';
import GraphViewCanvas from './GraphViewCanvas';
import MatrixCanvas from './MatrixCanvas';
import graphService from '../../services/GraphService';
import { GraphEdge } from '../../types/graphTypes';

// --- Types ---

/** The two canvas types that can be shown in the preview slot. */
type PreviewType = 'graph' | 'matrix';

interface OverviewViewProps {
  /**
   * Optional callback fired when the user clicks the preview canvas.
   * Receives the currently displayed preview type so the parent can
   * switch the results page tab to the corresponding full view.
   */
  onNavigateToView?: (view: 'graph' | 'matrix') => void;
}

// --- Constants ---

/** Shared height in pixels for both preview canvases. */
const canvasHeight = 300;

// --- Component ---

/**
 * OverviewView
 *
 * Sections:
 *  - Redux state (all ranked measures)
 *  - previewType local state — controls which canvas is shown in the preview slot
 *  - Graph edge fetch via useEffect on mount (used only by the graph preview)
 *  - handlePreviewClick — navigates to the full view and scrolls to the tabs
 *  - togglePreview — flips the active preview between graph and matrix
 *  - Top section: info panel (left) + togglable preview canvas (right)
 *  - Bottom section: full ResultMeasureList
 */
const OverviewView = ({ onNavigateToView }: OverviewViewProps) => {
  /** All ranked measures from the Redux store, used by both preview canvases. */
  const rankedMeasures = useSelector(selectRankedMeasures);

  /** Which canvas is currently displayed in the preview slot. */
  const [previewType, setPreviewType] = useState<PreviewType>('graph');

  /** Graph edges fetched on mount; only needed when previewType is 'graph'. */
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);

  /** True while the graph edge fetch is in progress; shows a loading spinner. */
  const [graphLoading, setGraphLoading] = useState(true);

  // --- Data loading ---

  /**
   * Fetches graph edges once on mount for the graph preview panel.
   * Errors are logged but not surfaced in the UI — the graph preview
   * is decorative in this context and a failed fetch is non-critical.
   */
  useEffect(() => {
    const fetchGraphData = async () => {
      try {
        setGraphLoading(true);
        const edges = await graphService.fetchGraph();
        setGraphEdges(edges);
      } catch (err) {
        console.error('Failed to load graph for preview:', err);
      } finally {
        setGraphLoading(false);
      }
    };

    fetchGraphData();
  }, []);

  // --- Handlers ---

  /**
   * Navigates to the full view corresponding to the currently displayed preview.
   * Scrolls to the top so the results page tab bar is visible after navigation.
   */
  const handlePreviewClick = () => {
    if (onNavigateToView) {
      onNavigateToView(previewType);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** Toggles the preview canvas between graph and matrix. */
  const togglePreview = () => {
    setPreviewType(prev => prev === 'graph' ? 'matrix' : 'graph');
  };

  return (
    <div className="space-y-6">

      {/* Top section — info panel and preview canvas side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Info panel — explains scoring methodology and available views */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Ihr Ergebnis
          </h2>
          <div className="space-y-3 text-gray-700 leading-relaxed text-left">
            <p>
              Basierend auf Ihren Angaben haben wir {rankedMeasures.length} Klimaschutzmaßnahmen 
              für Ihre Kommune analysiert und bewertet.
            </p>
            <p>
              Die Maßnahmen wurden nach ihrem Gesamtscore sortiert, der sich aus den Faktoren 
              Kosten, Umsetzungszeit und Klimawirkung zusammensetzt. Je höher der Score, 
              desto besser passt die Maßnahme zu Ihrem Profil.
            </p>
            <p>
              Nutzen Sie die verschiedenen Ansichten, um die Maßnahmen zu erkunden:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>Liste:</strong> Detaillierte Übersicht aller Maßnahmen</li>
              <li><strong>Beziehungen:</strong> Synergien und Konflikte zwischen Maßnahmen</li>
              <li><strong>Matrix:</strong> Vergleich nach Kosten, Zeit und Klimawirkung</li>
            </ul>
          </div>
        </div>

        {/* Preview canvas panel — togglable between graph and matrix */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">

          {/* Preview header — icon and label reflect the active canvas type */}
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
            <div className="flex items-center gap-2">
              {previewType === 'graph' ? (
                <>
                  <Network className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-gray-900">Beziehungen</span>
                </>
              ) : (
                <>
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-gray-900">Matrix</span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="relative">

              {/* Chevron toggle button — position flips left/right with the active type
                  so it always points toward the hidden canvas */}
              <button
                onClick={togglePreview}
                className={`
                  absolute top-1/2 -translate-y-1/2 z-20
                  ${previewType === 'graph' ? 'left-4' : 'right-4'}
                  bg-white/90 hover:bg-white backdrop-blur-sm
                  p-3 rounded-full shadow-lg
                  transition-all duration-300
                  border border-gray-200 hover:border-gray-300
                  group
                `}
                aria-label={`Zur ${previewType === 'graph' ? 'Matrix' : 'Beziehungsansicht'}`}
              >
                {previewType === 'graph' ? (
                  <ChevronLeft className="w-5 h-5 text-gray-700 group-hover:text-primary transition-colors" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-700 group-hover:text-primary transition-colors" />
                )}
              </button>

              {/* Clickable canvas wrapper — overlay appears on hover to prompt navigation */}
              <div
                onClick={handlePreviewClick}
                className="relative cursor-pointer group"
              >
                {/* Hover overlay — reveals a navigation prompt on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors z-10 flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white px-4 py-2 rounded-lg shadow-lg">
                    <span className="text-sm font-medium text-gray-900">
                      Zur {previewType === 'graph' ? 'Beziehungsansicht' : 'Matrixansicht'} →
                    </span>
                  </div>
                </div>

                {/* Canvas preview — pointer-events disabled so clicks pass through
                    to the parent wrapper and trigger navigation rather than node selection */}
                <div className="pointer-events-none">
                  {previewType === 'graph' ? (
                    graphLoading ? (
                      <div className="h-[400px] flex items-center justify-center bg-gray-50">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : (
                      <GraphViewCanvas
                        measures={rankedMeasures}
                        edges={graphEdges}
                        selectedMeasureId={null}
                        onSelectMeasure={() => {}}
                        height={canvasHeight}
                      />
                    )
                  ) : (
                    <MatrixCanvas
                      measures={rankedMeasures}
                      selectedMeasureId={null}
                      onSelectMeasure={() => {}}
                      height={canvasHeight}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Pagination indicators — clicking either dot switches the active preview.
                Active indicator is visually lighter; inactive is darker. */}
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setPreviewType('matrix')}
                className={`
                  h-1 rounded-full transition-all duration-300 w-64
                  ${previewType === 'graph'
                    ? 'bg-gray-100 hover:bg-gray-200'
                    : 'bg-gray-300 hover:bg-gray-400'
                  }
                `}
                aria-label="Beziehungsansicht"
              />
              <button
                onClick={() => setPreviewType('graph')}
                className={`
                  h-1 rounded-full transition-all duration-300 w-64
                  ${previewType === 'matrix'
                    ? 'bg-gray-100 hover:bg-gray-200'
                    : 'bg-gray-300 hover:bg-gray-400'
                  }
                `}
                aria-label="Matrixansicht"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom section — full ranked measure list */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Alle Maßnahmen im Detail
          </h2>
          <p className="text-gray-600">
            Klicken Sie auf eine Maßnahme, um mehr Details zu sehen
          </p>
        </div>

        <ResultMeasureList />
      </div>
    </div>
  );
};

export default OverviewView;