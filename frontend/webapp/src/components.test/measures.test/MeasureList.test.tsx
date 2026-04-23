/**
 * MeasureList.test.tsx
 *
 * Tests for MeasureList – grid rendering, result count, and empty states.
 */

import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../../components/measures/MeasureCard', () => ({
  __esModule: true,
  default: ({ measure }: any) => <div>{measure.title}</div>,
}));

jest.mock('../../store/MeasuresSlice', () => ({
  selectFilteredMeasures: (state: any) => state.measures.filteredMeasures,
  selectSearchQuery: (state: any) => state.measures.searchQuery,
}));

// ─── Import ───────────────────────────────────────────────────────────────────

import MeasureList from '../../components/measures/MeasureList';

// ─── Store Factory ────────────────────────────────────────────────────────────

function makeStore(filteredMeasures: any[] = [], searchQuery = '') {
  return configureStore({
    reducer: {
      measures: (state = { filteredMeasures, searchQuery }) => state,
    },
  });
}

function renderList(measures: any[], searchQuery = '') {
  return render(
    <Provider store={makeStore(measures, searchQuery)}>
      <MeasureList />
    </Provider>
  );
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const threeMeasures = [
  { id: 'M1', title: 'Maßnahme 1' },
  { id: 'M2', title: 'Maßnahme 2' },
  { id: 'M3', title: 'Maßnahme 3' },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MeasureList', () => {
  // --- Grid rendering ---

  it('renders a MeasureCard for each measure', () => {
    renderList(threeMeasures);
    threeMeasures.forEach((m) => {
      expect(screen.getByText(m.title)).toBeInTheDocument();
    });
  });

  it('renders measure titles', () => {
    renderList(threeMeasures);
    expect(screen.getByText('Maßnahme 1')).toBeInTheDocument();
    expect(screen.getByText('Maßnahme 2')).toBeInTheDocument();
  });

  // --- Result count ---

  it('shows correct count for multiple measures', () => {
    renderList(threeMeasures);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/Maßnahmen/)).toBeInTheDocument();
  });

  it('shows "Maßnahme" (singular) for exactly one result', () => {
    renderList([threeMeasures[0]]);
    expect(screen.getByText('1')).toBeInTheDocument();
    // Matches "Maßnahme" but NOT "Maßnahmen"
    expect(screen.queryByText(/\d Maßnahmen/)).toBeNull();
  });

  it('appends search query to result count when active', () => {
    renderList(threeMeasures, 'solar');
    expect(screen.getByText(/für "solar"/)).toBeInTheDocument();
  });

  it('does not append search query when query is empty', () => {
    renderList(threeMeasures, '');
    expect(screen.queryByText(/für ""/)).toBeNull();
  });

  // --- Empty state: active search ---

  it('shows "Keine Maßnahmen gefunden" when list is empty', () => {
    renderList([], 'xyz');
    expect(screen.getByText('Keine Maßnahmen gefunden')).toBeInTheDocument();
  });

  it('shows query-specific empty message when search is active', () => {
    renderList([], 'xyz');
    expect(screen.getByText(/Keine Ergebnisse für "xyz"/)).toBeInTheDocument();
  });

  // --- Empty state: no search ---

  it('shows generic empty message when no search is active', () => {
    renderList([], '');
    expect(screen.getByText(/noch keine Maßnahmen geladen/)).toBeInTheDocument();
  });

  it('does not show generic message when search is active', () => {
    renderList([], 'abc');
    expect(screen.queryByText(/noch keine Maßnahmen geladen/)).toBeNull();
  });

  it('does not show query message when no search is active', () => {
    renderList([], '');
    expect(screen.queryByText(/Keine Ergebnisse für/)).toBeNull();
  });
});