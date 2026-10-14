/**
 * GraphView.tsx
 *
 * The results-page view that renders an interactive dependency graph for the
 * top-ranked measures alongside a scrollable compact measure list. Graph edge
 * data and its loading state are read from the GraphSlice (populated app-wide by
 * GraphInitializer); the top-ranked measures are read from the ResultSlice.
 * Selecting a measure in either the canvas or the list highlights it in both
 * panels via shared selectedMeasureId state.
 */

import { useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import { Network } from 'lucide-react';
import { selectTopNMeasures } from '../../../store/ResultSlice';
import { selectGraphEdges, selectGraphError, selectGraphLoading } from '../../../store/GraphSlice';
import { LEGEND_RELATION_TYPES, RELATION_TYPE_CONFIG } from '../../../types/graphTypes';
import GraphViewCanvas from './GraphViewCanvas';
import ResultMeasureCompactList from '../result-measure/compact-card/ResultMeasureCompactList';

// --- Constants ---

/** Maximum number of top-ranked measures shown as graph nodes and list entries. */
const GRAPH_NODE_LIMIT = 20;

/**
 * Selector for the top-ranked measures. Created once at module level so that
 * useSelector receives a stable function reference across renders.
 */
const selectGraphMeasures = selectTopNMeasures(GRAPH_NODE_LIMIT);

// --- Component ---

/**
 * GraphView
 *
 * Sections:
 *  - Redux state (top ranked measures, graph edges, loading flag, error)
 *  - Local state: selectedMeasureId
 *  - Two-column layout:
 *      Left (2/3): GraphViewCanvas with loading/error/canvas states + edge legend
 *      Right (1/3): Sticky ResultMeasureCompactList with a usage hint,
 *                   scrollable to 700 px
 */
const GraphView = () => {
  /** The top-ranked measures, used as graph nodes and list entries. */
  const rankedMeasures = useSelector(selectGraphMeasures);

  /** Directed edges between measures, loaded once by GraphInitializer. */
  const edges = useSelector(selectGraphEdges);

  /** True until the graph edges are available. */
  const loading = useSelector(selectGraphLoading);

  /** Error message from a failed edge fetch; null when healthy. */
  const error = useSelector(selectGraphError);

  /**
   * The ID of the measure currently highlighted in both the canvas and the
   * compact list. Null when no measure is selected. Shared between the two
   * panels so that clicking a node in the canvas selects the corresponding
   * list item and vice versa.
   */
  const [selectedMeasureId, setSelectedMeasureId] = useState<string | null>(null);

  /**
   * Selection handler shared by canvas and list. Selecting the measure that is
   * already selected clears the selection (toggle); null always clears it.
   */
  const handleSelectMeasure = useCallback((id: string | null) => {
    setSelectedMeasureId((current) => (id === null || current === id ? null : id));
  }, []);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

      {/* Left panel (2/3 width) — graph canvas and edge legend */}
      <div className="xl:col-span-2 space-y-4">

        {/* Graph canvas — three render states: loading spinner, error, canvas */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="h-[600px] flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-600">Lade Graphdaten...</p>
              </div>
            </div>
          ) : error ? (
            <div className="h-[600px] flex items-center justify-center bg-red-50">
              <p className="text-red-600">{error}</p>
            </div>
          ) : (
            <GraphViewCanvas
              measures={rankedMeasures}
              edges={edges}
              selectedMeasureId={selectedMeasureId}
              onSelectMeasure={handleSelectMeasure}
            />
          )}
        </div>

        {/* Edge type legend — generated from RELATION_TYPE_CONFIG; types with showInLegend: false are omitted */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Legende</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {LEGEND_RELATION_TYPES.map((type) => {
              const { label, legendColor } = RELATION_TYPE_CONFIG[type];
              return (
                <div key={type} className="flex items-center gap-2">
                  <div className="w-8 h-1 rounded" style={{ backgroundColor: legendColor }}></div>
                  <span className="text-sm text-gray-700">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right panel (1/3 width) — sticky compact measure list */}
      <div className="xl:col-span-1">
        <div className="bg-white rounded-lg shadow-sm sticky top-4">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-1">
              <Network className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-gray-900">Maßnahmen</h3>
            </div>
            <p className="text-xs text-gray-500">
              <span className="block">Klicken Sie auf eine Maßnahme, um sie in der Matrix hervorzuheben.</span>
              <span className="block">Über das Info-Symbol öffnen Sie die Detailansicht.</span>
            </p>
          </div>

          {/* Scrollable list — capped at 700 px to keep the panel within the viewport */}
          <div className="max-h-[700px] overflow-y-auto">
            <ResultMeasureCompactList
              selectedMeasureId={selectedMeasureId}
              onSelectMeasure={handleSelectMeasure}
            />
          </div>
        </div>
      </div>

    </div>
  );
};

export default GraphView;