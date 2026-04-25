/**
 * ResultMeasureCompactCard.tsx
 *
 * Condensed card for displaying a ranked measure in list or sidebar views
 * where horizontal space is limited. Shows rank, title, short description,
 * and icon-scale scores for time, cost, and climate impact.
 * Clicking the card opens the full MeasurePopup.
 */

import { Clock, Euro, Leaf } from 'lucide-react';
import { useState, forwardRef } from 'react';
import { Measure } from '../../types/measureTypes';
import MeasurePopup from '../measures/MeasurePopup';

interface ResultMeasureCompactCardProps {
  measure:    Measure;
  result: {
    timeScale:    number;
    costScale:    number;
    climateScale: number;
    /** Used for cost-scale logic: a negative value indicates ongoing savings. */
    ongoingCost:  number;
    rank:         number;
  };
  /** Highlights the card when true (e.g. selected in an adjacent map view). */
  isSelected: boolean;
  onClick?:   () => void;
}

// --- Scale renderers ---

/**
 * Renders a row of up to 5 icon instances, filling `scale` of them with the active colour.
 *
 * @param scale         Number of filled icons (0–5).
 * @param IconComponent Lucide icon component to render.
 * @param activeColor   Tailwind colour class for filled icons.
 */
const renderScaleIcons = (
  scale: number,
  IconComponent: React.ComponentType<{ className?: string }>,
  activeColor: string,
) => (
  <div className="flex gap-0.5">
    {[...Array(5)].map((_, i) => (
      <IconComponent key={i} className={`h-3.5 w-3.5 ${i < scale ? activeColor : 'text-gray-300'}`} />
    ))}
  </div>
);

/**
 * Renders the cost scale with a leading savings indicator.
 * Layout: [savings icon] | [investment scale icons ×4]
 *
 * @param costScale    Number of filled investment-cost icons (0–4).
 * @param ongoingCost  A negative value lights up the savings (leftmost) indicator.
 */
const renderCostScale = (costScale: number, ongoingCost: number) => {
  const isOngoingNegative = ongoingCost < 0;
  return (
    <div className="flex items-center gap-0.5">
      <Euro className={`h-3.5 w-3.5 ${isOngoingNegative ? 'text-amber-600' : 'text-gray-300'}`} />
      <span className="text-gray-400 text-sm mx-0.5">|</span>
      {[...Array(4)].map((_, i) => (
        <Euro key={i} className={`h-3.5 w-3.5 ${i < costScale ? 'text-amber-600' : 'text-gray-300'}`} />
      ))}
    </div>
  );
};

// --- Component ---

/**
 * ResultMeasureCompactCard
 *
 * Layout:
 *  - **Header row** – circular rank badge + title + short description.
 *  - **Score grid** – three mini panels (Zeit / Kosten / Klima) with icon scales.
 *
 * Selection state (controlled externally via `isSelected`) styles the left border
 * and rank badge in blue. Clicking the card opens MeasurePopup; the `onClick` prop
 * is intentionally not called on card click to keep selection logic in the parent.
 * Supports ref forwarding for programmatic scrolling (e.g. scroll-to-selection).
 */
const ResultMeasureCompactCard = forwardRef<HTMLDivElement, ResultMeasureCompactCardProps>(
  ({ measure, result, isSelected, onClick }, ref) => {
    const [popupOpen, setPopupOpen] = useState(false);

    /** Opens the detail popup. Selection is managed by the parent, not this handler. */
    const handleCardClick = () => {
      setPopupOpen(true);
    };

    return (
      <>
        <div
          ref={ref}
          onClick={handleCardClick}
          className={`p-3 hover:bg-gray-50 transition-all cursor-pointer border-l-4 ${
            isSelected
              ? 'bg-blue-50 border-blue-500'
              : 'border-transparent hover:border-gray-200'
          }`}
        >
          {/* Header: rank badge + title + description */}
          <div className="flex items-start gap-2 mb-2">
            <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              isSelected ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}>
              #{result.rank}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className={`text-sm font-semibold leading-tight line-clamp-2 mb-1 ${
                isSelected ? 'text-blue-900' : 'text-gray-900'
              }`}>
                {measure.title}
              </h4>
              <p className="text-xs text-gray-600 leading-snug line-clamp-2">
                {measure.shortDescription}
              </p>
            </div>
          </div>

          {/* Score grid */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="flex flex-col items-center gap-1 p-1.5 bg-white rounded border border-gray-100">
              <span className="text-[10px] text-gray-500 font-medium">Zeit</span>
              {renderScaleIcons(result.timeScale, Clock, 'text-blue-600')}
            </div>
            <div className="flex flex-col items-center gap-1 p-1.5 bg-white rounded border border-gray-100">
              <span className="text-[10px] text-gray-500 font-medium">Kosten</span>
              {renderCostScale(result.costScale, result.ongoingCost)}
            </div>
            <div className="flex flex-col items-center gap-1 p-1.5 bg-white rounded border border-gray-100">
              <span className="text-[10px] text-gray-500 font-medium">Klima</span>
              {renderScaleIcons(result.climateScale, Leaf, 'text-green-600')}
            </div>
          </div>
        </div>

        {/* Full detail popup */}
        <MeasurePopup measure={measure} open={popupOpen} onOpenChange={setPopupOpen} />
      </>
    );
  }
);

ResultMeasureCompactCard.displayName = 'ResultMeasureCompactCard';

export default ResultMeasureCompactCard;