/**
 * graphTypes.ts
 * @author FladYannic
 *
 * Type definitions for the measure dependency graph.
 */

/**
 * All (directed) relationship semantics plus a neutral placeholder.
 *
 * | Relationship | Meaning                                       |
 * |--------------|-----------------------------------------------|
 * | neutral      | Default relationship without effect           |
 * | contribution | Implementing source benefits target           | (always in combination with neutral)
 * | synergy      | Implementing source benefits target           | (always bidirectional)
 * | conflict     | Implementing source negatively affects target | (always bidirectional)
 * | prerequisite | Source must be completed before target        | (always in combination with dependency)
 * | dependency   | Source requires target as a prerequisite      | (always in combination with prerequisite)
 */
export type RelationType = 'neutral' | 'contribution' | 'synergy' | 'conflict' | 'dependency' | 'prerequisite';

/** A directed edge between two measures with a typed relationship. */
export interface GraphEdge {
  from: string;
  to:   string;
  type: RelationType;
}