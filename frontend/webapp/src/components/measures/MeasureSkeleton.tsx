/**
 * MeasureSkeleton.tsx
 *
 * Animated placeholder components rendered in place of MeasureCards while
 * measure data is still loading. Mirrors the visual structure of MeasureCard
 * (image block, title, popularity badge, short description) using grey pulse
 * blocks so the layout does not shift when real content arrives.
 *
 * Exports:
 *  - MeasureSkeleton (default) — a single card-shaped placeholder.
 *  - MeasureSkeletonGrid (named) — a responsive grid of N placeholders,
 *    matching the MeasureList grid layout.
 */

// --- Components ---

/**
 * MeasureSkeleton
 *
 * A single pulsing placeholder card. Block dimensions are chosen to approximate
 * the real MeasureCard proportions so the transition to loaded content is smooth.
 */
const MeasureSkeleton = () => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">

      {/* Cover image placeholder */}
      <div className="w-full h-48 bg-gray-300" />

      {/* Content area placeholder */}
      <div className="p-6 space-y-4">

        {/* Title — 3/4 width approximates a typical short title */}
        <div className="h-6 bg-gray-300 rounded w-3/4" />

        {/* Popularity badge */}
        <div className="h-6 bg-gray-300 rounded w-24" />

        {/* Short description — two lines at different widths to suggest natural text */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-300 rounded w-full" />
          <div className="h-4 bg-gray-300 rounded w-5/6" />
        </div>

      </div>
    </div>
  );
};

/**
 * MeasureSkeletonGrid
 *
 * Renders `count` MeasureSkeleton cards in the same responsive 1→2→3 column
 * grid used by MeasureList, so the loading state occupies the correct amount
 * of vertical space and avoids layout shift on content arrival.
 *
 * @param count Number of skeleton cards to render. Defaults to 6.
 */
export const MeasureSkeletonGrid = ({ count = 6 }: { count?: number }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <MeasureSkeleton key={index} />
      ))}
    </div>
  );
};

export default MeasureSkeleton;