/**
 * ConfirmationDialog.tsx
 *
 * Generic confirmation modal used to ask the user to approve a potentially
 * destructive or side-effect-heavy action before it is executed.
 * Displays a warning icon, a configurable title and message, and Cancel / Confirm buttons.
 */

import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationDialogProps {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  /** Callback invoked when the user confirms the action. */
  onConfirm:     () => void;
  title:         string;
  /** Supports `\n` line breaks via `whitespace-pre-line`. */
  message:       string;
  confirmText?:  string;
  cancelText?:   string;
}

/**
 * ConfirmationDialog
 *
 * Renders a small modal with:
 *  - **Header** – warning icon + title + close button.
 *  - **Body** – message text (pre-formatted line breaks supported).
 *  - **Footer** – Cancel button and a styled Confirm button.
 *
 * Confirming calls `onConfirm` and then closes the dialog.
 * Cancelling or clicking the backdrop closes without calling `onConfirm`.
 */
const ConfirmationDialog = ({
  open,
  onOpenChange,
  onConfirm,
  title,
  message,
  confirmText = 'Fortfahren',
  cancelText  = 'Abbrechen',
}: ConfirmationDialogProps) => {
  if (!open) return null;

  const handleConfirm = () => {
    onConfirm();
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
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">{message}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;
