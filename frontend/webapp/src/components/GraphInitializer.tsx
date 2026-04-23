/**
 * GraphInitializer.tsx
 *
 * Renderless component that fetches the dependency-graph edges from the backend
 * on mount and builds the in-memory DependencyGraphService graph.
 *
 * Should be mounted once near the root of the results section (e.g. in ResultPage).
 * Failures are caught and logged; the rest of the application continues to work
 * without dependency-graph functionality if the endpoint is unavailable.
 */

import { useEffect } from 'react';
import { graphService } from '../services/GraphService';
import { dependencyGraphService } from '../services/DependencyGraphService';

/**
 * GraphInitializer
 *
 * Fetches graph edges via GraphService and passes them to DependencyGraphService.buildGraph.
 * Renders nothing (returns null).
 */
const GraphInitializer = () => {
  useEffect(() => {
    const loadGraph = async () => {
      try {
        const edges = await graphService.fetchGraph();
        dependencyGraphService.buildGraph(edges);
      } catch (error) {
        console.error('Failed to load dependency graph:', error);
      }
    };

    loadGraph();
  }, []);

  return null;
};

export default GraphInitializer;
