/**
 * ListView.test.tsx
 *
 * Tests for ListView — a thin wrapper around ResultMeasureList.
 * Verifies that the container renders and ResultMeasureList is mounted.
 */

import { render, screen } from '@testing-library/react';
import ListView from '../../components/results/ListView';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../components/results/ResultMeasureList', () => () => (
  <div data-testid="result-measure-list" />
));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ListView', () => {
  it('renders without crashing', () => {
    render(<ListView />);
  });

  it('renders the ResultMeasureList component', () => {
    render(<ListView />);
    expect(screen.getByTestId('result-measure-list')).toBeInTheDocument();
  });

  it('wraps content in a space-y-6 container', () => {
    render(<ListView />);
    const wrapper = screen.getByTestId('result-measure-list').parentElement;
    expect(wrapper?.className).toContain('space-y-6');
  });
});