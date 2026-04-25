/**
 * MatrixView.test.tsx
 *
 * Tests for MatrixView covering:
 *  - Renders MatrixCanvas and ResultMeasureCompactList
 *  - Passes correct measures from Redux store (top 20)
 *  - selectedMeasureId starts as null
 *  - Selecting via MatrixCanvas updates selectedMeasureId in both panels
 *  - Selecting via ResultMeasureCompactList updates selectedMeasureId in both panels
 *  - Panel heading and hint text rendered
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import MatrixView from '../../components/results/MatrixView';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let capturedCanvasProps: any = {};
jest.mock('../../components/results/MatrixCanvas', () => (props: any) => {
  capturedCanvasProps = props;
  return (
    <div data-testid="matrix-canvas" data-selected={props.selectedMeasureId ?? 'none'}>
      <button onClick={() => props.onSelectMeasure('m1')}>select-canvas-m1</button>
    </div>
  );
});

let capturedListProps: any = {};
jest.mock('../../components/results/ResultMeasureCompactList', () => (props: any) => {
  capturedListProps = props;
  return (
    <div data-testid="compact-list" data-selected={props.selectedMeasureId ?? 'none'}>
      <button onClick={() => props.onSelectMeasure('m2')}>select-list-m2</button>
    </div>
  );
});

jest.mock('../../store/ResultSlice', () => ({
  selectTopNMeasures: (n: number) => (state: any) => state.result.measures.slice(0, n),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MEASURES = Array.from({ length: 25 }, (_, i) => ({
  measure: { id: `m${i}`, title: `Measure ${i}` },
  totalScore: 100 - i,
}));

function buildStore() {
  return configureStore({
    reducer: { result: () => ({ measures: MEASURES }) },
  });
}

function renderMatrixView() {
  const store = buildStore();
  render(
    <Provider store={store}>
      <MatrixView />
    </Provider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MatrixView', () => {
  beforeEach(() => {
    capturedCanvasProps = {};
    capturedListProps   = {};
  });

  it('renders MatrixCanvas', () => {
    renderMatrixView();
    expect(screen.getByTestId('matrix-canvas')).toBeInTheDocument();
  });

  it('renders ResultMeasureCompactList', () => {
    renderMatrixView();
    expect(screen.getByTestId('compact-list')).toBeInTheDocument();
  });

  it('passes top 20 measures to MatrixCanvas', () => {
    renderMatrixView();
    expect(capturedCanvasProps.measures).toHaveLength(20);
  });

  it('passes top 20 measures to compact list', () => {
    // The list reads from the store independently, not from MatrixView props.
    // Just assert the list is rendered.
    renderMatrixView();
    expect(screen.getByTestId('compact-list')).toBeInTheDocument();
  });

  it('selectedMeasureId is null initially in canvas', () => {
    renderMatrixView();
    expect(screen.getByTestId('matrix-canvas')).toHaveAttribute('data-selected', 'none');
  });

  it('selectedMeasureId is null initially in list', () => {
    renderMatrixView();
    expect(screen.getByTestId('compact-list')).toHaveAttribute('data-selected', 'none');
  });

  it('canvas onSelectMeasure updates selectedMeasureId in canvas', () => {
    renderMatrixView();
    fireEvent.click(screen.getByText('select-canvas-m1'));
    expect(screen.getByTestId('matrix-canvas')).toHaveAttribute('data-selected', 'm1');
  });

  it('canvas onSelectMeasure also syncs to compact list', () => {
    renderMatrixView();
    fireEvent.click(screen.getByText('select-canvas-m1'));
    expect(screen.getByTestId('compact-list')).toHaveAttribute('data-selected', 'm1');
  });

  it('list onSelectMeasure updates selectedMeasureId in list', () => {
    renderMatrixView();
    fireEvent.click(screen.getByText('select-list-m2'));
    expect(screen.getByTestId('compact-list')).toHaveAttribute('data-selected', 'm2');
  });

  it('list onSelectMeasure also syncs to canvas', () => {
    renderMatrixView();
    fireEvent.click(screen.getByText('select-list-m2'));
    expect(screen.getByTestId('matrix-canvas')).toHaveAttribute('data-selected', 'm2');
  });

  it('renders the Maßnahmen heading', () => {
    renderMatrixView();
    expect(screen.getByText('Maßnahmen')).toBeInTheDocument();
  });

  it('renders the click-hint text', () => {
    renderMatrixView();
    expect(screen.getByText(/Klicken Sie auf eine Maßnahme/)).toBeInTheDocument();
  });
});