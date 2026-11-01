import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import GraphView from './GraphView';
import { GraphState } from '../../../store/GraphSlice';

// Rendering WebGL is outside this view's responsibility. The canvas mock exposes
// selection events so the view's shared selection state can be checked.
let mockCanvasProps: any;
jest.mock('./GraphViewCanvas', () => (props: any) => {
  mockCanvasProps = props;
  return (
    <div data-testid="canvas" data-selected={props.selectedMeasureId ?? 'none'}>
      <button onClick={() => props.onSelectMeasure('m1')}>canvas-m1</button>
      <button onClick={() => props.onSelectMeasure(null)}>clear-selection</button>
    </div>
  );
});

jest.mock('../result-measure/compact-card/ResultMeasureCompactList', () => (props: any) => (
  <div data-testid="list" data-selected={props.selectedMeasureId ?? 'none'}>
    <button onClick={() => props.onSelectMeasure('m2')}>list-m2</button>
  </div>
));

jest.mock('../../../store/ResultSlice', () => {
  const { createSelector } = require('@reduxjs/toolkit');
  return {
    selectTopNMeasures: (n: number) => createSelector(
      [(state: any) => state.result.measures], (measures: any[]) => measures.slice(0, n),
    ),
  };
});

const MEASURES = Array.from({ length: 25 }, (_, index) => ({
  measure: { id: `m${index}`, title: `Measure ${index}` }, totalScore: 100 - index,
}));
const EDGES = [{ from: 'm1', to: 'm2', type: 'synergy' as const }];

function renderView(graph: GraphState = { edges: EDGES, status: 'succeeded', error: null }) {
  const store = configureStore({ reducer: {
    result: () => ({ measures: MEASURES }), graph: () => graph,
  } });
  return render(<Provider store={store}><GraphView /></Provider>);
}

describe('GraphView', () => {
  beforeEach(() => { mockCanvasProps = undefined; });

  it('renders the graph canvas after loading', () => {
    renderView();
    expect(screen.getByTestId('canvas')).toBeInTheDocument();
  });

  it('renders the compact measure list', () => {
    renderView();
    expect(screen.getByTestId('list')).toBeInTheDocument();
  });

  it('passes the first 20 ranked measures to the canvas', () => {
    renderView();
    expect(mockCanvasProps.measures).toEqual(MEASURES.slice(0, 20));
  });

  it('passes shared graph edges to the canvas', () => {
    renderView();
    expect(mockCanvasProps.edges).toEqual(EDGES);
  });

  it('starts without a selected canvas node', () => {
    renderView();
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-selected', 'none');
  });

  it('starts without a selected list item', () => {
    renderView();
    expect(screen.getByTestId('list')).toHaveAttribute('data-selected', 'none');
  });

  it('selects a canvas node', () => {
    renderView();
    fireEvent.click(screen.getByText('canvas-m1'));
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-selected', 'm1');
  });

  it('synchronises canvas selection to the list', () => {
    renderView();
    fireEvent.click(screen.getByText('canvas-m1'));
    expect(screen.getByTestId('list')).toHaveAttribute('data-selected', 'm1');
  });

  it('selects a list item', () => {
    renderView();
    fireEvent.click(screen.getByText('list-m2'));
    expect(screen.getByTestId('list')).toHaveAttribute('data-selected', 'm2');
  });

  it('synchronises list selection to the canvas', () => {
    renderView();
    fireEvent.click(screen.getByText('list-m2'));
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-selected', 'm2');
  });

  it('clears selection when the same canvas node is clicked again', () => {
    renderView();
    fireEvent.click(screen.getByText('canvas-m1'));
    fireEvent.click(screen.getByText('canvas-m1'));
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-selected', 'none');
    expect(screen.getByTestId('list')).toHaveAttribute('data-selected', 'none');
  });

  it('clears selection when the same list item is clicked again', () => {
    renderView();
    fireEvent.click(screen.getByText('list-m2'));
    fireEvent.click(screen.getByText('list-m2'));
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-selected', 'none');
    expect(screen.getByTestId('list')).toHaveAttribute('data-selected', 'none');
  });

  it('clears selection on an empty canvas click', () => {
    renderView();
    fireEvent.click(screen.getByText('list-m2'));
    fireEvent.click(screen.getByText('clear-selection'));
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-selected', 'none');
    expect(screen.getByTestId('list')).toHaveAttribute('data-selected', 'none');
  });

  it('shows loading feedback while the graph is loading', () => {
    renderView({ edges: [], status: 'loading', error: null });
    expect(screen.getByText('Lade Graphdaten...')).toBeInTheDocument();
    expect(screen.queryByTestId('canvas')).not.toBeInTheDocument();
  });

  it('shows loading feedback before the first graph request', () => {
    renderView({ edges: [], status: 'idle', error: null });
    expect(screen.getByText('Lade Graphdaten...')).toBeInTheDocument();
  });

  it('keeps the measure list usable while the graph loads', () => {
    renderView({ edges: [], status: 'loading', error: null });
    fireEvent.click(screen.getByText('list-m2'));
    expect(screen.getByTestId('list')).toHaveAttribute('data-selected', 'm2');
    expect(screen.getByText('Lade Graphdaten...')).toBeInTheDocument();
  });

  it('shows a failed graph request error', () => {
    renderView({ edges: [], status: 'failed', error: 'Graph nicht verfügbar' });
    expect(screen.getByText('Graph nicht verfügbar')).toBeInTheDocument();
    expect(screen.queryByTestId('canvas')).not.toBeInTheDocument();
  });

  it('keeps the measure list available when the graph request fails', () => {
    renderView({ edges: [], status: 'failed', error: 'offline' });
    expect(screen.getByTestId('list')).toBeInTheDocument();
  });

  it('renders the measure heading', () => {
    renderView();
    expect(screen.getByRole('heading', { name: 'Maßnahmen' })).toBeInTheDocument();
  });

  it('renders the relationship legend', () => {
    renderView();
    expect(screen.getByRole('heading', { name: 'Legende' })).toBeInTheDocument();
    expect(screen.getByText('Synergie')).toBeInTheDocument();
    expect(screen.getByText('Konflikt')).toBeInTheDocument();
    expect(screen.getByText('Beitrag')).toBeInTheDocument();
  });

  it('omits relationship types configured as hidden from the legend', () => {
    renderView();
    expect(screen.queryByText('Neutral')).not.toBeInTheDocument();
    expect(screen.queryByText('Abhängigkeit')).not.toBeInTheDocument();
    expect(screen.queryByText('Voraussetzung')).not.toBeInTheDocument();
  });

  it('renders the detail-button hint', () => {
    renderView();
    expect(screen.getByText(/Über das Info-Symbol öffnen Sie die Detailansicht/)).toBeInTheDocument();
  });

  it('replaces the canvas selection when a different list item is selected', () => {
    renderView();
    fireEvent.click(screen.getByText('canvas-m1'));
    fireEvent.click(screen.getByText('list-m2'));
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-selected', 'm2');
    expect(screen.getByTestId('list')).toHaveAttribute('data-selected', 'm2');
  });
});
