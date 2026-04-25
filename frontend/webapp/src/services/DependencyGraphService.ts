/**
 * DependencyGraphService.ts
 *
 * Singleton service that builds and queries a directed dependency graph from
 * `GraphEdge` data. Supports four edge types:
 *
 * | Type          | Meaning                                           | Effect in UI                  |
 * |---------------|---------------------------------------------------|-------------------------------|
 * | prerequisite  | A must be done before B                           | Marking A infeasible hides B  |
 * | dependency    | A requires B                                      | B shown as prerequisite of A  |
 * | synergy       | A implemented → B benefits                        | B gets a green border         |
 * | conflict      | A implemented → B is negatively affected          | B gets a red border           |
 *
 * All graph lookups are O(n) at most for the BFS traversal; direct lookups are O(1).
 */

import { GraphEdge } from '../types/graphTypes';

class DependencyGraphService {
  /** Maps measure A → all measures that require A as a prerequisite (non-transitive). */
  private prerequisiteMap: Map<string, string[]> = new Map();

  /** Maps measure A → all measures that A itself requires (non-transitive). */
  private dependencyMap: Map<string, string[]> = new Map();

  /** Maps measure A → measures that benefit when A is implemented. */
  private synergyMap: Map<string, string[]> = new Map();

  /** Maps measure A → measures that are negatively affected when A is implemented. */
  private conflictMap: Map<string, string[]> = new Map();

  private initialized: boolean = false;

  // --- Graph construction ---

  /**
   * Builds all internal maps from a flat list of graph edges.
   * Clears any previously stored data before processing.
   *
   * @param edges Array of directed edges from the backend graph endpoint.
   */
  buildGraph(edges: GraphEdge[]): void {
    this.prerequisiteMap.clear();
    this.dependencyMap.clear();
    this.synergyMap.clear();
    this.conflictMap.clear();

    edges.forEach((edge) => {
      if (edge.type === 'prerequisite') {
        // "A is a prerequisite of B" → prerequisiteMap: A → [..., B]
        const dependents = this.prerequisiteMap.get(edge.from) || [];
        if (!dependents.includes(edge.to)) dependents.push(edge.to);
        this.prerequisiteMap.set(edge.from, dependents);

      } else if (edge.type === 'dependency') {
        // "A depends on B" → dependencyMap: A → [..., B]
        const requirements = this.dependencyMap.get(edge.from) || [];
        if (!requirements.includes(edge.to)) requirements.push(edge.to);
        this.dependencyMap.set(edge.from, requirements);

      } else if (edge.type === 'synergy') {
        // Directed: A implemented → B benefits
        const synergyOfFrom = this.synergyMap.get(edge.from) || [];
        if (!synergyOfFrom.includes(edge.to)) synergyOfFrom.push(edge.to);
        this.synergyMap.set(edge.from, synergyOfFrom);

      } else if (edge.type === 'conflict') {
        // Directed: A implemented → B negatively affected
        const conflictOfFrom = this.conflictMap.get(edge.from) || [];
        if (!conflictOfFrom.includes(edge.to)) conflictOfFrom.push(edge.to);
        this.conflictMap.set(edge.from, conflictOfFrom);
      }
    });

    this.initialized = true;
  }

  // --- Infeasibility propagation ---

  /**
   * Returns all measures that (transitively) depend on `measureId` via BFS.
   * Used to determine which measures should be hidden when `measureId` is marked infeasible.
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
   * @returns Set of IDs for measures that must be completed before `id`.
   */
  getPrerequisiteMeasures(id: string): Set<string> {
    return new Set<string>(this.dependencyMap.get(id) || []);
  }

  // --- Synergy / conflict resolution ---

  /**
   * Returns all measures that benefit from at least one of the implemented measures
   * (i.e. candidates for a green border), excluding already-implemented measures.
   *
   * @param implementedIds IDs of all currently implemented measures.
   */
  getSynergyMeasures(implementedIds: string[]): Set<string> {
    const result = new Set<string>();
    implementedIds.forEach((id) => {
      const synergies = this.synergyMap.get(id) || [];
      synergies.forEach((s) => {
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
    this.prerequisiteMap.clear();
    this.dependencyMap.clear();
    this.synergyMap.clear();
    this.conflictMap.clear();
    this.initialized = false;
  }
}

/** Singleton instance shared across the application. */
export const dependencyGraphService = new DependencyGraphService();
export default dependencyGraphService;