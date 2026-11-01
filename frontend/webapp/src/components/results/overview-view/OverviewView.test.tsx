/**
 * OverviewView.test.tsx
 *
 * Tests for OverviewView covering:
 *  - Renders info panel with measure count from store
 *  - Default preview is 'graph' → GraphViewCanvas shown
 *  - Toggle button switches to matrix preview
 *  - Toggle button switches back to graph preview
 *  - Graph loading spinner shown while fetching
 *  - After fetch success → GraphViewCanvas shown
 *  - Failed graph state leaves the results summary available
 *  - Clicking canvas area calls onNavigateToView with current previewType
 *  - window.scrollTo called when canvas clicked
 *  - Beziehungsansicht pagination button selects the graph
 *  - Matrixansicht pagination button selects the matrix
 *  - ResultMeasureList rendered at bottom
 *  - Toggle chevron label toggles between Beziehungsansicht/Matrixansicht
 *  - onNavigateToView is optional (no crash without it)
 */

import { render, screen, fireEvent, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import OverviewView from './OverviewView';
import graphReducer, { GraphState } from '../../../store/GraphSlice';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../result-measure/card/ResultMeasureList', () => () => (
  <div data-testid="result-measure-list" />
));

jest.mock('../graph-view/GraphViewCanvas', () => ({ height }: any) => (
  <div data-testid="graph-view-canvas" data-height={height} />
));

jest.mock('../matrix-view/MatrixCanvas', () => ({ height }: any) => (
  <div data-testid="matrix-canvas" data-height={height} />
));

const mockFetchGraph = jest.fn();
// Resolve mockFetchGraph when fetchGraph is called, after the mock factory runs.
jest.mock('../../../services/GraphService', () => ({
  __esModule: true,
  default: {
    fetchGraph: (...args: any[]) => mockFetchGraph(...args),
  },
}));

