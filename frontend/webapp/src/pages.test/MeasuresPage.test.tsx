/**
 * MeasuresPage.test.tsx
 *
 * Unit tests for the MeasuresPage component covering:
 *  - Loading state (skeleton grid)
 *  - Error state (error banner + retry button)
 *  - Success state (search bar + measure list)
 *  - Retry logic (clearError + re-fetch)
 *  - Initial fetchMeasures dispatch on mount
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import MeasuresPage from '../../src/pages/MeasuresPage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../src/components/measures/MeasureSearch', () => () => (
  <div data-testid="measure-search" />
));

jest.mock('../../src/components/measures/MeasureList', () => () => (
  <div data-testid="measure-list" />
));

jest.mock('../../src/components/measures/MeasureSkeleton', () => ({
  MeasureSkeletonGrid: ({ count }: { count: number }) => (
    <div data-testid="skeleton-grid" data-count={count} />
  ),
}));

const mockFetchMeasures = jest.fn();
const mockClearError    = jest.fn();

jest.mock('../../src/store/MeasuresSlice', () => ({
  fetchMeasures:          () => mockFetchMeasures(),
  selectMeasuresLoading:  (state: any) => state.measures.loading,
  selectMeasuresError:    (state: any) => state.measures.error,
  clearError:             () => mockClearError(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildStore(measures: { loading: boolean; error: string | null }) {
  // Reset mocks to return plain action objects so dispatch() gets a valid value
  mockFetchMeasures.mockReturnValue({ type: 'measures/fetchMeasures' });
  mockClearError.mockReturnValue({ type: 'measures/clearError' });

  return configureStore({
    reducer: { measures: () => measures },
  });
}

function renderPage(measures: { loading: boolean; error: string | null }) {
  const store = buildStore(measures);
  return {
    ...render(
      <Provider store={store}>
        <MeasuresPage />
      </Provider>
    ),
    store,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MeasuresPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchMeasures.mockReturnValue({ type: 'measures/fetchMeasures' });
    mockClearError.mockReturnValue({ type: 'measures/clearError' });
  });

  // --- Mount behaviour -------------------------------------------------------

  it('dispatches fetchMeasures on mount', () => {
    renderPage({ loading: true, error: null });
    expect(mockFetchMeasures).toHaveBeenCalledTimes(1);
  });

  // --- Loading state ---------------------------------------------------------

  it('renders skeleton grid when loading is true', () => {
    renderPage({ loading: true, error: null });
    expect(screen.getByTestId('skeleton-grid')).toBeInTheDocument();
  });

  it('passes count={6} to MeasureSkeletonGrid', () => {
    renderPage({ loading: true, error: null });
    expect(screen.getByTestId('skeleton-grid')).toHaveAttribute('data-count', '6');
  });

  it('does NOT render MeasureSearch while loading', () => {
    renderPage({ loading: true, error: null });
    expect(screen.queryByTestId('measure-search')).not.toBeInTheDocument();
  });

  it('does NOT render MeasureList while loading', () => {
    renderPage({ loading: true, error: null });
    expect(screen.queryByTestId('measure-list')).not.toBeInTheDocument();
  });

  // --- Error state -----------------------------------------------------------

  it('renders error banner when error is set', () => {
    renderPage({ loading: false, error: 'Network error' });
    expect(screen.getByText('Fehler beim Laden der Maßnahmen')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('renders retry button in error state', () => {
    renderPage({ loading: false, error: 'oops' });
    expect(screen.getByText('Erneut versuchen')).toBeInTheDocument();
  });

  it('does NOT render skeleton in error state', () => {
    renderPage({ loading: false, error: 'oops' });
    expect(screen.queryByTestId('skeleton-grid')).not.toBeInTheDocument();
  });

  it('does NOT render MeasureSearch in error state', () => {
    renderPage({ loading: false, error: 'oops' });
    expect(screen.queryByTestId('measure-search')).not.toBeInTheDocument();
  });

  it('does NOT render MeasureList in error state', () => {
    renderPage({ loading: false, error: 'oops' });
    expect(screen.queryByTestId('measure-list')).not.toBeInTheDocument();
  });

  // --- Retry handler ---------------------------------------------------------

  it('dispatches clearError and fetchMeasures on retry click', () => {
    renderPage({ loading: false, error: 'oops' });
    fireEvent.click(screen.getByText('Erneut versuchen'));
    expect(mockClearError).toHaveBeenCalledTimes(1);
    expect(mockFetchMeasures).toHaveBeenCalledTimes(2); // 1 on mount + 1 on retry
  });

  // --- Success state ---------------------------------------------------------

  it('renders MeasureSearch in success state', () => {
    renderPage({ loading: false, error: null });
    expect(screen.getByTestId('measure-search')).toBeInTheDocument();
  });

  it('renders MeasureList in success state', () => {
    renderPage({ loading: false, error: null });
    expect(screen.getByTestId('measure-list')).toBeInTheDocument();
  });

  it('does NOT render error banner in success state', () => {
    renderPage({ loading: false, error: null });
    expect(screen.queryByText('Fehler beim Laden der Maßnahmen')).not.toBeInTheDocument();
  });

  // --- Static content --------------------------------------------------------

  it('renders page title', () => {
    renderPage({ loading: false, error: null });
    expect(screen.getByText('Klimaschutzmaßnahmen')).toBeInTheDocument();
  });

  it('renders page description', () => {
    renderPage({ loading: false, error: null });
    expect(screen.getByText(/Suchfunktion/)).toBeInTheDocument();
  });
});