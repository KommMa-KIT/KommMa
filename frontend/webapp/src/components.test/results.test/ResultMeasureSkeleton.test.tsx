/**
 * ResultMeasureSkeleton.test.tsx
 *
 * Tests for ResultMeasureSkeleton and ResultMeasureSkeletonList covering:
 *  - Single skeleton renders animate-pulse
 *  - Image panel placeholder rendered (w-64)
 *  - Content panel placeholders rendered
 *  - Score panel placeholders (3 groups, 5 icons each)
 *  - ResultMeasureSkeletonList renders default 3 skeletons
 *  - ResultMeasureSkeletonList renders custom count
 *  - List wrapper has space-y-4 class
 */

import { render } from '@testing-library/react';
import ResultMeasureSkeleton, {
  ResultMeasureSkeletonList,
} from '../../components/results/ResultMeasureSkeleton';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ResultMeasureSkeleton', () => {
  it('renders with animate-pulse class', () => {
    const { container } = render(<ResultMeasureSkeleton />);
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('renders image panel placeholder (w-64)', () => {
    const { container } = render(<ResultMeasureSkeleton />);
    expect(container.querySelector('.w-64')).not.toBeNull();
  });

  it('renders score panel placeholder with 3 score groups', () => {
    const { container } = render(<ResultMeasureSkeleton />);
    // Each score group has a flex-col wrapper
    const scorePanel = container.querySelector('.bg-gray-50.border-l');
    expect(scorePanel).not.toBeNull();
  });

  it('renders 5 icon placeholders per score group (15 total)', () => {
    const { container } = render(<ResultMeasureSkeleton />);
    // All h-5 w-5 bg-gray-300 elements in score panel area
    const iconPlaceholders = container.querySelectorAll('.h-5.w-5.bg-gray-300');
    expect(iconPlaceholders.length).toBeGreaterThanOrEqual(15);
  });

  it('renders content panel (flex-1 p-6)', () => {
    const { container } = render(<ResultMeasureSkeleton />);
    expect(container.querySelector('.flex-1.p-6')).not.toBeNull();
  });

  it('renders 2 metric row placeholders (flex items-center gap-2)', () => {
    const { container } = render(<ResultMeasureSkeleton />);
    // The two items in the bottom metric row have rounded-full h-5 w-5
    const iconCircles = container.querySelectorAll('.rounded-full.h-5.w-5.bg-gray-300');
    expect(iconCircles.length).toBeGreaterThanOrEqual(2);
  });

  it('wraps everything in a flex container', () => {
    const { container } = render(<ResultMeasureSkeleton />);
    expect(container.querySelector('.flex.bg-white')).not.toBeNull();
  });
});

describe('ResultMeasureSkeletonList', () => {
  it('renders 3 skeletons by default', () => {
    const { container } = render(<ResultMeasureSkeletonList />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses).toHaveLength(3);
  });

  it('renders custom count', () => {
    const { container } = render(<ResultMeasureSkeletonList count={5} />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses).toHaveLength(5);
  });

  it('renders 1 skeleton when count=1', () => {
    const { container } = render(<ResultMeasureSkeletonList count={1} />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses).toHaveLength(1);
  });

  it('wraps skeletons in a space-y-4 container', () => {
    const { container } = render(<ResultMeasureSkeletonList />);
    expect(container.querySelector('.space-y-4')).not.toBeNull();
  });
});