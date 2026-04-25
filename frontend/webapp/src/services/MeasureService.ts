/**
 * MeasureService.ts
 *
 * HTTP client service for measure-related API interactions and client-side
 * measure filtering. Responsible for fetching the full measure catalogue from
 * the backend and providing a search utility used by the MeasuresSlice to
 * filter measures by query string.
 *
 * Exported both as a named singleton (measureService) and as the default
 * export for compatibility with existing import styles across the codebase.
 */

import { API_BASE_URL } from '../config';
import { Measure } from '../types/measureTypes';

// --- Service ---

class MeasureService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  // --- API ---

  /**
   * Fetches the full list of measures from the backend.
   * Errors from the HTTP layer are caught, logged, and re-thrown as a
   * normalised Error so callers receive a consistent error type regardless
   * of whether the failure was a network error or a non-OK HTTP status.
   *
   * @returns An array of all available Measure objects.
   * @throws Error when the fetch fails or the response status is not OK.
   */
  async fetchMeasures(): Promise<Measure[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/measures`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching measures:', error);
      throw new Error('Unknown error occurred when attempting to fetch measures.');
    }
  }

  // --- Client-side filtering ---

  /**
   * Filters a measure list to those whose title, short description, or full
   * description contains the given query string (case-insensitive). Returns
   * the full list unchanged when the query is empty or whitespace-only.
   *
   * Search is intentionally client-side so the MeasuresSlice can re-filter
   * reactively on every keystroke without additional API calls.
   *
   * @param measures The full list of measures to search within.
   * @param query    The raw search string entered by the user.
   * @returns The subset of measures that match the query.
   */
  searchMeasures(measures: Measure[], query: string): Measure[] {
    if (!query.trim()) {
      return measures;
    }

    const lowercaseQuery = query.toLowerCase().trim();

    return measures.filter((measure) =>
      measure.title.toLowerCase().includes(lowercaseQuery) ||
      measure.shortDescription.toLowerCase().includes(lowercaseQuery) ||
      measure.description.toLowerCase().includes(lowercaseQuery)
    );
  }
}

// --- Singleton export ---

/**
 * Shared singleton instance used across the application.
 * Exported both as a named export and as the default for import flexibility.
 */
export const measureService = new MeasureService();
export default measureService;