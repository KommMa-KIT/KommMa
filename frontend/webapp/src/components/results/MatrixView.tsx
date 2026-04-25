/**
 * MatrixView.tsx
 *
 * The results-page view that combines the cost-vs-time bubble matrix with a
 * scrollable compact measure list. Selecting a measure in either panel
 * highlights it in both via shared selectedMeasureId state, mirroring the
 * same bidirectional selection pattern used in GraphView.
 */

import { useState } from 'react';
import { useSelector } from 'react-redux';
import { BarChart3 } from 'lucide-react';
import { selectTopNMeasures } from '../../store/ResultSlice';
import MatrixCanvas from './MatrixCanvas';
import ResultMeasureCompactList from './ResultMeasureCompactList';

// --- Component ---

/**
 * MatrixView
 *
 * Sections:
 *  - Redux state (top 20 ranked measures)
 *  - selectedMeasureId local state — shared between canvas and list panels
 *  - Two-column layout:
 *      Left (2/3): MatrixCanvas
 *      Right (1/3): Sticky ResultMeasureCompactList, scrollable to 700 px
 */
const MatrixView = () => {
  /** The top 20 measures by rank, passed to both the canvas and the list. */
  const rankedMeasures = useSelector(selectTopNMeasures(20));

  /**
   * The ID of the measure currently highlighted in both the matrix and the
   * compact list. Null when no measure is selected. Clicking a bubble in the
   * canvas or a row in the list updates this value, synchronising both panels.
   */
  const [selectedMeasureId, setSelectedMeasureId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

      {/* Left panel (2/3 width) — bubble matrix canvas */}
      <div className="xl:col-span-2 space-y-4">
        <div className="bg-white rounded-lg shadow-sm">
          <MatrixCanvas
            measures={rankedMeasures}
            selectedMeasureId={selectedMeasureId}
            onSelectMeasure={setSelectedMeasureId}
          />
        </div>
      </div>

      {/* Right panel (1/3 width) — sticky compact measure list */}
      <div className="xl:col-span-1">
        <div className="bg-white rounded-lg shadow-sm sticky top-4">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-gray-900">Maßnahmen</h3>
            </div>
            <p className="text-xs text-gray-500">
              Klicken Sie auf eine Maßnahme, um sie in der Matrix hervorzuheben
            </p>
          </div>

          {/* Scrollable list — capped at 700 px to keep the panel within the viewport */}
          <div className="max-h-[700px] overflow-y-auto">
            <ResultMeasureCompactList
              selectedMeasureId={selectedMeasureId}
              onSelectMeasure={setSelectedMeasureId}
            />
          </div>
        </div>
      </div>

    </div>
  );
};

export default MatrixView;