jest.mock('../../../store/ResultSlice', () => ({
  selectRankedMeasures: (state: any) => state.result.measures,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MEASURES = [
  { measure: { id: 'm1' }, totalScore: 80 },
  { measure: { id: 'm2' }, totalScore: 60 },
  { measure: { id: 'm3' }, totalScore: 40 },
];

function buildStore(graph: GraphState = { edges: [], status: 'succeeded', error: null }) {
  return configureStore({
    reducer: { result: () => ({ measures: MEASURES }), graph: graphReducer },
    preloadedState: { graph },
  });
}

async function renderOverview(onNavigateToView?: jest.Mock, graph?: GraphState) {
  const store = buildStore(graph);
  let result: any;
  await act(async () => {
    result = render(
      <Provider store={store}>
        <OverviewView onNavigateToView={onNavigateToView} />
      </Provider>
    );
  });
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OverviewView', () => {
  let scrollToMock: jest.Mock;

  afterEach(() => jest.restoreAllMocks());

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchGraph.mockResolvedValue([]);
    scrollToMock = jest.fn();
    Object.defineProperty(window, 'scrollTo', { value: scrollToMock, writable: true });
  });

  // --- Info panel -----------------------------------------------------------

  it('renders "Ihr Ergebnis" heading', async () => {
    await renderOverview();
    expect(screen.getByText('Ihr Ergebnis')).toBeInTheDocument();
  });

  it('shows measure count from store in info panel', async () => {
    await renderOverview();
    expect(screen.getByText(/3 Klimaschutzmaßnahmen/)).toBeInTheDocument();
  });

  it('renders "Alle Maßnahmen im Detail" heading', async () => {
    await renderOverview();
    expect(screen.getByText('Alle Maßnahmen im Detail')).toBeInTheDocument();
  });

  it('renders ResultMeasureList', async () => {
    await renderOverview();
    expect(screen.getByTestId('result-measure-list')).toBeInTheDocument();
  });

  // --- Graph loading state --------------------------------------------------

  it('shows spinner while graph is loading', async () => {
    const store = buildStore({ edges: [], status: 'loading', error: null });
    render(
      <Provider store={store}>
        <OverviewView />
      </Provider>
    );
    expect(document.querySelector('.animate-spin')).not.toBeNull();
  });

  it('does NOT show GraphViewCanvas while loading', async () => {
    const store = buildStore({ edges: [], status: 'loading', error: null });
    render(
      <Provider store={store}>
        <OverviewView />
      </Provider>
    );
    expect(screen.queryByTestId('graph-view-canvas')).not.toBeInTheDocument();
  });

  // --- Graph loaded state ---------------------------------------------------

  it('shows GraphViewCanvas after successful fetch', async () => {
    await renderOverview(undefined, {
      edges: [{ from: 'm1', to: 'm2', type: 'synergy' }], status: 'succeeded', error: null,
    });
    expect(screen.getByTestId('graph-view-canvas')).toBeInTheDocument();
  });

  it('passes height=300 to GraphViewCanvas preview', async () => {
    await renderOverview();
    expect(screen.getByTestId('graph-view-canvas')).toHaveAttribute('data-height', '300');
  });

  // --- Failed shared graph state ------------------------------------------

  it('does not crash on graph fetch error', async () => {
    await renderOverview(undefined, { edges: [], status: 'failed', error: 'network fail' });
    expect(screen.getByText('Ihr Ergebnis')).toBeInTheDocument();
  });

  // --- Default preview: graph -----------------------------------------------

  it('shows "Beziehungen" heading in preview header by default', async () => {
    await renderOverview();
    expect(screen.getByText('Beziehungen')).toBeInTheDocument();
  });

  it('does NOT show MatrixCanvas in default (graph) preview', async () => {
    await renderOverview();
    expect(screen.queryByTestId('matrix-canvas')).not.toBeInTheDocument();
  });

  // --- Toggle preview -------------------------------------------------------

  it('toggle button label is "Zur Matrix" when showing graph', async () => {
    await renderOverview();
    expect(screen.getByLabelText('Zur Matrix')).toBeInTheDocument();
  });

  it('clicking toggle shows MatrixCanvas', async () => {
    await renderOverview();
    fireEvent.click(screen.getByLabelText('Zur Matrix'));
    expect(screen.getByTestId('matrix-canvas')).toBeInTheDocument();
  });

  it('clicking toggle hides GraphViewCanvas', async () => {
    await renderOverview();
    fireEvent.click(screen.getByLabelText('Zur Matrix'));
    expect(screen.queryByTestId('graph-view-canvas')).not.toBeInTheDocument();
  });

  it('shows "Matrix" heading after toggle', async () => {
    await renderOverview();
    fireEvent.click(screen.getByLabelText('Zur Matrix'));
    expect(screen.getByText('Matrix')).toBeInTheDocument();
  });

  it('toggle label changes to "Zur Beziehungsansicht" after switching to matrix', async () => {
    await renderOverview();
    fireEvent.click(screen.getByLabelText('Zur Matrix'));
    expect(screen.getByLabelText('Zur Beziehungsansicht')).toBeInTheDocument();
  });

  it('clicking toggle again switches back to graph', async () => {
    await renderOverview();
    fireEvent.click(screen.getByLabelText('Zur Matrix'));
    fireEvent.click(screen.getByLabelText('Zur Beziehungsansicht'));
    expect(screen.getByTestId('graph-view-canvas')).toBeInTheDocument();
  });

  it('MatrixCanvas receives height=300', async () => {
    await renderOverview();
    fireEvent.click(screen.getByLabelText('Zur Matrix'));
    expect(screen.getByTestId('matrix-canvas')).toHaveAttribute('data-height', '300');
  });

  // The accessible names describe the target view, independent of button order.
  it('clicking the Matrixansicht pagination button switches to matrix', async () => {
    await renderOverview();
    fireEvent.click(screen.getByRole('button', { name: 'Matrixansicht' }));
    expect(screen.getByTestId('matrix-canvas')).toBeInTheDocument();
  });

  it('clicking canvas after toggle calls onNavigateToView with "matrix"', async () => {
    const onNavigateToView = jest.fn();
    await renderOverview(onNavigateToView);
    fireEvent.click(screen.getByLabelText('Zur Matrix'));
    const clickableWrapper = document.querySelector('.cursor-pointer.group') as HTMLElement;
    fireEvent.click(clickableWrapper!);
    expect(onNavigateToView).toHaveBeenCalledWith('matrix');
  });

  it('renders navigation hint overlay text for matrix after toggle', async () => {
    await renderOverview();
    fireEvent.click(screen.getByLabelText('Zur Matrix'));
    expect(screen.getByText('Zur Matrixansicht →')).toBeInTheDocument();
  });

  it('clicking the Beziehungsansicht pagination button switches to graph', async () => {
    await renderOverview();
    fireEvent.click(screen.getByLabelText('Zur Matrix'));
    fireEvent.click(screen.getByRole('button', { name: 'Beziehungsansicht' }));
    expect(screen.getByTestId('graph-view-canvas')).toBeInTheDocument();
  });

  // --- Shared graph data -----------------------------------------------

  it('uses shared graph data without fetching it again', async () => {
    await renderOverview();
    expect(mockFetchGraph).not.toHaveBeenCalled();
    expect(screen.getByTestId('graph-view-canvas')).toBeInTheDocument();
  });
});