/**
 * GraphViewCanvas.tsx
 *
 * A ReaGraph-backed interactive graph canvas rendering the top-ranked measures
 * as nodes and their relationships as colour-coded directed edges. Named
 * GraphViewCanvas rather than GraphCanvas to avoid a name collision with
 * ReaGraph's own exported GraphCanvas component.
 *
 * Node size is scaled proportionally to each measure's totalScore. Edges are
 * curved when a reverse edge exists between the same pair of nodes, to prevent
 * bidirectional edges from overlapping. Edge labels are omitted — edge type is
 * communicated entirely through colour, matching the legend in GraphView.
 */

import { useMemo, useRef } from 'react';
import { GraphCanvas, GraphNode, GraphEdge, useSelection } from 'reagraph';
import { GraphEdge as AppGraphEdge } from '../../types/graphTypes';

// --- Types ---

interface GraphViewCanvasProps {
  /** Ranked measure result objects; each contains a nested measure and a totalScore. */
  measures: any[];
  /** Directed edges between measures, typed by relationship (synergy, conflict, etc.). */
  edges: AppGraphEdge[];
  /** ID of the currently highlighted measure; null when no selection is active. */
  selectedMeasureId: string | null;
  /** Callback fired when the user clicks a node or clears selection via the canvas. */
  onSelectMeasure: (id: string | null) => void;
  /** Canvas height in pixels. Defaults to 600. */
  height?: number;
}

// --- Component ---

/**
 * GraphViewCanvas
 *
 * Sections:
 *  - nodes derivation — measures mapped to ReaGraph GraphNode objects
 *  - graphEdges derivation — AppGraphEdges mapped to ReaGraph GraphEdge objects,
 *    with curvature applied to bidirectional pairs
 *  - useSelection hook — manages ReaGraph's internal selection state
 *  - handleNodeClick / handleCanvasClick — bridge ReaGraph events to onSelectMeasure
 *  - GraphCanvas render with full application theme
 */
