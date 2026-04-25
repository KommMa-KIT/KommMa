/**
 * ResultMeasureCompactList.test.tsx
 *
 * Fix: React.forwardRef in jest.mock() Factory ist out-of-scope.
 * Lösung: require('react') innerhalb der Factory verwenden.
 */

import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ResultMeasureCompactList from '../../components/results/ResultMeasureCompactList';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../components/results/ResultMeasureCompactSkeleton', () => ({
  ResultMeasureCompactSkeletonList: ({ count }: { count: number }) => (
    <div data-testid="skeleton-list" data-count={count} />
  ),
}));

// capturedCards muss mock-Prefix haben damit Jest es in hoisted Factory erlaubt,
// ODER wir nutzen require() innerhalb der Factory. Hier: require-Trick.
const mockCapturedCards: any[] = [];

jest.mock('../../components/results/ResultMeasureCompactCard', () => {
  // require innerhalb der Factory ist immer erlaubt
  const { forwardRef } = require('react');
  return forwardRef((props: any, ref: any) => {
    mockCapturedCards.push(props);
    return (
      <div
        ref={ref}
        data-testid={`compact-card-${props.measure.id}`}
        data-selected={String(props.isSelected)}
        data-rank={props.result.rank}
        onClick={props.onClick}
      />
    );
  });
});

jest.mock('../../store/ResultSlice', () => ({
  selectVisibleMeasures: (state: any) => state.result.visibleMeasures,
  selectResultsLoading:  (state: any) => state.result.loading,
}));

// Mock scrollIntoView
const mockScrollIntoView = jest.fn();
window.HTMLElement.prototype.scrollIntoView = mockScrollIntoView;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MEASURES = [
  {
    measure: { id: 'm1', title: 'Measure 1', shortDescription: 'Desc 1' },
    timeScale: 3, costScale: 2, climateScale: 4, ongoingCost: 500,
  },
  {
    measure: { id: 'm2', title: 'Measure 2', shortDescription: 'Desc 2' },
    timeScale: 1, costScale: 3, climateScale: 2, ongoingCost: -100,
  },
];

function buildStore(loading = false, measures = MEASURES) {
  return configureStore({
    reducer: { result: () => ({ loading, visibleMeasures: measures }) },
  });
}

function renderList(
  selectedMeasureId: string | null = null,
  onSelectMeasure = jest.fn(),
  loading = false,
  measures = MEASURES,
) {
  const store = buildStore(loading, measures);
  return render(
    <Provider store={store}>
      <ResultMeasureCompactList
        selectedMeasureId={selectedMeasureId}
        onSelectMeasure={onSelectMeasure}
      />
    </Provider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ResultMeasureCompactList', () => {
  beforeEach(() => {
    mockCapturedCards.length = 0;
    mockScrollIntoView.mockClear();
  });

  // --- Loading state --------------------------------------------------------

  it('renders skeleton list when loading', () => {
    renderList(null, jest.fn(), true);
    expect(screen.getByTestId('skeleton-list')).toBeInTheDocument();
  });

  it('passes count=6 to skeleton list', () => {
    renderList(null, jest.fn(), true);
    expect(screen.getByTestId('skeleton-list')).toHaveAttribute('data-count', '6');
  });

  it('does NOT render cards when loading', () => {
    renderList(null, jest.fn(), true);
    expect(screen.queryByTestId('compact-card-m1')).not.toBeInTheDocument();
  });

  // --- Empty state ----------------------------------------------------------

  it('renders empty state message when no measures', () => {
    renderList(null, jest.fn(), false, []);
    expect(screen.getByText('Keine Maßnahmen gefunden')).toBeInTheDocument();
  });

  it('renders empty state sub-text', () => {
    renderList(null, jest.fn(), false, []);
    expect(screen.getByText(/Bitte führen Sie zuerst eine Bewertung durch/)).toBeInTheDocument();
  });

  it('does NOT render cards in empty state', () => {
    renderList(null, jest.fn(), false, []);
    expect(screen.queryByTestId('compact-card-m1')).not.toBeInTheDocument();
  });

  // --- Populated state ------------------------------------------------------

  it('renders one card per measure', () => {
    renderList();
    expect(screen.getByTestId('compact-card-m1')).toBeInTheDocument();
    expect(screen.getByTestId('compact-card-m2')).toBeInTheDocument();
  });

  it('assigns rank=1 to first measure', () => {
    renderList();
    expect(screen.getByTestId('compact-card-m1')).toHaveAttribute('data-rank', '1');
  });

  it('assigns rank=2 to second measure', () => {
    renderList();
    expect(screen.getByTestId('compact-card-m2')).toHaveAttribute('data-rank', '2');
  });

  it('passes timeScale, costScale, climateScale, ongoingCost to card', () => {
    renderList();
    const card = mockCapturedCards.find(c => c.measure.id === 'm1');
    expect(card.result.timeScale).toBe(3);
    expect(card.result.costScale).toBe(2);
    expect(card.result.climateScale).toBe(4);
    expect(card.result.ongoingCost).toBe(500);
  });

  // --- Selection state ------------------------------------------------------

  it('isSelected=true for matching selectedMeasureId', () => {
    renderList('m1');
    expect(screen.getByTestId('compact-card-m1')).toHaveAttribute('data-selected', 'true');
  });

  it('isSelected=false for non-matching selectedMeasureId', () => {
    renderList('m1');
    expect(screen.getByTestId('compact-card-m2')).toHaveAttribute('data-selected', 'false');
  });

  it('isSelected=false for all cards when selectedMeasureId=null', () => {
    renderList(null);
    expect(screen.getByTestId('compact-card-m1')).toHaveAttribute('data-selected', 'false');
    expect(screen.getByTestId('compact-card-m2')).toHaveAttribute('data-selected', 'false');
  });

  // --- Divider wrapper ------------------------------------------------------

  it('wraps cards in a divide-y container', () => {
    renderList();
    const container = screen.getByTestId('compact-card-m1').parentElement;
    expect(container?.className).toContain('divide-y');
  });

  // --- scrollIntoView -------------------------------------------------------

  it('calls scrollIntoView when selectedMeasureId matches a rendered card', () => {
    renderList('m1');
    expect(mockScrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
    });
  });

  it('does NOT call scrollIntoView when selectedMeasureId is null', () => {
    renderList(null);
    expect(mockScrollIntoView).not.toHaveBeenCalled();
  });
});