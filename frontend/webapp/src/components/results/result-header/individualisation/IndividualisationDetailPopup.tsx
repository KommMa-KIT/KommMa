/**
 * IndividualisationDetailPopup.tsx
 *
 * Modal popup that shows a detailed breakdown of how individualised the user's
 * data input is across four categories (general, energy, mobility, water).
 * Displays an overall score, a radar chart per category, and a short legend grid.
 */

import { X, Activity } from 'lucide-react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';

interface IndividualisationDetailPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Individualisation scores as fractions in [0, 1]. */
  levels: {
    general:  number;
    energy:   number;
    mobility: number;
    water:    number;
    total:    number;
  };
}

// --- Colour helpers (based on percentage score) ---

/** Returns a hex colour for chart strokes/fills. Green ≥ 70 %, amber ≥ 40 %, red otherwise. */
const getColor = (value: number): string => {
  if (value >= 70) return '#10b981';
  if (value >= 40) return '#f59e0b';
  return '#ef4444';
};

/** Returns a Tailwind text-colour class for the given percentage. */
const getTextColor = (value: number): string => {
  if (value >= 70) return 'text-green-600';
  if (value >= 40) return 'text-amber-600';
  return 'text-red-600';
};

/** Returns a Tailwind background-colour class for the given percentage. */
const getBgColor = (value: number): string => {
  if (value >= 70) return 'bg-green-50';
  if (value >= 40) return 'bg-amber-50';
  return 'bg-red-50';
};

// --- Component ---

/**
 * IndividualisationDetailPopup
 *
 * Opened from the IndividualisationProgressBar info button.
 * Sections:
 *  - Overall score badge
 *  - Radar chart with one axis per category
 *  - Mini legend grid (category × percentage)
 *  - Explanatory hint
 */
const IndividualisationDetailPopup = ({
  open,
  onOpenChange,
  levels,
}: IndividualisationDetailPopupProps) => {
  if (!open) return null;

  /** Converts a [0, 1] fraction to a rounded integer percentage. */
  const toPercent = (value: number): number => Math.round(value * 100);

  // Recharts dataset
  const chartData = [
    { category: 'Allgemein',  value: toPercent(levels.general),  fullMark: 100 },
    { category: 'Energie',    value: toPercent(levels.energy),   fullMark: 100 },
    { category: 'Mobilität',  value: toPercent(levels.mobility), fullMark: 100 },
    { category: 'Wasser',     value: toPercent(levels.water),    fullMark: 100 },
  ];

  // --- Custom tooltip ---

  /**
   * CustomTooltip
   *
   * Renders a small card with the category name and its percentage value,
   * coloured according to the score tier.
   */
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;

    const value    = payload[0].value as number;
    const category = payload[0].payload.category as string;
    const textColor = getTextColor(value);

    const colorMap: Record<string, string> = {
      'text-green-600': '#16a34a',
      'text-amber-600': '#d97706',
      'text-red-600':   '#dc2626',
    };

    return (
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        padding: '8px 12px',
      }}>
        <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, color: '#374151' }}>
          {category}
        </p>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: colorMap[textColor] }}>
          {value}%
        </p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog panel */}
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden m-4 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Individualisierungsgrad - Details</h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="p-4 overflow-y-auto flex-1">

          {/* Overall score */}
          <div className={`mb-4 p-3 rounded-lg ${getBgColor(toPercent(levels.total))}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Gesamt-Individualisierung</span>
              <span className={`text-2xl font-bold ${getTextColor(toPercent(levels.total))}`}>
                {toPercent(levels.total)}%
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Basierend auf der Anzahl Ihrer individuellen Angaben in der Dateneingabe
            </p>
          </div>

          {/* Radar chart */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Aufschlüsselung nach Kategorien</h3>
            <div className="w-full h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={chartData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis
                    dataKey="category"
                    tick={{ fill: '#374151', fontSize: 11, fontWeight: 500 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Radar
                    name="Individualisierung"
                    dataKey="value"
                    stroke={getColor(toPercent(levels.total))}
                    fill={getColor(toPercent(levels.total))}
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Tooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category legend grid */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {chartData.map((item) => (
              <div key={item.category} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">{item.category}</span>
                <span className={`text-lg font-bold ${getTextColor(item.value)}`}>
                  {item.value}%
                </span>
              </div>
            ))}
          </div>

          {/* Explanatory hint */}
          <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Hinweis:</strong> Je höher der Individualisierungsgrad, desto genauer sind die Empfehlungen
              auf Ihre spezifische Situation zugeschnitten. Niedrige Werte basieren hauptsächlich auf Durchschnittswerten.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t bg-gray-50 flex-shrink-0">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};

export default IndividualisationDetailPopup;