const GraphViewCanvas = ({
  measures,
  edges,
  selectedMeasureId,
  onSelectMeasure,
  height = 600,
}: GraphViewCanvasProps) => {
  const graphRef = useRef(null);

  // --- Node derivation ---

  /**
   * Converts ranked measure results to ReaGraph GraphNode objects.
   * Node size is clamped to [5, 20] and derived from totalScore / 10,
   * so higher-ranked measures appear visually larger in the graph.
   */
  const nodes: GraphNode[] = useMemo(() => {
    return measures.map((item) => ({
      id:    item?.measure.id    || '',
      label: item?.measure.title || '',
      size:  Math.max(5, Math.min(20, (item?.totalScore || 0) / 10)),
    }));
  }, [measures]);

  // --- Edge derivation ---

  /**
   * Converts AppGraphEdges to ReaGraph GraphEdge objects.
   * Curvature of 0.4 is applied when a reverse edge exists between the same
   * node pair, preventing bidirectional edges from rendering on top of each other.
   * Labels are intentionally omitted — edge type is conveyed through colour alone.
   */
  const graphEdges: GraphEdge[] = useMemo(() => {
    /**
     * Returns true when an edge exists in the opposite direction between
     * the given pair of nodes, indicating a bidirectional relationship.
     */
    const reverseExists = (from: string, to: string) =>
      edges.some(edge => edge.from === to && edge.to === from);

    return edges.map((edge, index) => ({
      id:         `${edge.from}-${edge.to}-${index}`,
      source:     edge.from,
      target:     edge.to,
      curvature:  reverseExists(edge.to, edge.from) ? 0.4 : 0,
      ...getEdgeStyle(edge.type),
    }));
  }, [edges]);

  // --- Selection ---

  /**
   * ReaGraph selection hook — manages highlighted nodes and edges internally.
   * pathSelectionType 'direct' highlights only the immediately connected edges
   * of a selected node rather than full paths through the graph.
   */
  const {
    selections,
    onNodeClick,
    onCanvasClick,
  } = useSelection({
    ref: graphRef,
    nodes,
    edges: graphEdges,
    pathSelectionType: 'direct',
  });

  // --- Handlers ---

  /**
   * Bridges ReaGraph's onNodeClick event to the parent's onSelectMeasure callback.
   * Calls the ReaGraph handler first to keep internal selection state consistent,
   * then propagates the selected node ID upward.
   */
  const handleNodeClick = (node: GraphNode) => {
    if (onNodeClick) onNodeClick(node);
    onSelectMeasure(node.id);
  };

  /**
   * Bridges ReaGraph's onCanvasClick event to the parent's onSelectMeasure callback.
   * Clicking the empty canvas clears the selection by passing null.
   */
  const handleCanvasClick = (event: MouseEvent) => {
    if (onCanvasClick) onCanvasClick(event);
    onSelectMeasure(null);
  };

  return (
    <div
      className="relative w-full h-[600px] bg-gray-50 rounded-lg border-2 border-gray-200 overflow-hidden"
      style={{ height: `${height}px` }}
    >
      <GraphCanvas
        ref={graphRef}
        nodes={nodes}
        edges={graphEdges}
        selections={selections}
        onNodeClick={handleNodeClick}
        onCanvasClick={handleCanvasClick}
        layoutType="forceDirected2d"
        theme={{
          canvas: {
            background: '#fafafa',
            fog: '#fafafa',
          },
          node: {
            fill: '#67AE6E',           /** Default node fill — mid-green. */
            activeFill: '#328E6E',     /** Selected node fill — dark green. */
            opacity: 1,
            selectedOpacity: 1,
            inactiveOpacity: 0.3,      /** Dimmed when another node is selected. */
            label: {
              color: '#303030',
              activeColor: '#000000',
            },
          },
          edge: {
            fill: '#7E7E7E',           /** Default edge colour — neutral grey. */
            activeFill: '#303030',     /** Selected edge colour — near black. */
            opacity: 0.6,
            selectedOpacity: 1,
            inactiveOpacity: 0.1,      /** Strongly dimmed when not part of selection. */
            label: {
              color: '#7E7E7E',
              activeColor: '#7E7E7E',
            },
          },
          arrow: {
            fill: '#7E7E7E',
            activeFill: '#303030',
          },
          lasso: {
            border: '#67AE6E',
            background: 'rgba(103, 174, 110, 0.1)',
          },
          ring: {
            fill: '#328E6E',
            activeFill: '#67AE6E',
          },
          cluster: {
            stroke: '#67AE6E',
            opacity: 0.2,
            selectedOpacity: 0.4,
            inactiveOpacity: 0.05,
            label: {
              stroke: '#303030',
              color: '#303030',
            },
          },
        }}
        draggable
        animated
        edgeArrowPosition="end"
        labelType="auto"
        cameraMode="rotate"
      />
    </div>
  );
};

// --- Utilities ---

/**
 * Returns a ReaGraph-compatible fill/activeFill colour pair for a given edge type.
 * Colours match the legend displayed in GraphView. Falls back to neutral grey
 * for any unrecognised type — the neutral case should not occur in practice.
 *
 * @param type The relationship type string from the backend graph data.
 * @returns An object with fill and activeFill colour strings.
 */
const getEdgeStyle = (type: string): { fill: string; activeFill: string } => {
  const styles = {
    synergy:      { fill: '#22c55e', activeFill: '#16a34a' },
    conflict:     { fill: '#ef4444', activeFill: '#dc2626' },
    dependency:   { fill: '#3b82f6', activeFill: '#2563eb' },
    prerequisite: { fill: '#a855f7', activeFill: '#9333ea' },
    /** Fallback for unrecognised edge types — should not occur in practice. */
    neutral:      { fill: '#9ca3af', activeFill: '#6b7280' },
  };

  return styles[type as keyof typeof styles] || styles.neutral;
};

export default GraphViewCanvas;