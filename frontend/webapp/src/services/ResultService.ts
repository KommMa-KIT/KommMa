/**
 * ResultService.ts
 *
 * Singleton HTTP client for the results calculation endpoint.
 */

import { API_BASE_URL } from '../config';
import { CalculateResultResponse } from '../types/resultTypes';

class ResultService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  /**
   * Sends user input parameters to the backend and returns the ranked measure results
   * together with individualisation levels.
   *
   * @param parameters  Object containing inputs, individual flags, and subsidies.
   * @returns           Parsed CalculateResultResponse from the backend.
   * @throws            Error if the HTTP request fails or returns a non-OK status.
   */
  async calculateResult(parameters: Record<string, any>): Promise<CalculateResultResponse> {
    const response = await fetch(`${this.baseUrl}/api/results/calculate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(parameters),
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

/** Singleton instance shared across the application. */
export const resultService = new ResultService();
export default resultService;
