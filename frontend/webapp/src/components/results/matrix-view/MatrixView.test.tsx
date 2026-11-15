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
import MatrixView from './MatrixView';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let capturedCanvasProps: any = {};
jest.mock('./MatrixCanvas', () => (props: any) => {
  capturedCanvasProps = props;
  return (
    <div data-testid="matrix-canvas" data-selected={props.selectedMeasureId ?? 'none'}>
      <button onClick={() => props.onSelectMeasure('m1')}>select-canvas-m1</button>
    </div>
  );
});

let capturedListProps: any = {};
jest.mock('../result-measure/compact-card/ResultMeasureCompactList', () => (props: any) => {
  capturedListProps = props;
  return (
    <div data-testid="compact-list" data-selected={props.selectedMeasureId ?? 'none'}>
      <button onClick={() => props.onSelectMeasure('m2')}>select-list-m2</button>
    </div>
  );
});

jest.mock('../../../store/ResultSlice', () => {
  const { createSelector } = require('@reduxjs/toolkit');
  return {
    selectTopNMeasures: (n: number) => createSelector(
      [(state: any) => state.result.measures], (measures: any[]) => measures.slice(0, n),
    ),
  };
});

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

  it('clears selection in both panels when the selected list item is clicked again', () => {
    renderMatrixView();
    fireEvent.click(screen.getByText('select-list-m2'));
    fireEvent.click(screen.getByText('select-list-m2'));
    expect(screen.getByTestId('compact-list')).toHaveAttribute('data-selected', 'none');
    expect(screen.getByTestId('matrix-canvas')).toHaveAttribute('data-selected', 'none');
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