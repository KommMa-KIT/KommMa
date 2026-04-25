/**
 * ResultMeasureSkeleton.tsx
 *
 * Animated placeholder that mirrors the layout of ResultMeasureCard.
 * Used while measure data is being fetched or calculated.
 */

/**
 * ResultMeasureSkeleton
 *
 * Single full-size skeleton card with placeholders for:
 *  - Image panel (left).
 *  - Title, popularity badge, description, and metric row (centre).
 *  - Three icon-scale score panels (right).
 */
const ResultMeasureSkeleton = () => (
  <div className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse flex">
    {/* Image panel */}
    <div className="w-64 flex-shrink-0 bg-gray-300" />

    {/* Content panel */}
    <div className="flex-1 p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className="h-8 bg-gray-300 rounded w-2/3" />
          <div className="h-6 bg-gray-300 rounded w-24 ml-4" />
        </div>
        <div className="space-y-2 mb-4">
          <div className="h-4 bg-gray-300 rounded w-full" />
          <div className="h-4 bg-gray-300 rounded w-4/5" />
        </div>
      </div>
      <div className="flex gap-6 pt-4 border-t border-gray-200">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-5 w-5 bg-gray-300 rounded-full" />
            <div className="flex flex-col gap-1">
              <div className="h-3 bg-gray-300 rounded w-20" />
              <div className="h-5 bg-gray-300 rounded w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Score panel */}
    <div className="flex flex-col items-center justify-center gap-8 px-6 border-l border-gray-200 bg-gray-50">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <div className="h-3 bg-gray-300 rounded w-12 mb-2" />
          <div className="flex gap-1">
            {[...Array(5)].map((_, j) => (
              <div key={j} className="h-5 w-5 bg-gray-300 rounded" />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

/**
 * ResultMeasureSkeletonList
 *
 * Renders `count` full-size skeleton cards in a spaced list.
 *
 * @param count Number of skeleton items to render (default: 3).
 */
export const ResultMeasureSkeletonList = ({ count = 3 }: { count?: number }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <ResultMeasureSkeleton key={i} />
    ))}
  </div>
);

export default ResultMeasureSkeleton;
