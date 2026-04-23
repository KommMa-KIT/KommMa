/**
 * MeasureSkeleton.test.tsx
 *
 * Tests for MeasureSkeleton (single card) and MeasureSkeletonGrid (grid of N cards).
 */

import { render } from '@testing-library/react';
import MeasureSkeleton, { MeasureSkeletonGrid } from '../../components/measures/MeasureSkeleton';

// ─── MeasureSkeleton ──────────────────────────────────────────────────────────

describe('MeasureSkeleton', () => {
  it('renders a single card', () => {
    const { container } = render(<MeasureSkeleton />);
    expect(container.firstChild).toBeDefined();
  });

  it('applies the animate-pulse class', () => {
    const { container } = render(<MeasureSkeleton />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('animate-pulse');
  });

  it('renders an image placeholder block (h-48 bg-gray-300)', () => {
    const { container } = render(<MeasureSkeleton />);
    expect(container.querySelector('.h-48.bg-gray-300')).toBeDefined();
  });

  it('renders a title placeholder block (h-6)', () => {
    const { container } = render(<MeasureSkeleton />);
    expect(container.querySelector('.h-6.bg-gray-300')).toBeDefined();
  });

  it('renders description placeholder blocks (h-4)', () => {
    const { container } = render(<MeasureSkeleton />);
    const descBlocks = container.querySelectorAll('.h-4.bg-gray-300');
    expect(descBlocks.length).toBeGreaterThan(0);
  });

  it('has rounded card container', () => {
    const { container } = render(<MeasureSkeleton />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('rounded-lg');
  });
});

// ─── MeasureSkeletonGrid ──────────────────────────────────────────────────────

describe('MeasureSkeletonGrid', () => {
  it('renders 6 skeleton cards by default', () => {
    const { container } = render(<MeasureSkeletonGrid />);
    expect(container.querySelectorAll('.animate-pulse').length).toBe(6);
  });

  it('renders the specified number of skeleton cards', () => {
    const { container } = render(<MeasureSkeletonGrid count={3} />);
    expect(container.querySelectorAll('.animate-pulse').length).toBe(3);
  });

  it('renders 1 skeleton card when count is 1', () => {
    const { container } = render(<MeasureSkeletonGrid count={1} />);
    expect(container.querySelectorAll('.animate-pulse').length).toBe(1);
  });

  it('renders 0 skeleton cards when count is 0', () => {
    const { container } = render(<MeasureSkeletonGrid count={0} />);
    expect(container.querySelectorAll('.animate-pulse').length).toBe(0);
  });

  it('renders a responsive grid container (1/2/3 columns)', () => {
    const { container } = render(<MeasureSkeletonGrid count={1} />);
    const grid = container.firstChild as HTMLElement;
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).toContain('md:grid-cols-2');
    expect(grid.className).toContain('lg:grid-cols-3');
  });

  it('matches the MeasureList grid gap', () => {
    const { container } = render(<MeasureSkeletonGrid count={1} />);
    const grid = container.firstChild as HTMLElement;
    expect(grid.className).toContain('gap-6');
  });
});