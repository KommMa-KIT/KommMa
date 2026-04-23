/**
 * ImportButton.tsx
 *
 * A render-prop component that provides a file import trigger to its children.
 * Handles the full JSON import pipeline: file parsing, structure validation,
 * optional backend validation of pre-filled fields, Redux store hydration, and
 * post-import navigation. Exposes a triggerImport callback via the children
 * render prop so any element can act as the import trigger without this
 * component dictating its own visual appearance.
 *
 * Parsing logic is delegated to SaveService; backend validation is delegated
 * to CommunityService. See those services for implementation details.
 */

import React, { useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { RefreshCw } from 'lucide-react';
import saveService from '../services/SaveService';
import communityService from '../services/CommunityService';
import { importData } from '../store/CommunitySlice';
import { setCurrentCategory } from '../store/UISlice';
import { useNavigate } from 'react-router';
import { InputExport } from '../types/inputTypes';

// --- Types ---

type ImportButtonProps = {
  /**
   * Render prop pattern — children receives the triggerImport callback and is
   * responsible for rendering whatever element should initiate the file picker.
   * This keeps ImportButton visually agnostic and reusable across the UI.
   */
  children: (triggerImport: () => void) => React.ReactNode;
};

// --- Component ---

/**
 * ImportButton
 *
 * Sections:
 *  - Hidden file input wired to a ref so triggerImport can open the picker
 *    programmatically without rendering a visible input element.
 *  - Notification permission request on mount.
 *  - triggerImport — programmatically clicks the hidden file input.
 *  - handleFileChange — seven-step import pipeline (parse → validate structure
 *    → filter sourced fields → backend validate → apply updates → import →
 *    navigate).
 *  - showSuccessNotification / showErrorNotification — browser Notification API
 *    with alert fallback.
 *  - Validation loading overlay rendered via a fixed backdrop.
 */
const ImportButton = ({ children }: ImportButtonProps) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  /** Ref to the hidden <input type="file"> triggered programmatically. */
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** True while the backend validation request is in flight; shows the loading overlay. */
  const [isValidating, setIsValidating] = useState(false);

  // --- Handlers ---

  /** Programmatically opens the browser file picker via the hidden input ref. */
  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  /**
   * Executes the full import pipeline when the user selects a file.
   *
   * Steps:
   *  1. Parse the selected JSON file via SaveService.
   *  2. Validate that the required top-level fields are present.
   *  3. Filter the parsed inputs to only those that originated from a backend
   *     source (i.e. were pre-filled), as only these need re-validation.
   *  4. If sourced fields exist and a commune key is available, send a
   *     validation request to the backend to check for updated values.
   *  5. Apply any field updates returned by the backend into the parsed data
   *     object before importing, so stale pre-filled values are refreshed.
   *  6. Dispatch the fully merged data into the Redux store.
   *  7. Navigate to the input page at the General category and show a
   *     success notification. Backend validation failures are non-fatal —
   *     the import proceeds with the original file data if validation fails.
   */
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Step 1: Parse the JSON file via SaveService.
      const data: InputExport = await saveService.parseImport(file);

      // Step 2: Validate top-level structure — all three maps must be present.
      if (!data.inputs || !data.sources || !data.individual) {
        throw new Error('Ungültiges Dateiformat: Fehlende Pflichtfelder');
      }

      // Step 3: Isolate only the fields that carry a non-empty source string,
      // as only backend-sourced values need to be re-validated for freshness.
      const inputsWithSource = Object.entries(data.inputs)
        .filter(([fieldId]) => {
          const source = data.sources[fieldId];
          return source && source.trim() !== '';
        })
        .map(([id, value]) => ({
          id,
          value,
          source: data.sources[id],
        }));

      // Step 4: Validate sourced fields against the backend when possible.
      let updatedCount = 0;
      if (inputsWithSource.length > 0 && data.communeKey) {
        setIsValidating(true);

        try {
          const validationResponse = await communityService.validateImport({
            community_key: data.communeKey,
            inputs: inputsWithSource,
          });

          // Step 5: Merge backend updates back into the parsed data object.
          // Each updated field overwrites the imported value, individualisation
          // flag, and source attribution before the Redux dispatch.
          Object.entries(validationResponse).forEach(([fieldId, updateData]) => {
            data.inputs[fieldId]     = updateData.value;
            data.individual[fieldId] = updateData.individual;
            data.sources[fieldId]    = updateData.source;
            updatedCount++;
          });
        } catch (validationError) {
          // Backend validation failure is non-fatal — import proceeds with the
          // original file data so the user is not blocked by a transient error.
          console.warn('Backend validation failed, continuing with import:', validationError);
        } finally {
          setIsValidating(false);
        }
      }

      // Step 6: Hydrate the Redux store with the (potentially updated) data.
      dispatch(importData(data));

      // Step 7: Navigate to the input page and surface a success notification.
      dispatch(setCurrentCategory('General'));
      navigate('/input');
      showSuccessNotification(data.communeName || 'Unbekannte Kommune', updatedCount);

    } catch (error) {
      console.error('Import failed:', error);
      showErrorNotification(error instanceof Error ? error.message : 'Unbekannter Fehler');
    } finally {
      /** Reset the file input so the same file can be re-imported if needed. */
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setIsValidating(false);
    }
  };

  // --- Notifications ---

  /**
   * Displays a success notification after a completed import.
   * Attempts the browser Notification API first, then falls back to alert.
   * The message differs based on whether any fields were updated by the backend.
   *
   * NOTE: The alert currently fires unconditionally even when a browser
   * Notification succeeds, meaning the user always sees both. This is likely
   * unintentional and should be reviewed.
   *
   * @param communeName  Display name of the imported commune.
   * @param updatedCount Number of fields refreshed by backend validation.
   */
  const showSuccessNotification = (communeName: string, updatedCount: number) => {
    if (updatedCount > 0) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Import erfolgreich', {
          body: `${communeName}: ${updatedCount} Feld(er) wurden aktualisiert`,
          icon: '/favicon.ico',
        });
      }
      alert(`Import erfolgreich!\n\nKommune: ${communeName}\n${updatedCount} Feld(er) wurden mit aktuellen Daten aktualisiert.`);
    } else {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Import erfolgreich', {
          body: `${communeName}: Alle Daten sind aktuell`,
          icon: '/favicon.ico',
        });
      }
      alert(`Import erfolgreich!\n\nKommune: ${communeName}\nAlle Daten sind aktuell.`);
    }
  };

  /**
   * Displays an error notification when the import pipeline fails.
   * Attempts the browser Notification API first, then falls back to alert.
   *
   * @param errorMessage Human-readable description of the failure.
   */
  const showErrorNotification = (errorMessage: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Import fehlgeschlagen', {
        body: errorMessage,
        icon: '/favicon.ico',
      });
    }
    alert(`Fehler beim Import:\n\n${errorMessage}\n\nBitte überprüfen Sie die Datei und versuchen Sie es erneut.`);
  };

  // --- Effects ---

  /**
   * Requests browser Notification permission on mount if not yet determined.
   * The permission prompt is shown once and the result persists in the browser.
   */
  React.useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <>
      {children(triggerImport)}

      {/* Hidden file input — accepts JSON only; disabled during validation to
          prevent a second import from being triggered mid-flight */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
        disabled={isValidating}
      />

      {/* Validation loading overlay — blocks interaction while the backend
          validation request is in flight */}
      {isValidating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl flex flex-col items-center gap-4">
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            <p className="text-gray-900 font-medium">Validiere Daten...</p>
            <p className="text-sm text-gray-500">Bitte warten Sie einen Moment</p>
          </div>
        </div>
      )}
    </>
  );
};

export default ImportButton;