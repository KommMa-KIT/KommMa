/**
 * ListView.test.tsx
 *
 * Tests for ListView — a thin wrapper around ResultMeasureList.
 * Verifies that the container renders and ResultMeasureList is mounted.
 */

import { render, screen } from '@testing-library/react';
import ListView from './ListView';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../result-measure/card/ResultMeasureList', () => () => (
  <div data-testid="result-measure-list" />
));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ListView', () => {
  it('renders one ranked measure list', () => {
    render(<ListView />);
    expect(screen.getAllByTestId('result-measure-list')).toHaveLength(1);
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