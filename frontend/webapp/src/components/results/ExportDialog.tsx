/**
 * ExportDialog.tsx
 *
 * Modal that lets the user choose between PDF and CSV export formats.
 * Delegates the actual export logic to the parent via callback props.
 */

import { X, FileText, Table } from 'lucide-react';

interface ExportDialogProps {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  /** Called when the user selects PDF export. */
  onExportPDF:   () => void;
  /** Called when the user selects CSV export. */
  onExportCSV:   () => void;
}

/**
 * ExportDialog
 *
 * Renders two large button options:
 *  - **PDF** – formatted document with tables and relationships.
 *  - **CSV** – semicolon-delimited table for use in spreadsheet applications.
 *
 * Selecting either option triggers the corresponding callback and closes the dialog.
 */
const ExportDialog = ({ open, onOpenChange, onExportPDF, onExportCSV }: ExportDialogProps) => {
  if (!open) return null;

  const handlePDFClick = () => {
    onExportPDF();
    onOpenChange(false);
  };
  const handleCSVClick = () => {
    onExportCSV();
    onOpenChange(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog panel */}
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-md m-4">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Ergebnisse exportieren</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Export options */}
        <div className="p-6 space-y-3">
          <p className="text-sm text-gray-600 mb-4">
            Wählen Sie das gewünschte Export-Format für Ihre Maßnahmen-Empfehlungen:
          </p>

          {/* PDF */}
          <button
            onClick={handlePDFClick}
            className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition-all group"
          >
            <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center group-hover:bg-red-200 transition-colors">
              <FileText className="h-6 w-6 text-red-600" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-gray-900 group-hover:text-red-700">PDF-Dokument</h3>
              <p className="text-sm text-gray-600">Übersichtlich formatierte Maßnahmen mit allen Details</p>
            </div>
          </button>

          {/* CSV */}
          <button
            onClick={handleCSVClick}
            className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all group"
          >
            <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
              <Table className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-gray-900 group-hover:text-green-700">CSV-Tabelle</h3>
              <p className="text-sm text-gray-600">Daten in tabellarischer Form für Excel/Sheets</p>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 border-t bg-gray-50">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;
