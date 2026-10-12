/**
 * MatrixCanvas.tsx
 *
 * A Recharts bubble (scatter) chart that plots the top-ranked measures on a
 * two-dimensional cost-vs-time matrix. Bubble size encodes the climate score,
 * giving a three-dimensional view of each measure's trade-offs at a glance.
 * Clicking a bubble selects the corresponding measure, synchronising with any
 * sibling panels that share the selectedMeasureId prop.
 */

import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ZAxis,
} from 'recharts';

// --- Types ---

interface MatrixCanvasProps {
  /** Ranked measure result objects; each contains a nested measure and score fields. */
  measures: any[];
  /** ID of the currently highlighted measure; null when no selection is active. */
  selectedMeasureId: string | null;
  /** Callback fired when the user clicks a bubble. */
  onSelectMeasure: (id: string) => void;
  /** Canvas height in pixels. Defaults to 600. */
  height?: number;
}

interface MatrixDataPoint {
  id:           string;
  name:         string;
  /** X-axis value — implementation time in months. */
  x:            number;
  /** Y-axis value — investment cost in euros. */
  y:            number;
  /** Z-axis (bubble size) value — climate score. */
  z:            number;
  timeScore:    number;
  costScore:    number;
  climateScore: number;
}

// --- Component ---

/**
 * MatrixCanvas
 *
 * Sections:
 *  - data derivation — measures mapped to MatrixDataPoint objects
 *  - CustomTooltip — formatted hover card showing cost, time, and climate score
 *  - formatCost / formatTime — axis tick formatters
 *  - handleClick — bridges Recharts click events to onSelectMeasure
 *  - Empty state — rendered when no data points are available
 *  - ScatterChart render with ZAxis bubble sizing and per-Cell selection styling
 */
const MatrixCanvas = ({
  measures,
  selectedMeasureId,
  onSelectMeasure,
  height = 600,
}: MatrixCanvasProps) => {

  // --- Data derivation ---

  /**
   * Transforms ranked measure results into the flat MatrixDataPoint shape
   * required by Recharts. Fields default to 0 / 1 on missing data to prevent
   * the chart from breaking when results are partially populated.
   */
  const data: MatrixDataPoint[] = measures.map((item) => ({
    id:           item?.measure.id    || '',
    name:         item?.measure.title || '',
    x:            item?.investmentCost || 0,
    y:            item?.time           || 0,
    z:            item?.climateScore   || 1,
    timeScore:    item?.timeScore      || 0,
    costScore:    item?.costScore      || 0,
    climateScore: item?.climateScore   || 0,
  }));

  // --- Custom tooltip ---

  /**
   * CustomTooltip
   *
   * Renders a small card on hover showing the measure's name alongside its
   * cost (formatted as a German locale currency string), implementation time
   * in months, and climate score to one decimal place.
   */
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;

    const point = payload[0].payload as MatrixDataPoint;

    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="font-semibold text-gray-900 mb-2 text-sm">{point.name}</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Kosten:</span>
            <span className="font-medium text-gray-900">
              {new Intl.NumberFormat('de-DE', {
                style: 'currency',
                currency: 'EUR',
                maximumFractionDigits: 0,
              }).format(point.x)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Zeit:</span>
            <span className="font-medium text-gray-900">{point.y} Monate</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Klima-Score:</span>
            <span className="font-medium text-gray-900">{point.climateScore.toFixed(1)}</span>
          </div>
        </div>
      </div>
    );
  };

  // --- Axis formatters ---

  /**
   * Formats Y-axis cost tick values into human-readable shorthand.
   * Values ≥ 1 000 000 → "1.0M", values ≥ 1 000 → "10k", otherwise plain number.
   */
  const formatCost = (value: number): string => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000)     return `${(value / 1_000).toFixed(0)}k`;
    return `${value}`;
  };

  /**
   * Formats X-axis time tick values.
   * Currently returns the raw value as a string; extracted as a named formatter
   * for consistency with formatCost and to allow future unit decoration.
   */
  const formatTime = (value: number): string => `${value}`;

  // --- Handlers ---

  /** Propagates a bubble click to the parent via onSelectMeasure. */
  const handleClick = (data: MatrixDataPoint) => {
    onSelectMeasure(data.id);
  };

  // --- Empty state ---

  if (data.length === 0) {
    return (
      <div
        className="w-full bg-gray-50 border-2 border-gray-200 rounded-lg flex items-center justify-center"
        style={{ height: `${height}px` }}
      >
        <div className="text-center">
          <p className="text-gray-600 font-medium mb-2">Keine Daten verfügbar</p>
          <p className="text-sm text-gray-500">Bitte führen Sie zuerst eine Berechnung durch</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full bg-white rounded-lg p-6"
      style={{ height: `${height}px` }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 30, bottom: 60, left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

          {/* X-axis — implementation time in months */}
          <XAxis
            type="number"
            dataKey="y"
            name="Zeit"
            tickFormatter={formatTime}
            label={{
              value: 'Umsetzungszeit (Monate)',
              position: 'bottom',
              offset: 40,
              style: { fontSize: 14, fill: '#374151' },
            }}
            stroke="#6b7280"
          />

          {/* Y-axis — investment cost in euros */}
          <YAxis
            type="number"
            dataKey="x"
            name="Kosten"
            tickFormatter={formatCost}
            label={{
              value: 'Investitionskosten (€)',
              angle: -90,
              position: 'left',
              offset: 60,
              style: { fontSize: 14, fill: '#374151' },
            }}
            stroke="#6b7280"
          />

          {/* Z-axis — bubble size range [100, 500] mapped to climate score */}
          <ZAxis
            type="number"
            dataKey="z"
            name="Klima-Score"
            range={[100, 500]}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />

          <Scatter
            data={data}
            fill="#67AE6E"
            onClick={(data) => handleClick(data as MatrixDataPoint)}
          >
            {/* Per-bubble Cell styling — selected bubble uses darker fill and heavier stroke */}
            {data.map((entry, index) => {
              const isSelected = entry.id === selectedMeasureId;
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={isSelected ? '#328E6E' : '#67AE6E'}
                  stroke={isSelected ? '#1a5a4a' : '#328E6E'}
                  strokeWidth={isSelected ? 3 : 1}
                  opacity={isSelected ? 1 : 0.7}
                  cursor="pointer"
                />
              );
            })}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {/* Chart legend — explains the bubble size encoding */}
      <div className="mt-4 flex items-center justify-center gap-8 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <span className="text-xs">Bubble-Größe = Klima-Score</span>
        </div>
      </div>
    </div>
  );
};

export default MatrixCanvas;