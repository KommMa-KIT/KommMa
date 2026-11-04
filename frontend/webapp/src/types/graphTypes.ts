/**
 * graphTypes.ts
 *
 * Type definitions and per-type presentation settings for the measure
 * dependency graph. RELATION_TYPE_CONFIG is the single place that defines how
 * each relationship type is displayed (canvas colour, legend entry), so adding
 * or changing a type only requires edits in this file.
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

// --- Presentation config ---

/** Display settings of a single relationship type. */
export interface RelationTypeConfig {
  /** Label shown next to the colour swatch in the graph legend. */
  label: string;
  /** Edge colour on the graph canvas, as six-digit hex with a leading '#'. */
  edgeColor: string;
  /** Colour of the legend swatch, as six-digit hex with a leading '#'. */
  legendColor: string;
  /** Whether the type gets an entry in the graph legend. */
  showInLegend: boolean;
}

/**
 * Display settings for every relationship type. Typed as a Record, so the
 * compiler rejects a new RelationType until it has an entry here. The key
 * order defines the order of the legend entries.
 */
export const RELATION_TYPE_CONFIG: Record<RelationType, RelationTypeConfig> = {
  synergy:      { label: 'Synergie',      edgeColor: '#22c55e', legendColor: '#22c55e', showInLegend: true  },
  conflict:     { label: 'Konflikt',      edgeColor: '#ef4444', legendColor: '#ef4444', showInLegend: true  },
  contribution: { label: 'Beitrag',       edgeColor: '#ca8a04', legendColor: '#eab308', showInLegend: true  },
  dependency:   { label: 'Abhängigkeit',  edgeColor: '#3b82f6', legendColor: '#3b82f6', showInLegend: false },
  prerequisite: { label: 'Voraussetzung', edgeColor: '#a855f7', legendColor: '#a855f7', showInLegend: false },
  neutral:      { label: 'Neutral',       edgeColor: '#9ca3af', legendColor: '#9ca3af', showInLegend: false },
};

/** Relationship types that appear in the graph legend, in display order. */
export const LEGEND_RELATION_TYPES: RelationType[] = (
  Object.keys(RELATION_TYPE_CONFIG) as RelationType[]
).filter((type) => RELATION_TYPE_CONFIG[type].showInLegend);