/**
 * ResultPage.test.tsx
 *
 * Unit tests for the ResultPage component covering:
 *  - Loading state (skeleton list)
 *  - Error state (error banner, no content)
 *  - Success state (tabs, default overview view)
 *  - Tab switching (Overview / List / Matrix / Graph)
 *  - Filter & Sort button (disabled without results, opens dialog)
 *  - Export button (disabled without results, opens dialog)
 *  - IndividualisationProgressBar only shown when results exist
 *  - fetchMeasures dispatch on mount
 *  - Export PDF and CSV handlers
 *  - Filter change handler
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import ResultPage from '../../src/pages/ResultPage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../src/components/results/ResultMeasureSkeleton', () => ({
  ResultMeasureSkeletonList: ({ count }: { count: number }) => (
    <div data-testid="skeleton-list" data-count={count} />
  ),
}));

jest.mock('../../src/components/results/IndividualisationProgressBar', () => (
  ({ score }: { score: number }) => (
    <div data-testid="individualisation-bar" data-score={score} />
  )
));

jest.mock('../../src/components/results/FilterSortDialog', () => (
  ({ open, onOpenChange, onFiltersChange }: any) =>
    open ? (
      <div data-testid="filter-dialog">
        <button onClick={() => onOpenChange(false)}>close-filter</button>
        <button onClick={() => onFiltersChange({ sort: 'cost' })}>apply-filter</button>
      </div>
    ) : null
));

jest.mock('../../src/components/results/ExportDialog', () => (
  ({ open, onOpenChange, onExportPDF, onExportCSV }: any) =>
    open ? (
      <div data-testid="export-dialog">
        <button onClick={() => onOpenChange(false)}>close-export</button>
        <button onClick={onExportPDF}>export-pdf</button>
        <button onClick={onExportCSV}>export-csv</button>
      </div>
    ) : null
));

jest.mock('../../src/components/results/Overview',   () => () => <div data-testid="overview-view" />);
jest.mock('../../src/components/results/ListView',   () => () => <div data-testid="list-view" />);
jest.mock('../../src/components/results/GraphView',  () => () => <div data-testid="graph-view" />);
jest.mock('../../src/components/results/MatrixView', () => () => <div data-testid="matrix-view" />);
jest.mock('../../src/components/GraphInitializer',   () => () => <div data-testid="graph-init" />);
jest.mock('../../src/components/Button',             () =>
  ({ children, onClick, disabled, className }: any) => (
    <button onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  )
);

// Declare BEFORE jest.mock() calls that reference them so hoisting works correctly
const mockExportPDF = jest.fn();
const mockExportCSV = jest.fn();

jest.mock('../../src/services/ExportService', () => ({
  __esModule: true,
  default: {
    exportPDF: (...args: any[]) => mockExportPDF(...args),
    exportCSV: (...args: any[]) => mockExportCSV(...args),
  },
}));

const mockFetchGraph = jest.fn().mockResolvedValue([]);
jest.mock('../../src/services/GraphService', () => ({
  __esModule: true,
  default: {
    fetchGraph: (...args: any[]) => mockFetchGraph(...args),
  },
}));

const mockFetchMeasures = jest.fn();
const mockSetFilters    = jest.fn();

jest.mock('../../src/store/MeasuresSlice', () => ({
  fetchMeasures:         () => mockFetchMeasures(),
  selectMeasuresLoading: (state: any) => state.measures.loading,
}));

jest.mock('../../src/store/ResultSlice', () => ({
  selectRankedMeasures:      (state: any) => state.result.rankedMeasures,
  selectIndividualismLevels: (state: any) => state.result.individualismLevels,
  selectResultsLoading:      (state: any) => state.result.loading,
  selectResultsError:        (state: any) => state.result.error,
  selectFilters:             (state: any) => state.result.filters,
  selectVisibleMeasures:     (state: any) => state.result.visibleMeasures,
  setFilters:                (f: any) => mockSetFilters(f),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MEASURE = { id: '1', title: 'Test Measure' };

function buildStore(overrides: {
  loading?: boolean;
  error?: string | null;
  measures?: any[];
  measuresLoading?: boolean;
}) {
  const {
    loading = false,
    error = null,
    measures = [],
    measuresLoading = false,
  } = overrides;

  return configureStore({
    reducer: {
      measures: () => ({ loading: measuresLoading }),
      result: () => ({
        rankedMeasures:      measures,
        individualismLevels: { total: 42 },
        loading,
        error,
        filters:             {},
        visibleMeasures:     measures.map((m, i) => ({ ...m, rank: i + 1 })),
      }),
    },
  });
}

function renderPage(overrides: Parameters<typeof buildStore>[0] = {}) {
  const store = buildStore(overrides);
  return {
    ...render(
      <MemoryRouter>
        <Provider store={store}>
          <ResultPage />
        </Provider>
      </MemoryRouter>
    ),
    store,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ResultPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchMeasures.mockReturnValue({ type: 'measures/fetchMeasures' });
    mockSetFilters.mockImplementation((f: any) => ({ type: 'result/setFilters', payload: f }));
  });

  // --- Mount ----------------------------------------------------------------

  it('dispatches fetchMeasures on mount', () => {
    renderPage();
    expect(mockFetchMeasures).toHaveBeenCalledTimes(1);
  });

  it('renders GraphInitializer', () => {
    renderPage();
    expect(screen.getByTestId('graph-init')).toBeInTheDocument();
  });

  // --- Loading state --------------------------------------------------------

  it('renders skeleton list while loading', () => {
    renderPage({ loading: true });
    expect(screen.getByTestId('skeleton-list')).toBeInTheDocument();
  });

  it('passes count={3} to skeleton list', () => {
    renderPage({ loading: true });
    expect(screen.getByTestId('skeleton-list')).toHaveAttribute('data-count', '3');
  });

  it('does NOT render tabs while loading', () => {
    renderPage({ loading: true });
    expect(screen.queryByText('Übersicht')).not.toBeInTheDocument();
  });

  // --- Error state ----------------------------------------------------------

  it('renders error banner when error is set', () => {
    renderPage({ error: 'calc failed' });
    expect(screen.getByText('calc failed')).toBeInTheDocument();
    expect(screen.getByText(/Fehler beim Laden/)).toBeInTheDocument();
  });

  it('does NOT render content in error state', () => {
    renderPage({ error: 'oops' });
    expect(screen.queryByTestId('overview-view')).not.toBeInTheDocument();
  });

  // --- Success state — no results -------------------------------------------

  it('Filter button is disabled when no results', () => {
    renderPage({ measures: [] });
    expect(screen.getByText(/Filtern/)).toBeDisabled();
  });

  it('Export button is disabled when no results', () => {
    renderPage({ measures: [] });
    expect(screen.getByText(/Exportieren/)).toBeDisabled();
  });

  it('does NOT render tabs when no results', () => {
    renderPage({ measures: [] });
    expect(screen.queryByText('Übersicht')).not.toBeInTheDocument();
  });

  it('does NOT render progress bar when no results', () => {
    renderPage({ measures: [] });
    expect(screen.queryByTestId('individualisation-bar')).not.toBeInTheDocument();
  });

  // --- Success state — with results -----------------------------------------

  it('renders tabs when results exist', () => {
    renderPage({ measures: [MEASURE] });
    expect(screen.getByText('Übersicht')).toBeInTheDocument();
    expect(screen.getByText('Liste')).toBeInTheDocument();
    expect(screen.getByText('Matrix')).toBeInTheDocument();
    expect(screen.getByText('Beziehungen')).toBeInTheDocument();
  });

  it('renders IndividualisationProgressBar with score', () => {
    renderPage({ measures: [MEASURE] });
    expect(screen.getByTestId('individualisation-bar')).toHaveAttribute('data-score', '42');
  });

  it('renders overview view by default', () => {
    renderPage({ measures: [MEASURE] });
    expect(screen.getByTestId('overview-view')).toBeInTheDocument();
  });

  it('Filter button is enabled when results exist', () => {
    renderPage({ measures: [MEASURE] });
    expect(screen.getByText(/Filtern/)).not.toBeDisabled();
  });

  it('Export button is enabled when results exist', () => {
    renderPage({ measures: [MEASURE] });
    expect(screen.getByText(/Exportieren/)).not.toBeDisabled();
  });

  // --- Tab switching --------------------------------------------------------

  it('switches to list view on "Liste" tab click', () => {
    renderPage({ measures: [MEASURE] });
    fireEvent.click(screen.getByText('Liste'));
    expect(screen.getByTestId('list-view')).toBeInTheDocument();
    expect(screen.queryByTestId('overview-view')).not.toBeInTheDocument();
  });

  it('switches to matrix view on "Matrix" tab click', () => {
    renderPage({ measures: [MEASURE] });
    fireEvent.click(screen.getByText('Matrix'));
    expect(screen.getByTestId('matrix-view')).toBeInTheDocument();
  });

  it('switches to graph view on "Beziehungen" tab click', () => {
    renderPage({ measures: [MEASURE] });
    fireEvent.click(screen.getByText('Beziehungen'));
    expect(screen.getByTestId('graph-view')).toBeInTheDocument();
  });

  // --- Filter dialog --------------------------------------------------------

  it('opens filter dialog on button click', () => {
    renderPage({ measures: [MEASURE] });
    fireEvent.click(screen.getByText(/Filtern/));
    expect(screen.getByTestId('filter-dialog')).toBeInTheDocument();
  });

  it('closes filter dialog on close action', () => {
    renderPage({ measures: [MEASURE] });
    fireEvent.click(screen.getByText(/Filtern/));
    fireEvent.click(screen.getByText('close-filter'));
    expect(screen.queryByTestId('filter-dialog')).not.toBeInTheDocument();
  });

  it('dispatches setFilters when filter applied', () => {
    renderPage({ measures: [MEASURE] });
    fireEvent.click(screen.getByText(/Filtern/));
    fireEvent.click(screen.getByText('apply-filter'));
    expect(mockSetFilters).toHaveBeenCalledWith({ sort: 'cost' });
  });

  // --- Export dialog --------------------------------------------------------

  it('opens export dialog on button click', () => {
    renderPage({ measures: [MEASURE] });
    fireEvent.click(screen.getByText(/Exportieren/));
    expect(screen.getByTestId('export-dialog')).toBeInTheDocument();
  });

  it('closes export dialog on close action', () => {
    renderPage({ measures: [MEASURE] });
    fireEvent.click(screen.getByText(/Exportieren/));
    fireEvent.click(screen.getByText('close-export'));
    expect(screen.queryByTestId('export-dialog')).not.toBeInTheDocument();
  });

  it('calls exportCSV on CSV export button click', () => {
    renderPage({ measures: [MEASURE] });
    fireEvent.click(screen.getByText(/Exportieren/));
    fireEvent.click(screen.getByText('export-csv'));
    expect(mockExportCSV).toHaveBeenCalledTimes(1);
  });

  it('calls exportPDF after fetching graph on PDF export', async () => {
    renderPage({ measures: [MEASURE] });
    fireEvent.click(screen.getByText(/Exportieren/));
    fireEvent.click(screen.getByText('export-pdf'));
    await waitFor(() => {
      expect(mockFetchGraph).toHaveBeenCalledTimes(1);
      expect(mockExportPDF).toHaveBeenCalledTimes(1);
    });
  });

  it('calls exportPDF without edges when graph fetch fails', async () => {
    mockFetchGraph.mockRejectedValueOnce(new Error('graph error'));
    renderPage({ measures: [MEASURE] });
    fireEvent.click(screen.getByText(/Exportieren/));
    fireEvent.click(screen.getByText('export-pdf'));
    await waitFor(() => {
      expect(mockExportPDF).toHaveBeenCalledTimes(1);
      const args = mockExportPDF.mock.calls[0];
      expect(args.length).toBe(1);
    });
  });

  // --- Static content -------------------------------------------------------

  it('renders page title', () => {
    renderPage();
    expect(
      screen.getByText('Ihre personalisierten Empfehlungen')
    ).toBeInTheDocument();
  });
});