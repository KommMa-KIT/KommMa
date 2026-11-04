/**
 * GraphService.ts
 *
 * Singleton HTTP client that retrieves the measure dependency graph from the backend.
 */

import { GraphEdge } from '../types/graphTypes';
import { API_BASE_URL } from '../config';

class GraphService {
  /**
   * Fetches all graph edges from the backend graph endpoint.
   *
   * @returns Array of directed GraphEdge objects.
   * @throws  Error if the HTTP request fails or returns a non-OK status.
   */
  async fetchGraph(): Promise<GraphEdge[]> {
    const response = await fetch(`${API_BASE_URL}/api/results/graph`, {
      method:  'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

/** Singleton instance shared across the application. */
export const graphService = new GraphService();
export default graphService;