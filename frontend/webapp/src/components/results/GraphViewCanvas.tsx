/**
 * GraphViewCanvas.tsx
 *
 * A ReaGraph-backed interactive graph canvas rendering the top-ranked measures
 * as nodes and their relationships as colour-coded directed edges. Named
 * GraphViewCanvas rather than GraphCanvas to avoid a name collision with
 * ReaGraph's own exported GraphCanvas component.
 *
 * Node size is scaled proportionally to each measure's totalScore. Edges
 * between two nodes that are connected in both directions and differ in
 * relationship type are drawn curved, so both colours stay visible instead of
 * one direction hiding behind the other; ReaGraph offsets the pair
 * automatically once curved interpolation is requested (see the graphEdges
 * derivation for details). Same-type bidirectional pairs are left straight,
 * since curving them apart would show two identically-coloured lines instead
 * of one. Edge labels are omitted — edge type is communicated entirely
 * through colour, matching the legend in GraphView.
 *
 * Selection highlighting is fully controlled by the parent via selectedMeasureId:
 * the selected node and its direct neighbourhood stay at full opacity while every
 * unrelated node is dimmed to the theme's inactiveOpacity. Edges are never dimmed
 * via opacity (see the graphEdges / actives sections below for why); instead,
 * edges outside the selected neighbourhood are faded toward the background colour.
 */

import { useMemo, useRef } from 'react';
import { GraphCanvas, GraphCanvasRef, GraphNode, GraphEdge } from 'reagraph';
import { GraphEdge as AppGraphEdge } from '../../types/graphTypes';

// --- Types ---

interface GraphViewCanvasProps {
  /** Ranked measure result objects; each contains a nested measure and a totalScore. */
  measures: any[];
  /** Directed edges between measures, typed by relationship (synergy, conflict, etc.). */
  edges: AppGraphEdge[];
  /**
   * ID of the currently highlighted measure; null when no selection is active.
   * This is the single source of truth for highlighting — the canvas derives both
   * its selected node and its active neighbourhood from this value.
   */
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
 *    with curved interpolation applied to bidirectional pairs
 *  - selection derivation — selectedMeasureId mapped to ReaGraph's selections /
 *    actives arrays, resolving the selected node's direct neighbourhood
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
  const graphRef = useRef<GraphCanvasRef | null>(null);

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
   *
   * Interpolation: Adds a curvature to bidirectional edges. When both A→B and 
   * B→A exist, drawing both as straight lines makes them overlap completely; 
   * requesting curved interpolation on both is enough, since ReaGraph detects 
   * the parallel pair internally and offsets them to opposite sides on its own. 
   * Edges without a reverse counterpart are left as 'linear', since a lone edge
   * has nothing to be offset from.
   *
   * Curving is applied sparingly, only where it actually adds information: if
   * the reverse edge has the same relationship type, the two edges already
   * render in the same colour, so an overlapping straight pair looks no
   * different from a curved one — curving them would just add visual noise.
   * A pair is only curved when the two directions differ in type, since that's
   * the case where separating them lets both colours be seen. Edges without a
   * same-type reverse counterpart are left as 'linear'.
   *
   * Colour: the base fill comes from the edge's relationship type. Edges that
   * are not adjacent to the current selection are faded toward the canvas
   * background instead of relying on opacity (see the selection section for
   * why edges can't use ReaGraph's `actives`-based opacity dimming).
   */
  const graphEdges: GraphEdge[] = useMemo(() => {
    const findReverseEdge = (from: string, to: string) =>
      edges.find((e) => e.from === to && e.to === from);

    const isAdjacent = (from: string, to: string) =>
      !selectedMeasureId || from === selectedMeasureId || to === selectedMeasureId;

    return edges.map((edge, index) => {
      const { fill } = getEdgeStyle(edge.type);
      const reverseEdge = findReverseEdge(edge.from, edge.to);
      const isBidirectional = !!reverseEdge && reverseEdge.type !== edge.type;

      return {
        id:            `${edge.from}-${edge.to}-${index}`,
        source:        edge.from,
        target:        edge.to,
        interpolation: isBidirectional ? 'curved' : 'linear',
        fill:          isAdjacent(edge.from, edge.to) ? fill : fadeToBackground(fill, 0.3),
      };
    });
  }, [edges, selectedMeasureId]);

  // --- Selection ---

