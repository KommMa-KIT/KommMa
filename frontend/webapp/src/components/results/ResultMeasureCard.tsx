/**
 * ResultMeasureCard.tsx
 *
 * Full-size card representing a single ranked measure in the results list.
 * Displays the measure image, metadata, absolute metric values, icon-scale scores,
 * and action buttons for marking a measure as implemented or infeasible.
 * Supports visual synergy (green border) and conflict (red border) highlighting
 * based on interactions with other implemented measures.
 */

import { Info, Clock, Euro, Leaf, FilterX, Check, X } from 'lucide-react';
import { Measure } from '../../types/measureTypes';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getPopularityStyle, getPopularityLabel } from '../measures/PopularityStyling';
import MeasurePopup from '../measures/MeasurePopup';
import ConfirmationDialog from './ConfirmationDialog';
import {
  markAsImplemented, markAsInfeasible, unmarkMeasure, selectMeasureStatus, selectMeasureResults,
} from '../../store/ResultSlice';
import { dependencyGraphService } from '../../services/DependencyGraphService';

interface ResultMeasureCardProps {
  measure: Measure;
  result: {
    timeScore:              number;
    costScore:              number;
    climateScore:           number;
    timeScale:              number;
    costScale:              number;
    climateScale:           number;
    time:                   number;
    investmentCost:         number;
    ongoingCost:            number;
    totalCost:              number;
    onetimeEmissionSavings: number;
    ongoingEmissionSavings: number;
    rank:                   number;
  };
  /** True when the measure is hidden by an active filter rule. */
  isFiltered?:            boolean;
  /** True when the measure is hidden because it or a dependency is infeasible/implemented. */
  isHidden?:              boolean;
  /** True when the measure is transitively infeasible (a prerequisite is marked infeasible). */
  isTransitiveInfeasible?: boolean;
  /** True when an implemented measure creates a synergy benefit → green border. */
  hasSynergy?:            boolean;
  /** True when an implemented measure negatively impacts this measure → red border. */
  hasConflict?:           boolean;
}

// --- Helpers ---

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
  <div className="flex gap-1">
    {[...Array(5)].map((_, i) => (
      <IconComponent key={i} className={`h-5 w-5 ${i < scale ? activeColor : 'text-gray-300'}`} />
    ))}
  </div>
);

/**
 * Renders the cost scale with a leading indicator for negative ongoing costs (i.e. savings).
 * Layout: [savings icon] | [investment scale icons ×4]
 *
 * @param costScale    Number of filled investment-cost icons (0–4).
 * @param ongoingCost  Ongoing cost value; a negative value lights up the savings indicator.
 */
const renderCostScale = (costScale: number, ongoingCost: number) => {
  const isOngoingNegative = ongoingCost < 0;
  return (
    <div className="flex items-center gap-1">
      <Euro className={`h-5 w-5 ${isOngoingNegative ? 'text-amber-600' : 'text-gray-300'}`} />
      <span className="text-gray-400 text-lg mx-0.5">|</span>
      {[...Array(4)].map((_, i) => (
        <Euro key={i} className={`h-5 w-5 ${i < costScale ? 'text-amber-600' : 'text-gray-300'}`} />
      ))}
    </div>
  );
};

// --- Component ---

/**
 * ResultMeasureCard
 *
 * Layout (left → right):
 *  - **Image panel** – measure photo with rank badge.
 *  - **Content panel** – title, popularity badge, short description, metric row,
 *    and implement / infeasible action buttons.
 *  - **Score panel** – icon-scale indicators for time, cost, and climate.
 *
 * Clicking the card body opens the full MeasurePopup.
 * Marking a measure as infeasible triggers a ConfirmationDialog when dependent
 * measures exist, warning the user that they will also be hidden.
 *
 * Visual states:
 *  - Filtered / hidden / implemented / infeasible → reduced opacity + grayscale.
 *  - Synergy only → green ring.
 *  - Conflict only → red ring.
 *  - Both synergy and conflict → striped green/red border.
 */
