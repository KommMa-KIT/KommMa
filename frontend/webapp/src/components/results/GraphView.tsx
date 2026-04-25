/**
 * GraphView.tsx
 *
 * The results-page view that renders an interactive dependency graph for the
 * top-ranked measures alongside a scrollable compact measure list. Graph edge
 * data is fetched asynchronously from GraphService on mount; the top 20 ranked
 * measures are read from the Redux store. Selecting a measure in either the
 * canvas or the list highlights it in both panels via shared selectedMeasureId
 * state.
 */

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Network } from 'lucide-react';
import { selectTopNMeasures } from '../../store/ResultSlice';
import GraphViewCanvas from './GraphViewCanvas';
import graphService from '../../services/GraphService';
import { GraphEdge } from '../../types/graphTypes';
import ResultMeasureCompactList from './ResultMeasureCompactList';

// --- Component ---

/**
 * GraphView
 *
 * Sections:
 *  - Redux state (top 20 ranked measures)
 *  - Local state: edges, loading, error, selectedMeasureId
 *  - Graph edge fetch via useEffect on mount
 *  - Two-column layout:
 *      Left (2/3): GraphViewCanvas with loading/error/canvas states + edge legend
 *      Right (1/3): Sticky ResultMeasureCompactList, scrollable to 700 px
 */
const GraphView = () => {
  /** The top 20 measures by rank, used as graph nodes and list entries. */
  const rankedMeasures = useSelector(selectTopNMeasures(20));

  /** Directed edges between measures fetched from the backend graph data. */
  const [edges, setEdges] = useState<GraphEdge[]>([]);

  /** True while the graph edge fetch is in progress. */
  const [loading, setLoading] = useState(true);

  /** Error message from a failed edge fetch; null when healthy. */
  const [error, setError] = useState<string | null>(null);

  /**
   * The ID of the measure currently highlighted in both the canvas and the
   * compact list. Null when no measure is selected. Shared between the two
   * panels so that clicking a node in the canvas selects the corresponding
   * list item and vice versa.
   */
  const [selectedMeasureId, setSelectedMeasureId] = useState<string | null>(null);

  // --- Data loading ---

  /**
   * Fetches all graph edges on mount. Edges are static relative to the result
   * set, so a single fetch on mount is sufficient — no dependency on Redux state.
   */
  useEffect(() => {
    const fetchGraphData = async () => {
      try {
        setLoading(true);
        const graphEdges = await graphService.fetchGraph();
        setEdges(graphEdges);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden des Graphen');
      } finally {
        setLoading(false);
      }
    };

    fetchGraphData();
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
              onSelectMeasure={setSelectedMeasureId}
            />
          )}
        </div>

        {/* Edge type legend — colour-coded to match GraphViewCanvas rendering */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Legende</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-1 bg-green-500 rounded"></div>
              <span className="text-sm text-gray-700">Synergie</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-1 bg-red-500 rounded"></div>
              <span className="text-sm text-gray-700">Konflikt</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-1 bg-blue-500 rounded"></div>
              <span className="text-sm text-gray-700">Abhängigkeit</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-1 bg-purple-500 rounded"></div>
              <span className="text-sm text-gray-700">Voraussetzung</span>
            </div>
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
          </div>

          {/* Scrollable list — capped at 700 px to keep the panel within the viewport */}
          <div className="max-h-[700px] overflow-y-auto">
            <ResultMeasureCompactList
              selectedMeasureId={selectedMeasureId}
              onSelectMeasure={setSelectedMeasureId}
            />
          </div>
        </div>
      </div>

    </div>
  );
};

export default GraphView;