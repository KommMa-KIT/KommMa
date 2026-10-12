/**
 * ResultMeasureCompactSkeleton.tsx
 *
 * Animated placeholder that mirrors the layout of ResultMeasureCompactCard.
 * Rendered while measure data is loading to prevent layout shift.
 */

/**
 * ResultMeasureCompactSkeleton
 *
 * Single skeleton card with:
 *  - Rank badge placeholder.
 *  - Two-line title/description placeholders.
 *  - Three score-panel placeholders.
 *  - Three metric placeholders.
 */
const ResultMeasureCompactSkeleton = () => (
  <div className="p-3 animate-pulse border-l-4 border-transparent">
    <div className="flex items-start gap-2 mb-2">
      <div className="flex-shrink-0 w-7 h-7 bg-gray-300 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 bg-gray-300 rounded w-full" />
        <div className="h-3.5 bg-gray-200 rounded w-3/4" />
      </div>
    </div>
    <div className="grid grid-cols-3 gap-2 mb-2">
      <div className="h-12 bg-gray-200 rounded" />
      <div className="h-12 bg-gray-200 rounded" />
      <div className="h-12 bg-gray-200 rounded" />
    </div>
    <div className="flex items-center justify-between">
      <div className="h-3 w-12 bg-gray-300 rounded" />
      <div className="h-3 w-12 bg-gray-300 rounded" />
      <div className="h-3 w-12 bg-gray-300 rounded" />
    </div>
  </div>
);

/**
 * ResultMeasureCompactSkeletonList
 *
 * Renders `count` skeleton cards in a divider-separated list.
 *
 * @param count Number of skeleton items to render (default: 6).
 */
export const ResultMeasureCompactSkeletonList = ({ count = 6 }: { count?: number }) => (
  <div className="divide-y divide-gray-100">
    {Array.from({ length: count }).map((_, i) => (
      <ResultMeasureCompactSkeleton key={i} />
    ))}
  </div>
);

export default ResultMeasureCompactSkeleton;
