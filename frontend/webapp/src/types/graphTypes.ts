/**
 * graphTypes.ts
 *
 * Type definitions for the measure dependency graph.
 */

/**
 * The four directed relationship semantics plus a neutral placeholder.
 *
 * | Value        | Meaning                                     |
 * |--------------|---------------------------------------------|
 * | prerequisite | Source must be completed before target      |
 * | dependency   | Source requires target as a prerequisite    |
 * | synergy      | Implementing source benefits target         |
 * | conflict     | Implementing source negatively affects target |
 * | neutral      | Informational link with no scoring effect   |
 */
export type RelationType = 'synergy' | 'conflict' | 'dependency' | 'prerequisite' | 'neutral';

/** A directed edge between two measures with a typed relationship. */
export interface GraphEdge {
  from: string;
  to:   string;
  type: RelationType;
}

/** A graph node representing a single measure, optionally with a composite score. */
export interface GraphNode {
  id:     string;
  label:  string;
  score?: number;
}

/** Complete graph payload with nodes and edges. */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
