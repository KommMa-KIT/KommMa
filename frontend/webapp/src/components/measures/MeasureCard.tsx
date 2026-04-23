/**
 * MeasureCard.tsx
 *
 * Displays a compact preview card for a single measure on the measures overview
 * page. Clicking the card opens a full detail popup (MeasurePopup). Optionally
 * renders result-specific badges (rank, scores) when used on the ResultPage.
 */

import { Info } from 'lucide-react';
import { Measure } from '../../types/measureTypes';
import { useState } from 'react';
import { getPopularityStyle, getPopularityLabel } from './PopularityStyling';
import MeasurePopup from './MeasurePopup';

// --- Types ---

interface MeasureCardProps {
  measure: Measure;
  /**
   * Optional result data injected when the card is rendered on the ResultPage.
   * When present, a rank badge is shown and score values become available.
   */
  result?: {
    timeScore?: number;
    costScore?: number;
    co2Savings?: number;
    /** 1-based ranking position displayed as a badge over the card image. */
    rank?: number;
  };
}

// --- Component ---

/**
 * MeasureCard
 *
 * Renders a clickable card with:
 *  - A cover image (falls back to an icon placeholder on load error)
 *  - A popularity badge (top-right corner of the image)
 *  - An optional rank badge (top-left corner, ResultPage only)
 *  - Title and short description in the card body
 *  - A MeasurePopup that opens on click
 */
const MeasureCard = ({ measure, result }: MeasureCardProps) => {
  /** Whether the cover image failed to load; triggers the fallback icon. */
  const [imageError, setImageError] = useState(false);

  /** Controls the visibility of the full-detail MeasurePopup. */
  const [popupOpen, setPopupOpen] = useState(false);

  return (
    <>
      {/* Card - Clickable */}
      <div
        onClick={() => setPopupOpen(true)}
        className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col h-full cursor-pointer transform hover:scale-[1.02]"
      >
        {/* Image */}
        <div className="relative w-full h-48 bg-gray-200 overflow-hidden">
          {!imageError ? (
            <img
              src={measure.imageURL}
              alt={measure.title}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            /* Fallback shown when the image URL is missing or broken */
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <Info className="h-12 w-12" />
            </div>
          )}

          {/* Popularity Badge — colour and label are derived from measure.popularity */}
          <div className="absolute top-3 right-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPopularityStyle(
                measure.popularity
              )}`}
              title={measure.popularityComment}
            >
              {getPopularityLabel(measure.popularity)}
            </span>
          </div>

          {/* Rank Badge — only rendered when result data with a rank is provided */}
          {result?.rank && (
            <div className="absolute top-3 left-3">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/90 text-gray-900 shadow-lg">
                #{result.rank}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col flex-grow">
          {/* Title */}
          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            {measure.title}
          </h3>

          {/* Short description — clamped to three lines to keep card heights uniform */}
          <p className="text-gray-600 text-sm mb-4 line-clamp-3">
            {measure.shortDescription}
          </p>
        </div>
      </div>

      {/* Full-detail popup — mounted outside the card div to avoid nested click propagation issues */}
      <MeasurePopup
        measure={measure}
        open={popupOpen}
        onOpenChange={setPopupOpen}
      />
    </>
  );
};

export default MeasureCard;