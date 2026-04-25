/**
 * ResultMeasureCompactSkeleton.test.tsx
 *
 * Tests for ResultMeasureCompactSkeleton and ResultMeasureCompactSkeletonList covering:
 *  - Single skeleton renders animate-pulse class
 *  - Single skeleton contains rank badge placeholder
 *  - Single skeleton contains two line placeholders
 *  - Single skeleton contains three score panel placeholders
 *  - ResultMeasureCompactSkeletonList renders default 6 skeletons
 *  - ResultMeasureCompactSkeletonList renders custom count
 *  - List wrapper has divide-y class
 */

import { render } from '@testing-library/react';
import ResultMeasureCompactSkeleton, {
  ResultMeasureCompactSkeletonList,
} from '../../components/results/ResultMeasureCompactSkeleton';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ResultMeasureCompactSkeleton', () => {
  it('renders animate-pulse class', () => {
    const { container } = render(<ResultMeasureCompactSkeleton />);
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('renders the rank badge placeholder (rounded-full)', () => {
    const { container } = render(<ResultMeasureCompactSkeleton />);
    expect(container.querySelector('.rounded-full')).not.toBeNull();
  });

  it('renders three score-panel placeholders (h-12)', () => {
    const { container } = render(<ResultMeasureCompactSkeleton />);
    const panels = container.querySelectorAll('.h-12');
    expect(panels).toHaveLength(3);
  });

  it('renders in a grid of 3 columns for score panels', () => {
    const { container } = render(<ResultMeasureCompactSkeleton />);
    expect(container.querySelector('.grid-cols-3')).not.toBeNull();
  });

  it('renders border-l-4 class', () => {
    const { container } = render(<ResultMeasureCompactSkeleton />);
    expect(container.querySelector('.border-l-4')).not.toBeNull();
  });

  it('renders two text-line placeholders (bg-gray-300 inside flex-1)', () => {
    const { container } = render(<ResultMeasureCompactSkeleton />);
    // Both h-3.5 elements are the title + description placeholders
    const lines = container.querySelectorAll('.h-3\\.5');
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });
});

describe('ResultMeasureCompactSkeletonList', () => {
  it('renders 6 skeletons by default', () => {
    const { container } = render(<ResultMeasureCompactSkeletonList />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses).toHaveLength(6);
  });

  it('renders custom count', () => {
    const { container } = render(<ResultMeasureCompactSkeletonList count={3} />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses).toHaveLength(3);
  });

  it('renders 1 skeleton when count=1', () => {
    const { container } = render(<ResultMeasureCompactSkeletonList count={1} />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses).toHaveLength(1);
  });

  it('wraps skeletons in a divide-y container', () => {
    const { container } = render(<ResultMeasureCompactSkeletonList />);
    expect(container.querySelector('.divide-y')).not.toBeNull();
  });
});