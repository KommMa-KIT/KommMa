/**
 * ResultMeasureList.tsx
 *
 * Renders the full ranked list of measures for the List view.
 * Handles three display states:
 *  1. No results at all → empty-state prompt.
 *  2. All measures hidden/filtered → warning with the hidden measures still shown below.
 *  3. Normal → visible measures followed by a collapsible section of hidden/filtered ones.
 *
 * Measure visibility and filter state are read directly from the Redux store via selectors.
 */

import { AlertCircle, Filter } from 'lucide-react';
import { useSelector } from 'react-redux';
import ResultMeasureCard from './ResultMeasureCard';
import {
  selectVisibleMeasures,
  selectFilteredOutMeasures,
  selectMeasureStatus,
  selectHiddenMeasures,
  selectSynergyMeasures,
  selectConflictMeasures,
} from '../../store/ResultSlice';

// --- Component ---

/**
 * ResultMeasureList
 *
 * Sections (when results are present):
 *  - **Result header** – total count with a note on how many are hidden.
 *  - **Visible measures** – full ResultMeasureCard for each non-hidden, non-filtered measure.
 *  - **Hidden / filtered measures** – separated by a divider; shown dimmed with status badges.
 */
const ResultMeasureList = () => {
  const visibleMeasures     = useSelector(selectVisibleMeasures);
  const filteredOutMeasures = useSelector(selectFilteredOutMeasures);
  const measureStatus       = useSelector(selectMeasureStatus);
  const hiddenMeasures      = useSelector(selectHiddenMeasures);
  const synergyMeasures     = useSelector(selectSynergyMeasures);
  const conflictMeasures    = useSelector(selectConflictMeasures);

  /**
   * Builds the full prop set for a ResultMeasureCard, resolving status flags
   * from the Redux store selectors for the given item.
   */
  const buildCardProps = (item: any, rank: number) => {
    const isImplemented          = measureStatus.implemented.includes(item.measure.id);
    const isInfeasible           = measureStatus.infeasible.includes(item.measure.id);
    const isFilteredByRules      = item.filtered;
    const isHiddenByStatus       = hiddenMeasures.has(item.measure.id);
    const isTransitiveInfeasible = isHiddenByStatus && !isImplemented && !isInfeasible;
    const hasSynergy             = synergyMeasures.has(item.measure.id);
    const hasConflict            = conflictMeasures.has(item.measure.id);

    return {
      measure: item.measure,
      isFiltered:            isFilteredByRules,
      isHidden:              isHiddenByStatus,
      isTransitiveInfeasible,
      hasSynergy,
      hasConflict,
      result: {
        timeScore:              item.timeScore,
        costScore:              item.costScore,
        climateScore:           item.climateScore,
        timeScale:              item.timeScale,
        costScale:              item.costScale,
        climateScale:           item.climateScale,
        time:                   item.time,
        investmentCost:         item.investmentCost,
        ongoingCost:            item.ongoingCost,
        totalCost:              item.totalCost,
        onetimeEmissionSavings: item.onetimeEmissionSavings,
        ongoingEmissionSavings: item.ongoingEmissionSavings,
        rank,
      },
    };
  };

  // --- Empty states ---

  if (visibleMeasures.length === 0 && filteredOutMeasures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <AlertCircle className="h-16 w-16 text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Keine Ergebnisse gefunden</h3>
        <p className="text-gray-600 text-center max-w-md">
          Bitte führe zuerst eine Bewertung durch, um personalisierte Maßnahmen-Empfehlungen zu erhalten.
        </p>
      </div>
    );
  }

  if (visibleMeasures.length === 0 && filteredOutMeasures.length > 0) {
    return (
      <div className="space-y-6">
        {/* All-hidden warning */}
        <div className="flex flex-col items-center justify-center py-12 px-4 bg-amber-50 border border-amber-200 rounded-lg">
          <Filter className="h-12 w-12 text-amber-600 mb-3" />
          <h3 className="text-lg font-semibold text-amber-900 mb-2">
            Alle Maßnahmen wurden ausgeblendet
          </h3>
          <p className="text-amber-700 text-center max-w-md text-sm">
            Alle {filteredOutMeasures.length} Maßnahmen sind entweder ausgefiltert oder als umgesetzt/nicht umsetzbar markiert.
          </p>
        </div>

        {/* Hidden measures list */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-gray-500">
            <Filter className="h-4 w-4" />
            <h3 className="text-sm font-semibold">
              Ausgeblendete Maßnahmen ({filteredOutMeasures.length})
            </h3>
          </div>
          {filteredOutMeasures.map((item: any, index: number) => (
            <ResultMeasureCard key={item.measure.id} {...buildCardProps(item, index + 1)} />
          ))}
        </div>
      </div>
    );
  }

  // --- Default: visible + optional hidden section ---

  return (
    <div className="space-y-6">
      {/* Result count header */}
      <p className="text-sm text-gray-600 mt-1">
        <span className="font-semibold text-gray-900">{visibleMeasures.length}</span>{' '}
        {visibleMeasures.length === 1 ? 'Maßnahme' : 'Maßnahmen'} basierend auf Ihren Angaben
        {filteredOutMeasures.length > 0 && (
          <span className="text-gray-500"> · {filteredOutMeasures.length} ausgeblendet</span>
        )}
      </p>

      {/* Visible measures */}
      <div className="space-y-4">
        {visibleMeasures.map((item: any, index: number) => (
          <ResultMeasureCard key={item.measure.id} {...buildCardProps(item, index + 1)} />
        ))}
      </div>

      {/* Hidden / filtered measures */}
      {filteredOutMeasures.length > 0 && (
        <div className="space-y-4 mt-12 pt-8 border-t-2 border-gray-200">
          <div className="flex items-center gap-2 text-gray-500">
            <Filter className="h-5 w-5" />
            <h3 className="text-lg font-semibold">
              Ausgeblendete Maßnahmen ({filteredOutMeasures.length})
            </h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Diese Maßnahmen sind entweder ausgefiltert oder als umgesetzt/nicht umsetzbar markiert.
          </p>
          {filteredOutMeasures.map((item: any, index: number) => (
            <ResultMeasureCard
              key={item.measure.id}
              {...buildCardProps(item, visibleMeasures.length + index + 1)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ResultMeasureList;