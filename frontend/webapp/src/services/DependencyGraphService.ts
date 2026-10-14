/**
 * DependencyGraphService.ts
 *
 * Singleton service that builds and queries a directed dependency graph from the GraphEdge data from GraphService. 
 * Supports all edge types except neutral.
 *
 * Edge direction per type (edge.from → edge.to):
 *  - prerequisite: from is a prerequisite of to (to requires from).
 *  - dependency:   from depends on to (from requires to).
 *  - contribution: from implemented → to benefits.
 *  - synergy:      from implemented → to benefits.
 *  - conflict:     from implemented → to is negatively affected.
 *
 * The service is populated by the fetchGraphEdges thunk in GraphSlice, which
 * calls buildGraph before the loaded edges are published to the store.
 */

import { GraphEdge } from '../types/graphTypes';

// --- Types ---

/** Maps a measure ID to the IDs of the measures related to it by one edge type. */
type AdjacencyMap = Map<string, string[]>;

// --- Helpers ---

/**
 * Adds a value to the list stored under a key, creating the list if needed.
 * Duplicates are ignored, so repeated edges do not inflate the result.
 *
 * @param map   Adjacency map to extend.
 * @param key   ID of the source measure.
 * @param value ID of the related measure.
 */
const addUnique = (map: AdjacencyMap, key: string, value: string): void => {
  const values = map.get(key) || [];
  if (!values.includes(value)) values.push(value);
  map.set(key, values);
};

class DependencyGraphService {
  /** Maps measure A → all measures that require A as a prerequisite (non-transitive). */
  private prerequisiteMap: AdjacencyMap = new Map();

  /** Maps measure A → all measures that A itself requires (non-transitive). */
  private dependencyMap: AdjacencyMap = new Map();

  /** Maps measure A → measures that A contributes to; they benefit when A is implemented. */
  private contributionMap: AdjacencyMap = new Map();

  /** Maps measure A → measures that have a synergy with A; they benefit when A is implemented. */
  private synergyMap: AdjacencyMap = new Map();

  /** Maps measure A → measures that are negatively affected when A is implemented. */
  private conflictMap: AdjacencyMap = new Map();

  private initialized: boolean = false;

  // --- Graph construction ---

  /**
   * Builds all internal maps from a flat list of graph edges.
   * Clears any previously stored data before processing.
   * Edges of unsupported types (e.g. neutral) are ignored.
   *
   * @param edges Array of directed edges from the backend graph endpoint.
   */
  buildGraph(edges: GraphEdge[]): void {
    this.clearMaps();

    edges.forEach((edge) => {
      const map = this.getMapForType(edge.type);
      if (map) addUnique(map, edge.from, edge.to);
    });

    this.initialized = true;
  }

  /**
   * Returns the adjacency map that stores edges of the given type.
   *
   * @param type Relationship type of an edge.
   * @returns The matching map, or undefined for unsupported types.
   */
  private getMapForType(type: GraphEdge['type']): AdjacencyMap | undefined {
    switch (type) {
      case 'prerequisite': return this.prerequisiteMap;
      case 'dependency':   return this.dependencyMap;
      case 'contribution': return this.contributionMap;
      case 'synergy':      return this.synergyMap;
      case 'conflict':     return this.conflictMap;
      default:             return undefined;
    }
  }

  /** Empties all adjacency maps without touching the initialised flag. */
  private clearMaps(): void {
    this.prerequisiteMap.clear();
    this.dependencyMap.clear();
    this.contributionMap.clear();
    this.synergyMap.clear();
    this.conflictMap.clear();
  }

  // --- Infeasibility propagation ---

  /**
   * Returns all measures that (transitively) depend on 'measureId' via BFS.
   * Used to determine which measures should be hidden when 'measureId' is marked infeasible.
   *
   * @param measureId The infeasible measure whose dependents should be found.
   * @returns Set of measure IDs that are blocked by the given measure.
   */
  getDependentMeasures(measureId: string): Set<string> {
    const result  = new Set<string>();
    const queue   = [measureId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const dependents = this.prerequisiteMap.get(current) || [];
      dependents.forEach((dep) => {
        if (!result.has(dep)) {
          result.add(dep);
          queue.push(dep);
        }
      });
    }

    return result;
  }

  // --- Prerequisite lookup ---

  /**
   * Returns the direct (non-transitive) prerequisites of a measure.
   * Used in MeasurePopup to display "these measures are required first".
   *
   * @param id Measure ID to look up.
   * @returns Set of IDs for measures that must be completed before 'id'.
   */
  getPrerequisiteMeasures(id: string): Set<string> {
    return new Set<string>(this.dependencyMap.get(id) || []);
  }

  // --- Benefit / conflict resolution ---

  /**
   * Returns all measures that benefit from at least one of the implemented measures
   * (via synergy OR contribution), i.e. candidates for a green border, excluding
   * already-implemented measures.
   *
   * @param implementedIds IDs of all currently implemented measures.
   */
  getBenefitingMeasures(implementedIds: string[]): Set<string> {
    const result = new Set<string>();
    implementedIds.forEach((id) => {
      const synergies = this.synergyMap.get(id) || [];
      const contributionTo = this.contributionMap.get(id) || [];
      synergies.forEach((s) => {
        if (!implementedIds.includes(s)) result.add(s);
      });
      contributionTo.forEach((s) => {
        if (!implementedIds.includes(s)) result.add(s);
      });
    });
    return result;
  }

  /**
   * Returns all measures that are negatively affected by at least one of the
   * implemented measures (i.e. candidates for a red border), excluding already-implemented ones.
   *
   * @param implementedIds IDs of all currently implemented measures.
   */
  getConflictMeasures(implementedIds: string[]): Set<string> {
    const result = new Set<string>();
    implementedIds.forEach((id) => {
      const conflicts = this.conflictMap.get(id) || [];
      conflicts.forEach((c) => {
        if (!implementedIds.includes(c)) result.add(c);
      });
    });
    return result;
  }

  // --- Utility ---

  /** Returns true if `buildGraph` has been called at least once. */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Returns the number of measures that directly depend on the given measure
   * (i.e. the out-degree in the prerequisite map).
   */
  getDirectDependentsCount(measureId: string): number {
    return (this.prerequisiteMap.get(measureId) || []).length;
  }

  /** Clears all graph data and resets the initialised flag. */
  reset(): void {
    this.clearMaps();
    this.initialized = false;
  }
}

/** Singleton instance shared across the application. */
export const dependencyGraphService = new DependencyGraphService();
export default dependencyGraphService;