const ResultMeasureCard = ({
  measure,
  result,
  isFiltered            = false,
  isHidden              = false,
  isTransitiveInfeasible = false,
  hasSynergy            = false,
  hasConflict           = false,
}: ResultMeasureCardProps) => {
  const dispatch       = useDispatch();
  const measureStatus  = useSelector(selectMeasureStatus);
  const measureResults = useSelector(selectMeasureResults);

  const resultMeasureIds = new Set(measureResults?.map((r) => r.measureId) ?? []);
  const [imageError,       setImageError]       = useState(false);
  const [popupOpen,        setPopupOpen]        = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmDialogData, setConfirmDialogData] = useState<{
    title:     string;
    message:   string;
    onConfirm: () => void;
  } | null>(null);

  const isImplemented = measureStatus.implemented.includes(measure.id);
  const isInfeasible  = measureStatus.infeasible.includes(measure.id);

  // --- Border style ---

  /**
   * Determines the card's border/ring style based on synergy and conflict flags.
   * Returns either a Tailwind className or an inline CSS style object for the
   * striped dual-colour case.
   */
  const getBorderStyle = (): { className: string; style?: React.CSSProperties } => {
    if (isHidden || isFiltered) return { className: '' };

    if (hasSynergy && hasConflict) return {
      className: 'ring-2',
      style: {
        outline: '2px solid transparent',
        boxShadow: '0 0 0 2px transparent',
        borderRadius: '0.5rem',
        border: '3px solid transparent',
        background: 'linear-gradient(white, white), repeating-linear-gradient(45deg, #22c55e 0px, #22c55e 33px, #ef4444 33px, #ef4444 66px)',
        backgroundOrigin: 'border-box',
        backgroundClip: 'padding-box, border-box',
      },
    };

    if (hasSynergy)  return { className: 'ring-2 ring-green-500' };
    if (hasConflict) return { className: 'ring-2 ring-red-500' };
    return { className: '' };
  };

  const borderStyle = getBorderStyle();

  // --- Action handlers ---

  /**
   * Toggles the "implemented" status for this measure.
   * Dispatches `markAsImplemented` or `unmarkMeasure` accordingly.
   */
  const handleImplemented = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isImplemented) {
      dispatch(unmarkMeasure(measure.id));
    } else {
      dispatch(markAsImplemented(measure.id));
    }
  };

  /**
   * Toggles the "infeasible" status for this measure.
   * If the measure has dependent measures that are also part of the current results,
   * a confirmation dialog is shown before dispatching `markAsInfeasible`.
   * Dependents that exist only in the measure catalogue (no result entry) are still
   * marked infeasible silently, but are excluded from the warning count.
   */
  const handleInfeasible = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isInfeasible) {
      dispatch(unmarkMeasure(measure.id));
      return;
    }

    if (dependencyGraphService.isInitialized()) {
      const allDependents = dependencyGraphService.getDependentMeasures(measure.id);
      // Only warn about dependents that have an actual result entry shown to the user
      const resultDependents = new Set([...allDependents].filter((id) => resultMeasureIds.has(id)));
      if (resultDependents.size > 0) {
        setConfirmDialogData({
          title:   'Abhängige Maßnahmen betroffen',
          message: `Diese Maßnahme beeinflusst ${resultDependents.size} weitere Maßnahme(n).\n\nAlle betroffenen Maßnahmen werden ausgeblendet.\n\nMöchten Sie fortfahren?`,
          onConfirm: () => dispatch(markAsInfeasible(measure.id)),
        });
        setConfirmDialogOpen(true);
        return;
      }
    }

    dispatch(markAsInfeasible(measure.id));
  };

  return (
    <>
      {/* Card */}
      <div
        onClick={() => setPopupOpen(true)}
        className={`bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer transform hover:scale-[1.01] flex h-48 relative
          ${isFiltered || isHidden || isImplemented || isInfeasible
            ? 'opacity-40 grayscale hover:opacity-60 hover:grayscale-0'
            : ''}
          ${borderStyle.className}
        `}
        style={borderStyle.style}
      >
        {/* Status badges (top-right) */}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
          {isImplemented && (
            <div className="flex items-center gap-1 px-3 py-1 bg-green-600/90 text-white text-xs font-semibold rounded-full backdrop-blur-sm">
              <Check className="h-3 w-3" /> Umgesetzt
            </div>
          )}
          {(isInfeasible || isTransitiveInfeasible) && (
            <div className="flex items-center gap-1 px-3 py-1 bg-red-600/90 text-white text-xs font-semibold rounded-full backdrop-blur-sm">
              <X className="h-3 w-3" /> Nicht umsetzbar
            </div>
          )}
          {isFiltered && (
            <div className="flex items-center gap-1 px-3 py-1 bg-gray-800/80 text-white text-xs font-semibold rounded-full backdrop-blur-sm">
              <FilterX className="h-3 w-3" /> Gefiltert
            </div>
          )}
        </div>

        {/* Image panel */}
        <div className="relative w-64 flex-shrink-0 bg-gray-200">
          {!imageError ? (
            <img
              src={measure.imageURL}
              alt={measure.title}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <Info className="h-12 w-12" />
            </div>
          )}
          {/* Rank badge */}
          <div className="absolute top-3 left-3">
            <span className="px-4 py-2 rounded-full text-lg font-bold bg-white/95 text-gray-900 shadow-lg">
              #{result.rank}
            </span>
          </div>
        </div>

        {/* Content panel */}
        <div className="flex-1 p-4 flex flex-col justify-between">
          <div>
            {/* Title + popularity badge */}
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-xl font-semibold text-gray-900 flex-1 line-clamp-1 text-left">
                {measure.title}
              </h3>
              <span
                className={`ml-4 px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${getPopularityStyle(measure.popularity)}`}
                title={measure.popularityComment}
              >
                {getPopularityLabel(measure.popularity)}
              </span>
            </div>

            {/* Short description */}
            <p className="text-gray-600 text-sm line-clamp-2 text-left">
              {measure.shortDescription}
            </p>
          </div>

          {/* Metric row + action buttons */}
          <div className="flex gap-4 pt-3 border-t border-gray-200 items-center">

            {/* Implementation time */}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <div className="flex flex-col">
                <span className="text-xs text-gray-500">Umsetzungszeit</span>
                <span className="font-semibold text-gray-900 text-sm">{result.time} Monate</span>
              </div>
            </div>

            {/* Investment cost */}
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 text-amber-600" />
              <div className="flex flex-col">
                <span className="text-xs text-gray-500">Investitionskosten</span>
                <span className="font-semibold text-gray-900 text-sm">
                  {result.investmentCost.toLocaleString('de-DE')} €
                </span>
              </div>
            </div>

            {/* Ongoing cost (green when negative = savings) */}
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 text-amber-600" />
              <div className="flex flex-col">
                <span className="text-xs text-gray-500">Laufende Kosten</span>
                <span className={`font-semibold text-sm ${result.ongoingCost < 0 ? 'text-green-600' : 'text-gray-900'}`}>
                  {result.ongoingCost.toLocaleString('de-DE')} €/Jahr
                </span>
              </div>
            </div>

            {/* Total cost balance (green when negative = net savings) */}
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 text-amber-600" />
              <div className="flex flex-col">
                <span className="text-xs text-gray-500">Kostenbilanz</span>
                <span className={`font-semibold text-sm ${result.totalCost < 0 ? 'text-green-600' : 'text-gray-900'}`}>
                  {result.totalCost.toLocaleString('de-DE')} €
                </span>
              </div>
            </div>

            {/* One-time emission savings */}
            <div className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-green-600" />
              <div className="flex flex-col">
                <span className="text-xs text-gray-500">CO₂-Einsparung (einm.)</span>
                <span className="font-semibold text-green-600 text-sm">
                  {result.onetimeEmissionSavings.toLocaleString('de-DE')} kg
                </span>
              </div>
            </div>

            {/* Annual emission savings */}
            <div className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-green-600" />
              <div className="flex flex-col">
                <span className="text-xs text-gray-500">CO₂-Einsparung (jährl.)</span>
                <span className="font-semibold text-green-600 text-sm">
                  {result.ongoingEmissionSavings.toLocaleString('de-DE')} kg/Jahr
                </span>
              </div>
            </div>

            <div className="flex-1" />

            {/* Action buttons */}
            <div className="flex gap-2 ml-auto">
              {/* Mark as implemented */}
              <button
                onClick={handleImplemented}
                className={`group relative p-2 rounded-lg transition-colors ${
                  isImplemented
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                <Check className="h-5 w-5" />
                <span className="absolute bottom-full right-0 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {isImplemented ? 'Markierung entfernen' : 'Bereits umgesetzt'}
                </span>
              </button>

              {/* Mark as infeasible */}
              <button
                onClick={handleInfeasible}
                className={`group relative p-2 rounded-lg transition-colors ${
                  isInfeasible
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                <X className="h-5 w-5" />
                <span className="absolute bottom-full right-0 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {isInfeasible ? 'Markierung entfernen' : 'Nicht umsetzbar'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Score panel */}
        <div className="flex flex-col items-center justify-center gap-5 px-5 py-5 border-l border-gray-200 bg-gray-50 min-w-[140px]">
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs text-gray-500 mb-0.5">Zeit</p>
            {renderScaleIcons(result.timeScale, Clock, 'text-blue-600')}
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs text-gray-500 mb-0.5">Kosten</p>
            {renderCostScale(result.costScale, result.ongoingCost)}
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs text-gray-500 mb-0.5">Klima</p>
            {renderScaleIcons(result.climateScale, Leaf, 'text-green-600')}
          </div>
        </div>
      </div>

      {/* Detail popup */}
      <MeasurePopup measure={measure} open={popupOpen} onOpenChange={setPopupOpen} />

      {/* Infeasibility confirmation dialog */}
      {confirmDialogData && (
        <ConfirmationDialog
          open={confirmDialogOpen}
          onOpenChange={setConfirmDialogOpen}
          title={confirmDialogData.title}
          message={confirmDialogData.message}
          onConfirm={confirmDialogData.onConfirm}
        />
      )}
    </>
  );
};

export default ResultMeasureCard;