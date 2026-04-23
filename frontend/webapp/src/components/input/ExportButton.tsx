/**
 * ExportButton.tsx
 *
 * A fixed-position button that triggers a local file download of the current
 * input data via SaveService. Disabled when no data is available to export.
 * Displays a tooltip reflecting the current availability state.
 */

import { Download } from 'lucide-react';
import Button from '../Button';
import saveService from '../../services/SaveService';

// --- Component ---

/**
 * ExportButton
 *
 * Renders a sticky download button in the top-right corner of the viewport.
 * Errors during export are caught and surfaced via a browser alert rather than
 * silently failing, since a failed export may result in data loss for the user.
 */
const ExportButton = () => {
  /** True when SaveService holds data that can be serialised and downloaded. */
  const hasData = saveService.hasData();

  // --- Handlers ---

  /**
   * Delegates the file download to SaveService.
   * Wraps the call in a try/catch because download failures (e.g. serialisation
   * errors, browser restrictions) would otherwise be silent from the user's perspective.
   */
  const handleExport = () => {
    try {
      saveService.downloadCurrent();
    } catch (error) {
      console.error('Export failed:', error);
      alert('An error occured, when attempting to export inputs.');
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={!hasData}
      variant="default"
      size="md"
      className="fixed top-24 right-6 z-40 shadow-lg"
      title={hasData ? 'Eingaben exportieren' : 'Keine Daten zum Exportieren'}
    >
      <Download className="h-4 w-4" />
      {/* Label hidden on small screens to keep the button compact */}
      <span className="hidden sm:inline">Eingabe lokal speichern</span>
    </Button>
  );
};

export default ExportButton;