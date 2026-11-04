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

import { useMemo } from 'react';
import { GraphCanvas, GraphNode, GraphEdge } from 'reagraph';
import { GraphEdge as AppGraphEdge, RELATION_TYPE_CONFIG, RelationType } from '../../../types/graphTypes';

// --- Types ---

/** The subset of a ranked measure result that the canvas reads. */
interface RankedMeasureNode {
  measure: { id: string; title: string };
  totalScore?: number;
}

interface GraphViewCanvasProps {
  /** Ranked measure result objects; each contains a nested measure and a totalScore. */
  measures: RankedMeasureNode[];
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

// --- Constants ---

/**
 * Canvas background colour. Shared by the theme and by fadeToBackground, so
 * faded edges blend into exactly the colour they are drawn on.
 */
const CANVAS_BACKGROUND = '#fafafa';

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
  // --- Node derivation ---

  /**
   * Converts ranked measure results to ReaGraph GraphNode objects.
   * Node size is clamped to [5, 20] and derived from totalScore / 10,
   * so higher-ranked measures appear visually larger in the graph.
   */
  const nodes: GraphNode[] = useMemo(() => {
    return measures.map((item) => ({
      id:    item.measure.id,
      label: item.measure.title,
      size:  Math.max(5, Math.min(20, (item.totalScore || 0) / 10)),
    }));
  }, [measures]);

  // --- Edge derivation ---

  /**
   * Converts AppGraphEdges to ReaGraph GraphEdge objects.
   *
   * Interpolation: when both A→B and B→A exist, drawing both as straight lines
   * makes them overlap completely. Requesting curved interpolation on both is
   * enough, since ReaGraph detects the parallel pair internally and offsets them
   * to opposite sides on its own. Edges without a reverse counterpart stay
   * 'linear', since a lone edge has nothing to be offset from.
   *
   * Curving is applied sparingly, only where it actually adds information: if
   * the reverse edge has the same relationship type, both edges already render
   * in the same colour, so an overlapping straight pair looks no different from
   * a curved one and curving would just add visual noise. A pair is therefore
   * curved only when the two directions differ in type, since that is the case
   * where separating them lets both colours be seen.
   *
   * Colour: the base fill comes from the edge's relationship type. Edges that
   * are not adjacent to the current selection are faded toward the canvas
   * background instead of relying on opacity (see the selection section for
   * why edges can't use ReaGraph's `actives`-based opacity dimming).
   */
  const graphEdges: GraphEdge[] = useMemo(() => {
    /** Type of the first edge per direction, for constant-time reverse lookups. */
    const typeByDirection = new Map<string, string>();
    for (const edge of edges) {
      const key = directionKey(edge.from, edge.to);
      if (!typeByDirection.has(key)) typeByDirection.set(key, edge.type);
    }

    const isAdjacent = (from: string, to: string) =>
      !selectedMeasureId || from === selectedMeasureId || to === selectedMeasureId;

    return edges.map((edge, index) => {
      const fill = getEdgeColor(edge.type);
      const reverseType = typeByDirection.get(directionKey(edge.to, edge.from));
      const hasConflictingReverse = reverseType !== undefined && reverseType !== edge.type;

      return {
        id:            `${edge.from}-${edge.to}-${index}`,
        source:        edge.from,
        target:        edge.to,
        interpolation: hasConflictingReverse ? 'curved' : 'linear',
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
      className="relative w-full bg-gray-50 rounded-lg border-2 border-gray-200 overflow-hidden"
      style={{ height: `${height}px` }}
    >
      <GraphCanvas
        nodes={nodes}
        edges={graphEdges}
        selections={selections}
        actives={actives}
        onNodeClick={handleNodeClick}
        onCanvasClick={handleCanvasClick}
        layoutType="forceDirected2d"
        theme={{
          canvas: {
            background: CANVAS_BACKGROUND,
            fog: CANVAS_BACKGROUND,
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
 * Builds the lookup key identifying a directed edge by its endpoints.
 *
 * @param from ID of the source measure.
 * @param to   ID of the target measure.
 * @returns A string unique to the direction from → to.
 */
const directionKey = (from: string, to: string): string => `${from}→${to}`;

/**
 * Returns the canvas colour configured for an edge type in RELATION_TYPE_CONFIG.
 * Falls back to the neutral colour for a type the config does not know, which can
 * only happen if the backend sends a type the frontend has not registered yet.
 *
 * @param type The relationship type of the edge.
 * @returns A six-digit hex colour string.
 */
const getEdgeColor = (type: RelationType): string =>
  (RELATION_TYPE_CONFIG[type] ?? RELATION_TYPE_CONFIG.neutral).edgeColor;

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
  background = CANVAS_BACKGROUND,
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