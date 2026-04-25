/**
 * CommunityService.ts
 *
 * HTTP client service for all commune-related API interactions. Handles commune
 * lookup (by key, postal code, and name search), prefill and average data
 * fetching, reference commune retrieval, input field parameter loading, subsidy
 * category fetching, and import validation.
 *
 * Category names returned by the backend are in German; this service maps them
 * to the English CategoryKey values used throughout the frontend before
 * returning data to callers.
 *
 * Exported both as a named singleton (communityService) and as the default
 * export for compatibility with existing import styles across the codebase.
 */

import { API_BASE_URL } from '../config';
import {
  CommuneInfo,
  PrefillData,
  ReferenceCommune,
  SubsidyCategory,
  CategorizedFields,
  ImportValidationResponse,
  ImportValidationRequest,
  ReferenceCommunePreview,
  CategoryKey,
  InputFieldDefinition,
} from '../types/inputTypes';

// --- Service ---

class CommunityService {
  private baseUrl: string;

  /**
   * Maps German backend category names to the English CategoryKey values used
   * in the frontend store and components. This translation is necessary because
   * the backend identifies categories solely by their German display name with
   * no separate language-neutral key.
   */
  private backendToFrontendCategoryMap: Record<string, CategoryKey> = {
    'Allgemein': 'General',
    'Energie':   'Energy',
    'Mobilität': 'Mobility',
    'Wasser':    'Water',
  };

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  // --- Commune lookup ---

  /**
   * Fetches commune information by AGS (Amtlicher Gemeindeschlüssel).
   * @param key The 8-digit official commune key.
   */
  async getCommuneInfoByKey(key: string): Promise<CommuneInfo> {
    const response = await fetch(`${this.baseUrl}/api/communes/info_by_key/${key}`);
    if (!response.ok) throw new Error('Gemeinde nicht gefunden');
    return response.json();
  }

  /**
   * Fetches commune information by postal code (PLZ).
   * @param code The 5-digit German postal code.
   */
  async getCommuneInfoByCode(code: string): Promise<CommuneInfo> {
    const response = await fetch(`${this.baseUrl}/api/communes/info_by_code/${code}`);
    if (!response.ok) throw new Error('Gemeinde nicht gefunden');
    return response.json();
  }

  /**
   * Searches for communes by name substring.
   * @param query The search string entered by the user.
   * @returns A list of matching CommuneInfo objects.
   */
  async searchCommunes(query: string): Promise<CommuneInfo[]> {
    const response = await fetch(`${this.baseUrl}/api/communes/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Suche fehlgeschlagen');
    return response.json();
  }

  // --- Prefill data ---

  /**
   * Maps a raw backend array of prefill items into the keyed PrefillData
   * structure expected by the Redux store. Items without an id field are
   * silently skipped. Non-array input returns an empty object.
   *
   * @param arrayData Raw array from the backend prefill or average endpoints.
   * @returns A PrefillData map keyed by field ID.
   */
  private mapArrayToPrefillData(arrayData: any[]): PrefillData {
    const prefillData: PrefillData = {};

    if (!Array.isArray(arrayData)) return prefillData;

    arrayData.forEach((item: any) => {
      if (item?.id) {
        prefillData[item.id] = {
          value:      item.value,
          source:     item.source,
          date:       item.date,
          individual: item.individual,
        };
      }
    });

    return prefillData;
  }

  /**
   * Fetches prefill data for a specific commune by its AGS key.
   * Response is mapped from the backend array format via mapArrayToPrefillData.
   * @param key The 8-digit AGS commune key.
   */
  async getPrefillData(key: string): Promise<PrefillData> {
    const response = await fetch(`${this.baseUrl}/api/communes/${key}/prefill`);
    if (!response.ok) throw new Error('Prefill failed!');

    const arrayData = await response.json();
    return this.mapArrayToPrefillData(arrayData);
  }

  /**
   * Fetches national average values used as fallback prefill data when no
   * commune-specific data is available. Response is mapped from the backend
   * array format via mapArrayToPrefillData.
   */
  async getAverageData(): Promise<PrefillData> {
    const response = await fetch(`${this.baseUrl}/api/communes/average`);
    if (!response.ok) throw new Error('Average values are not available!');

    const arrayData = await response.json();
    return this.mapArrayToPrefillData(arrayData);
  }

  // --- Reference communes ---

  /**
   * Fetches the list of all available prototype reference communes,
   * returning only the preview fields needed for the start page cards.
   */
  async getReferenceCommunesList(): Promise<ReferenceCommunePreview[]> {
    const response = await fetch(`${this.baseUrl}/api/reference-communes/list`);
    if (!response.ok) throw new Error('Reference communes are not available!');
    return response.json();
  }

  /**
   * Fetches the full prefill data for a specific reference commune by its ID.
   * @param id The reference commune identifier.
   */
  async getReferenceCommune(id: string): Promise<ReferenceCommune> {
    const response = await fetch(`${this.baseUrl}/api/reference-communes/${id}`);
    if (!response.ok) throw new Error(`Reference commune ${id} is not available!`);
    return response.json();
  }

  // --- Input parameters ---

  /**
   * Fetches all input field definitions from the backend, grouped by category.
   * Backend category keys are German strings; this method translates them to
   * the English CategoryKey values via backendToFrontendCategoryMap before
   * returning. Unrecognised backend keys are logged and silently dropped.
   */
  async getInputParameters(): Promise<CategorizedFields> {
    const response = await fetch(`${this.baseUrl}/api/inputs/parameters`);
    if (!response.ok) throw new Error('Input parameters are not available!');

    const backendData: Record<string, InputFieldDefinition[]> = await response.json();
    const mappedData: CategorizedFields = {} as CategorizedFields;

    Object.entries(backendData).forEach(([backendKey, value]) => {
      const frontendKey = this.backendToFrontendCategoryMap[backendKey];

      if (frontendKey) {
        mappedData[frontendKey] = value;
      } else {
        console.warn(`Unknown category received from backend: ${backendKey}`);
      }
    });

    return mappedData;
  }

  // --- Subsidies ---

  /**
   * Fetches all available subsidy categories for display on the EndView input step.
   */
  async getSubsidyCategories(): Promise<SubsidyCategory[]> {
    const response = await fetch(`${this.baseUrl}/api/inputs/subsidies`);
    if (!response.ok) throw new Error('Subsidy categories not available');
    return response.json();
  }

  // --- Import validation ---

  /**
   * Sends sourced import fields to the backend for freshness validation.
   * The backend compares each field's stored value against the current dataset
   * and returns updated values for any fields that have changed since the
   * export was created.
   *
   * @param data The import validation request containing the commune key and
   *             the subset of imported fields that have a backend source.
   * @returns A map of field IDs to their refreshed values and metadata.
   */
  async validateImport(data: ImportValidationRequest): Promise<ImportValidationResponse> {
    const response = await fetch(`${this.baseUrl}/api/inputs/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Import-Validation failed');
    return response.json();
  }
}

// --- Singleton export ---

/**
 * Shared singleton instance used across the application.
 * Exported both as a named export and as the default for import flexibility.
 */
export const communityService = new CommunityService();
export default communityService;