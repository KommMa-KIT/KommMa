/**
 * FilterSortDialog.tsx
 *
 * Modal dialog for adjusting ranking weights and applying filters to the results list.
 * Weights are visualised and edited via an interactive barycentric triangle (canvas-based).
 * Filter inputs allow the user to constrain results by cost, time, and emission savings.
 */

import { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { X, Filter } from 'lucide-react';
import { setRankingWeights, selectRankingWeights, FilterState } from '../../store/ResultSlice';

interface FilterSortDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

// --- Triangle geometry constants ---

const TRIANGLE_SIZE = 280;
const CENTER_X = 150;
const CENTER_Y = 150;
const HEIGHT = (Math.sqrt(3) / 2) * TRIANGLE_SIZE;

/** Screen-space coordinates for each vertex of the weight triangle. */
const VERTICES = {
  time:    { x: CENTER_X,                    y: CENTER_Y - HEIGHT * 0.6 },
  cost:    { x: CENTER_X - TRIANGLE_SIZE / 2, y: CENTER_Y + HEIGHT * 0.4 },
  climate: { x: CENTER_X + TRIANGLE_SIZE / 2, y: CENTER_Y + HEIGHT * 0.4 },
};

// --- Coordinate conversion helpers ---

/**
 * Converts a set of (unnormalised) weights into a 2-D point inside the triangle
 * using barycentric interpolation between the three vertices.
 */
const weightsToPoint = (w: { time: number; cost: number; climate: number }) => {
  const total = w.time + w.cost + w.climate;
  const normalized = {
    time:    w.time    / total,
    cost:    w.cost    / total,
    climate: w.climate / total,
  };

  return {
    x: VERTICES.time.x    * normalized.time    +
       VERTICES.cost.x    * normalized.cost    +
       VERTICES.climate.x * normalized.climate,
    y: VERTICES.time.y    * normalized.time    +
       VERTICES.cost.y    * normalized.cost    +
       VERTICES.climate.y * normalized.climate,
  };
};

/**
 * Converts a 2-D canvas point into normalised barycentric weights (time, cost, climate).
 * Values are clamped to [0, 1] and re-normalised so they always sum to 1.
 */
const pointToWeights = (x: number, y: number) => {
  const v0x = VERTICES.cost.x    - VERTICES.time.x;
  const v0y = VERTICES.cost.y    - VERTICES.time.y;
  const v1x = VERTICES.climate.x - VERTICES.time.x;
  const v1y = VERTICES.climate.y - VERTICES.time.y;
  const v2x = x - VERTICES.time.x;
  const v2y = y - VERTICES.time.y;

  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;

  const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
  const w = 1 - u - v;

  const cost    = Math.max(0, Math.min(1, u));
  const climate = Math.max(0, Math.min(1, v));
  const time    = Math.max(0, Math.min(1, w));

  const sum = time + cost + climate;
  return {
    time:    time    / sum,
    cost:    cost    / sum,
    climate: climate / sum,
  };
};

// --- Component ---

/**
 * FilterSortDialog
 *
 * Renders a modal with two sections:
 *  1. **Ranking weights** – an interactive canvas triangle where the user clicks or drags
 *     to redistribute the importance of time, cost, and climate impact.
 *  2. **Filters** – numeric inputs that hide measures exceeding thresholds for investment
 *     cost, ongoing cost, implementation time, and minimum emission savings.
 *
 * Changes are staged locally and only committed to the Redux store on "Apply".
 */
const FilterSortDialog = ({ open, onOpenChange, filters, onFiltersChange }: FilterSortDialogProps) => {
  const dispatch = useDispatch();
  const weights = useSelector(selectRankingWeights);

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const [isDragging,    setIsDragging]    = useState(false);
  const [localWeights,  setLocalWeights]  = useState(weights);
  const [localFilters,  setLocalFilters]  = useState(filters);

  // Sync local state when external props change
  useEffect(() => { setLocalWeights(weights); }, [weights]);
  useEffect(() => { setLocalFilters(filters); }, [filters]);

  // --- Canvas rendering ---

  /** Redraws the triangle and the current weight indicator whenever weights or visibility change. */
  useEffect(() => {
    if (!canvasRef.current || !open) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 300, 300);

    // Triangle outline + fill
    ctx.beginPath();
    ctx.moveTo(VERTICES.time.x,    VERTICES.time.y);
    ctx.lineTo(VERTICES.cost.x,    VERTICES.cost.y);
    ctx.lineTo(VERTICES.climate.x, VERTICES.climate.y);
    ctx.closePath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth   = 2;
    ctx.stroke();
    ctx.fillStyle   = 'rgba(59, 130, 246, 0.05)';
    ctx.fill();

    // Vertex labels
    ctx.fillStyle  = '#1f2937';
    ctx.font       = 'bold 12px sans-serif';
    ctx.textAlign  = 'center';
    ctx.fillText('Zeit',   VERTICES.time.x,        VERTICES.time.y    - 15);
    ctx.fillText('Kosten', VERTICES.cost.x    - 30, VERTICES.cost.y    + 20);
    ctx.fillText('Klima',  VERTICES.climate.x + 30, VERTICES.climate.y + 20);

    // Current weight indicator (red dot)
    const point = weightsToPoint(localWeights);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 8, 0, 2 * Math.PI);
    ctx.fillStyle   = '#ef4444';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 2;
    ctx.stroke();
  }, [localWeights, open]);

  // --- Event handlers ---

  /** Updates local weights from a canvas click position. */
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect      = canvas.getBoundingClientRect();
    const x         = e.clientX - rect.left;
    const y         = e.clientY - rect.top;
    const newWeights = pointToWeights(x, y);

    setLocalWeights({ time: newWeights.time, cost: newWeights.cost, climate: newWeights.climate });
  };

  /** Continues updating weights while the user drags inside the canvas. */
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    handleCanvasClick(e);
  };

  /** Commits local weights and filters to the Redux store and closes the dialog. */
  const handleApply = () => {
    dispatch(setRankingWeights(localWeights));
    onFiltersChange(localFilters);
    onOpenChange(false);
  };

  /** Resets both weights and filters to their defaults. */
  const handleReset = () => {
    setLocalWeights({ time: 1 / 3, cost: 1 / 3, climate: 1 / 3 });
    setLocalFilters({
      maxInvestmentCost:  null,
      maxOngoingCost:     null,
      maxTime:            null,
      minEmissionSavings: null,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog panel */}
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Filtern & Sortieren</h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Ranking weights section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Sortier-Gewichtung</h3>
            <div className="flex gap-6">

              {/* Interactive triangle canvas */}
              <div className="flex-shrink-0">
                <canvas
                  ref={canvasRef}
                  width={300}
                  height={300}
                  className="border border-gray-200 rounded cursor-crosshair"
                  onClick={handleCanvasClick}
                  onMouseDown={() => setIsDragging(true)}
                  onMouseUp={()   => setIsDragging(false)}
                  onMouseLeave={() => setIsDragging(false)}
                  onMouseMove={handleMouseMove}
                />
              </div>

              {/* Numeric weight readouts */}
              <div className="flex-1 space-y-3">
                <div className="p-3 bg-blue-50 rounded">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Zeit</span>
                    <span className="text-lg font-bold text-blue-600">
                      {Math.round(localWeights.time * 100)}%
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-amber-50 rounded">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Kosten</span>
                    <span className="text-lg font-bold text-amber-600">
                      {Math.round(localWeights.cost * 100)}%
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-green-50 rounded">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Klima</span>
                    <span className="text-lg font-bold text-green-600">
                      {Math.round(localWeights.climate * 100)}%
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Klicken oder ziehen Sie im Dreieck, um die Gewichtungen anzupassen
                </p>
              </div>
            </div>
          </div>

          {/* Filter inputs section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Filter</h3>
            <div className="grid grid-cols-2 gap-4">

              {/* Max investment cost */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max. Investitionskosten (€)
                </label>
                <input
                  type="number"
                  value={localFilters.maxInvestmentCost ?? ''}
                  onChange={(e) => setLocalFilters({
                    ...localFilters,
                    maxInvestmentCost: e.target.value ? Number(e.target.value) : null,
                  })}
                  placeholder="Unbegrenzt"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Max ongoing cost */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max. laufende Kosten (€/Jahr)
                </label>
                <input
                  type="number"
                  value={localFilters.maxOngoingCost ?? ''}
                  onChange={(e) => setLocalFilters({
                    ...localFilters,
                    maxOngoingCost: e.target.value ? Number(e.target.value) : null,
                  })}
                  placeholder="Unbegrenzt"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Max implementation time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max. Umsetzungszeit (Monate)
                </label>
                <input
                  type="number"
                  value={localFilters.maxTime ?? ''}
                  onChange={(e) => setLocalFilters({
                    ...localFilters,
                    maxTime: e.target.value ? Number(e.target.value) : null,
                  })}
                  placeholder="Unbegrenzt"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Min CO₂ savings */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min. CO₂-Einsparung (kg/Jahr)
                </label>
                <input
                  type="number"
                  value={localFilters.minEmissionSavings ?? ''}
                  onChange={(e) => setLocalFilters({
                    ...localFilters,
                    minEmissionSavings: e.target.value ? Number(e.target.value) : null,
                  })}
                  placeholder="Keine Mindestanforderung"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Zurücksetzen
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleApply}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Anwenden
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterSortDialog;