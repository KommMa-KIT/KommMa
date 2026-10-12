/**
 * IndividualisationProgressBar.tsx
 *
 * Displays the overall individualisation score as a colour-coded progress bar.
 * An info button (shown when detailed `levels` are provided) opens
 * IndividualisationDetailPopup for a per-category breakdown.
 */

import { useState } from 'react';
import { Info } from 'lucide-react';
import IndividualisationDetailPopup from './IndividualisationDetailPopup';

interface IndividualisationProgressBarProps {
  /** Overall individualisation score as a fraction in [0, 1]. */
  score: number;
  /** Optional per-category breakdown; required to show the info button. */
  levels?: {
    general:  number;
    energy:   number;
    mobility: number;
    water:    number;
    total:    number;
  };
}

/**
 * IndividualisationProgressBar
 *
 * Sections:
 *  - **Header row** – label, optional info button, and percentage value.
 *  - **Progress bar** – filled proportionally; green ≥ 70 %, amber ≥ 40 %, red otherwise.
 *  - **Caption** – brief explanation of what the score represents.
 *
 * Clicking the info button (when `levels` is provided) opens IndividualisationDetailPopup.
 */
const IndividualisationProgressBar = ({ score, levels }: IndividualisationProgressBarProps) => {
  const [popupOpen, setPopupOpen] = useState(false);

  const percentage = Math.round(score * 100);

  /** Tailwind background colour class for the progress fill. */
  const getColor = () => {
    if (score >= 0.7) return 'bg-green-500';
    if (score >= 0.4) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  /** Tailwind text colour class for the percentage label. */
  const getTextColor = () => {
    if (score >= 0.7) return 'text-green-700';
    if (score >= 0.4) return 'text-yellow-700';
    return 'text-red-700';
  };

  return (
    <>
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-blue-900">Individualisierungsgrad</h3>
            {levels && (
              <button
                onClick={() => setPopupOpen(true)}
                className="p-1 hover:bg-blue-100 rounded-full transition-colors group"
                title="Details anzeigen"
              >
                <Info className="h-4 w-4 text-blue-600 group-hover:text-blue-700" />
              </button>
            )}
          </div>
          <span className={`text-2xl font-bold ${getTextColor()}`}>{percentage}%</span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full ${getColor()} transition-all duration-500 ease-out rounded-full`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Caption */}
        <p className="text-xs text-gray-600 mt-2">
          Basierend auf der Anzahl Ihrer individuellen Angaben in der Dateneingabe.
        </p>
      </div>

      {levels && (
        <IndividualisationDetailPopup
          open={popupOpen}
          onOpenChange={setPopupOpen}
          levels={levels}
        />
      )}
    </>
  );
};

export default IndividualisationProgressBar;