  /**
   * Derives ReaGraph's selection state from the parent-controlled selectedMeasureId.
   *
   * `selections` holds the clicked node itself. `actives` holds its direct
   * neighbourhood: every node reachable across a single edge in either direction.
   * ReaGraph renders any node absent from both arrays at the theme's
   * inactiveOpacity, which produces the greying-out of all non-adjacent nodes.
   *
   * Edges are deliberately excluded from `actives`. ReaGraph replaces the fill
   * of any active edge with theme.edge.activeFill, which would collapse the
   * five relationship colours into one. Instead, edge highlighting is handled
   * entirely in graphEdges above (full colour vs. faded toward the background),
   * and theme.edge.inactiveOpacity is kept equal to theme.edge.opacity below so
   * that colour, not opacity, is the only thing distinguishing an adjacent edge
   * from a non-adjacent one.
   *
   * Deriving rather than using the useSelection hook keeps the parent as the single
   * source of truth, so selection changes originating outside the canvas stay in
   * sync — the hook only recomputes its neighbourhood inside its own click handler.
   */
  const { selections, actives } = useMemo(() => {
    if (!selectedMeasureId) return { selections: [], actives: [] };

    const neighbourIds = new Set<string>();

    for (const edge of graphEdges) {
      if (edge.source === selectedMeasureId) neighbourIds.add(edge.target);
      else if (edge.target === selectedMeasureId) neighbourIds.add(edge.source);
    }

    /** A self-referencing edge would otherwise list the selected node as its own neighbour. */
    neighbourIds.delete(selectedMeasureId);

    return { selections: [selectedMeasureId], actives: [...neighbourIds] };
  }, [selectedMeasureId, graphEdges]);

  // --- Handlers ---

  /**
   * Bridges ReaGraph's onNodeClick event to the parent's onSelectMeasure callback.
   * Highlighting is not applied here — it follows automatically once the parent
   * echoes the new ID back down through selectedMeasureId.
   */
  const handleNodeClick = (node: GraphNode) => {
    onSelectMeasure(node.id);
  };

  /**
   * Bridges ReaGraph's onCanvasClick event to the parent's onSelectMeasure callback.
   * Clicking the empty canvas clears the selection by passing null.
   */
  const handleCanvasClick = () => {
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
        actives={actives}
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
            fill: '#7E7E7E',
            activeFill: '#303030',     /** Unused — edges are never marked active, see graphEdges/actives above. */
            opacity: 0.9,
            selectedOpacity: 1,
            inactiveOpacity: 0.9,      /** Matches opacity — dimming is expressed entirely through fill colour. */
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
 * Note: ReaGraph reads `fill` from the edge object but takes the highlighted colour
 * from theme.edge.activeFill, so the per-edge activeFill here may not be applied.
 *
 * @param type The relationship type string from the backend graph data.
 * @returns An object with fill and activeFill colour strings.
 */
const getEdgeStyle = (type: string): { fill: string; activeFill: string } => {
  const styles = {
    synergy:      { fill: '#22c55e', activeFill: '#16a34a' },
    conflict:     { fill: '#ef4444', activeFill: '#dc2626' },
    contribution: { fill: '#ca8a04', activeFill: '#a16207' },
    dependency:   { fill: '#3b82f6', activeFill: '#2563eb' },
    prerequisite: { fill: '#a855f7', activeFill: '#9333ea' },
    /** Fallback for unrecognised edge types — should not occur in practice. */
    neutral:      { fill: '#9ca3af', activeFill: '#6b7280' },
  };

  return styles[type as keyof typeof styles] || styles.neutral;
};

/**
 * Blends a hex colour toward the canvas background, preserving hue while reducing
 * intensity. ReaGraph exposes opacity only per-theme, not per-edge, so fading is
 * done in colour space instead; because the background is opaque and fixed, the
 * result is visually equivalent to alpha compositing.
 *
 * @param hex        Source colour as six-digit hex with a leading '#'.
 * @param amount     Fraction of the source colour retained. 1 leaves it unchanged,
 *                   0 collapses it to the background. Mirrors the old inactiveOpacity.
 * @param background Colour to blend toward; defaults to the canvas background.
 * @returns A six-digit hex string.
 */
const fadeToBackground = (
  hex: string,
  amount: number,
  background = '#fafafa',
): string => {
  const channels = (value: string) =>
    [1, 3, 5].map(offset => parseInt(value.slice(offset, offset + 2), 16));

  const [r, g, b]    = channels(hex);
  const [br, bg, bb] = channels(background);

  const mix = (channel: number, base: number) =>
    Math.round(base + (channel - base) * amount)
      .toString(16)
      .padStart(2, '0');

  return `#${mix(r, br)}${mix(g, bg)}${mix(b, bb)}`;
};

export default GraphViewCanvas;