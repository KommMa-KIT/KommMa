/**
 * ResultMeasureCompactList.tsx
 *
 * Scrollable sidebar list of compact measure cards.
 * Reads visible (non-filtered, non-hidden) measures from the Redux store and
 * renders a ResultMeasureCompactCard for each, passing selection state through.
 * Automatically scrolls the selected measure card into view when the selection changes.
 */

import { useSelector } from 'react-redux';
import { AlertCircle } from 'lucide-react';
import { useRef, useEffect } from 'react';
import ResultMeasureCompactCard from './ResultMeasureCompactCard';
import { ResultMeasureCompactSkeletonList } from './ResultMeasureCompactSkeleton';
import { selectVisibleMeasures, selectResultsLoading } from '../../store/ResultSlice';

interface ResultMeasureCompactListProps {
  /** ID of the currently selected measure, or null if none. */
  selectedMeasureId: string | null;
  /** Callback invoked when the user selects a measure. */
  onSelectMeasure:   (id: string) => void;
}

/**
 * ResultMeasureCompactList
 *
 * Renders one of three states:
 *  - **Loading** – skeleton placeholder list.
 *  - **Empty** – informational message prompting the user to run a calculation.
 *  - **Populated** – divider-separated list of ResultMeasureCompactCard instances
 *    with automatic scroll-to-selection.
 */
const ResultMeasureCompactList = ({
  selectedMeasureId,
  onSelectMeasure,
}: ResultMeasureCompactListProps) => {
  const measures = useSelector(selectVisibleMeasures);
  const loading  = useSelector(selectResultsLoading);

  const cardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    if (selectedMeasureId && cardRefs.current[selectedMeasureId]) {
      cardRefs.current[selectedMeasureId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedMeasureId]);

  if (loading) return <ResultMeasureCompactSkeletonList count={6} />;

  if (measures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <AlertCircle className="h-12 w-12 text-gray-400 mb-3" />
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Keine Maßnahmen gefunden</h3>
        <p className="text-xs text-gray-600 text-center">
          Bitte führen Sie zuerst eine Bewertung durch
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {measures.map((item: any, index: number) => (
        <ResultMeasureCompactCard
          key={item.measure.id}
          ref={(el) => { cardRefs.current[item.measure.id] = el; }}
          measure={item.measure}
          result={{
            timeScale:    item.timeScale,
            costScale:    item.costScale,
            climateScale: item.climateScale,
            ongoingCost:  item.ongoingCost,
            rank:         index + 1,
          }}
          isSelected={selectedMeasureId === item.measure.id}
          onClick={() => onSelectMeasure(item.measure.id)}
        />
      ))}
    </div>
  );
};

export default ResultMeasureCompactList;