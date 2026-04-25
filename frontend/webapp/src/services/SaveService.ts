/**
 * SaveService.ts
 *
 * Handles serialisation and deserialisation of the current input session.
 * Provides three responsibilities:
 *  - downloadCurrent: exports the Redux store's community slice as a
 *    timestamped JSON file download.
 *  - parseImport: reads and validates an uploaded JSON file, returning a
 *    typed InputExport object.
 *  - hasData: checks whether the store contains enough data to be worth
 *    exporting, used to gate the ExportButton's enabled state.
 *
 * Exported both as a named singleton (saveService) and as the default
 * export for compatibility with existing import styles across the codebase.
 */

import { InputExport } from '../types/inputTypes';
import { store } from '../store/store';

// --- Service ---

class SaveService {

  // --- Export ---

  /**
   * Reads the current Redux community state, serialises it to a formatted
   * JSON string, and triggers a browser file download. The filename encodes
   * the commune name and the current date for easy identification.
   *
   * The download is triggered via a programmatically created and clicked
   * anchor element appended to the document body, then immediately removed.
   * The object URL is revoked after the click to release the Blob from memory.
   */
  downloadCurrent(): void {
    const state = store.getState();
    const { community } = state;

    /** Structured export object mirroring the InputExport type contract. */
    const exportData: InputExport = {
      timestamp:                new Date().toISOString(),
      communeKey:               community.communeKey,
      communeName:              community.communeName,
      postalCode:               community.postalCode,
      selectedReferenceCommune: community.selectedReferenceCommune,
      inputs:                   community.inputs,
      individual:               community.individual,
      sources:                  community.sources,
      subsidies:                community.subsidies,
    };

    // Serialise to formatted JSON and wrap in a Blob for download.
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    /** Filename encodes the commune name and ISO date for easy identification. */
    const communeName = community.communeName || 'unbekannt';
    const date = new Date().toISOString().split('T')[0];
    const filename = `KommMa-Eingabe-${communeName}-${date}.json`;

    // Create a temporary anchor, trigger the download, then remove it.
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    // Remove the anchor and revoke the object URL to release memory.
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // --- Import ---

  /**
   * Reads a user-uploaded JSON file and parses it into a validated InputExport
   * object. Uses the FileReader API internally, wrapped in a Promise so callers
   * can use async/await.
   *
   * Three required fields are validated strictly (inputs, individual, sources);
   * commune identity fields and subsidies are optional and default to null / []
   * when absent so older exports without these fields remain importable.
   *
   * @param file The JSON file selected by the user.
   * @returns A fully typed InputExport object ready for Redux dispatch.
   * @throws Error when the file cannot be read, is not valid JSON, or is
   *         missing any of the three required fields.
   */
  async parseImport(file: File): Promise<InputExport> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const jsonString = event.target?.result as string;
          const data = JSON.parse(jsonString);

          // Validate top-level structure.
          if (!data || typeof data !== 'object') {
            throw new Error('Ungültiges Dateiformat: Keine gültige JSON-Struktur');
          }

          // Validate the three required maps — all must be present and non-null objects.
          if (!data.inputs || typeof data.inputs !== 'object') {
            throw new Error('Ungültiges Dateiformat: Feld "inputs" fehlt oder ist ungültig');
          }

          if (!data.individual || typeof data.individual !== 'object') {
            throw new Error('Ungültiges Dateiformat: Feld "individual" fehlt oder ist ungültig');
          }

          if (!data.sources || typeof data.sources !== 'object') {
            throw new Error('Ungültiges Dateiformat: Feld "sources" fehlt oder ist ungültig');
          }

          /**
           * Commune identity fields and subsidies are optional — defaulted to
           * null / [] so older exports produced before these fields existed
           * remain importable without a validation error.
           */
          const exportData: InputExport = {
            timestamp:                data.timestamp                || new Date().toISOString(),
            communeKey:               data.communeKey               || null,
            communeName:              data.communeName               || null,
            postalCode:               data.postalCode                || null,
            selectedReferenceCommune: data.selectedReferenceCommune  || null,
            inputs:                   data.inputs,
            individual:               data.individual,
            sources:                  data.sources,
            subsidies:                data.subsidies                 || [],
          };

          resolve(exportData);
        } catch (error) {
          if (error instanceof Error) {
            reject(error);
          } else {
            reject(new Error('Fehler beim Parsen der Datei: Unbekannter Fehler'));
          }
        }
      };

      reader.onerror = () => {
        reject(new Error('Fehler beim Lesen der hochgeladenen Datei'));
      };

      reader.readAsText(file);
    });
  }

  // --- State check ---

  /**
   * Returns true when the Redux community slice contains enough data to be
   * worth exporting. Checks for any of: a commune key, at least one input
   * value, or at least one subsidy entry. Used by ExportButton to determine
   * whether the download action should be enabled.
   */
  hasData(): boolean {
    const state = store.getState();
    const { community } = state;

    return !!(
      community.communeKey ||
      Object.keys(community.inputs).length > 0 ||
      community.subsidies.length > 0
    );
  }
}

// --- Singleton export ---

/**
 * Shared singleton instance used across the application.
 * Exported both as a named export and as the default for import flexibility.
 */
export const saveService = new SaveService();
export default saveService;