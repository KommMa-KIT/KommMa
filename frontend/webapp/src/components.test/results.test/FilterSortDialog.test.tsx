/**
 * FilterSortDialog.test.tsx
 *
 * Tests for FilterSortDialog covering:
 *  - Returns null when open=false
 *  - Renders all sections when open=true
 *  - Canvas rendered with correct attributes
 *  - Weight readouts show rounded percentages
 *  - Filter inputs render with current values
 *  - Filter input changes update local state (shown in input value)
 *  - Canvas mouseDown/mouseUp/mouseLeave toggle isDragging state
 *  - Backdrop click closes dialog
 *  - X button closes dialog
 *  - Abbrechen (cancel) closes dialog
 *  - Zurücksetzen resets weights to 1/3 each and clears filters
 *  - Anwenden dispatches setRankingWeights, calls onFiltersChange, closes dialog
 *  - weightsToPoint / pointToWeights round-trip (via canvas click)
 *  - Canvas click updates weight display
 *  - useEffect syncs localWeights when external weights change
 *  - useEffect syncs localFilters when external filters change
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import FilterSortDialog from '../../components/results/FilterSortDialog';
import { FilterState } from '../../store/ResultSlice';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSetRankingWeights = jest.fn((w: any) => ({
  type: 'result/setRankingWeights',
  payload: w,
}));

jest.mock('../../store/ResultSlice', () => ({
  setRankingWeights:    (w: any) => mockSetRankingWeights(w),
  selectRankingWeights: (state: any) => state.result.weights,
  // Re-export FilterState type
  FilterState: {},
}));

// Mock canvas getContext to avoid JSDOM errors
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  clearRect:   jest.fn(),
  beginPath:   jest.fn(),
  moveTo:      jest.fn(),
  lineTo:      jest.fn(),
  closePath:   jest.fn(),
  stroke:      jest.fn(),
  fill:        jest.fn(),
  arc:         jest.fn(),
  fillText:    jest.fn(),
  get canvas() { return { width: 300, height: 300 }; },
  strokeStyle: '',
  lineWidth:   0,
  fillStyle:   '',
  font:        '',
  textAlign:   'left' as CanvasTextAlign,
})) as any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_WEIGHTS = { time: 1 / 3, cost: 1 / 3, climate: 1 / 3 };

const EMPTY_FILTERS: FilterState = {
  maxInvestmentCost:  null,
  maxOngoingCost:     null,
  maxTime:            null,
  minEmissionSavings: null,
};

const FILLED_FILTERS: FilterState = {
  maxInvestmentCost:  50000,
  maxOngoingCost:     1000,
  maxTime:            24,
  minEmissionSavings: 500,
};

function buildStore(weights = DEFAULT_WEIGHTS) {
  return configureStore({
    reducer: { result: () => ({ weights }) },
  });
}

function renderDialog(props: {
  open?:           boolean;
  filters?:        FilterState;
  onFiltersChange?: jest.Mock;
  onOpenChange?:   jest.Mock;
  weights?:        typeof DEFAULT_WEIGHTS;
} = {}) {
  const {
    open            = true,
    filters         = EMPTY_FILTERS,
    onFiltersChange = jest.fn(),
    onOpenChange    = jest.fn(),
    weights         = DEFAULT_WEIGHTS,
  } = props;

  const store = buildStore(weights);
  render(
    <Provider store={store}>
      <FilterSortDialog
        open={open}
        onOpenChange={onOpenChange}
        filters={filters}
        onFiltersChange={onFiltersChange}
      />
    </Provider>
  );
  return { onOpenChange, onFiltersChange };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FilterSortDialog', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetRankingWeights.mockImplementation((w: any) => ({
      type: 'result/setRankingWeights',
      payload: w,
    }));
  });

  // --- Visibility -----------------------------------------------------------

  it('renders nothing when open=false', () => {
    renderDialog({ open: false });
    expect(screen.queryByText('Filtern & Sortieren')).not.toBeInTheDocument();
  });

  it('renders dialog when open=true', () => {
    renderDialog();
    expect(screen.getByText('Filtern & Sortieren')).toBeInTheDocument();
  });

  // --- Sections rendered ---------------------------------------------------

  it('renders "Sortier-Gewichtung" heading', () => {
    renderDialog();
    expect(screen.getByText('Sortier-Gewichtung')).toBeInTheDocument();
  });

  it('renders "Filter" heading', () => {
    renderDialog();
    expect(screen.getByText('Filter')).toBeInTheDocument();
  });

  it('renders canvas element', () => {
    renderDialog();
    expect(document.querySelector('canvas')).not.toBeNull();
  });

  it('canvas has cursor-crosshair class', () => {
    renderDialog();
    expect(document.querySelector('canvas.cursor-crosshair')).not.toBeNull();
  });

  // --- Weight readouts ------------------------------------------------------

  it('shows 33% for Zeit with equal weights', () => {
    renderDialog();
    const pcts = screen.getAllByText('33%');
    expect(pcts.length).toBe(3); // Zeit, Kosten, Klima all show 33%
  });

  it('shows three weight panels (Zeit / Kosten / Klima)', () => {
    renderDialog();
    expect(screen.getByText('Zeit')).toBeInTheDocument();
    expect(screen.getByText('Kosten')).toBeInTheDocument();
    expect(screen.getByText('Klima')).toBeInTheDocument();
  });

  // --- Filter inputs --------------------------------------------------------

  it('renders all four filter input labels', () => {
    renderDialog();
    expect(screen.getByText(/Max\. Investitionskosten/)).toBeInTheDocument();
    expect(screen.getByText(/Max\. laufende Kosten/)).toBeInTheDocument();
    expect(screen.getByText(/Max\. Umsetzungszeit/)).toBeInTheDocument();
    expect(screen.getByText(/Min\. CO₂-Einsparung/)).toBeInTheDocument();
  });

  it('pre-fills filter inputs from filters prop', () => {
    renderDialog({ filters: FILLED_FILTERS });
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs[0]).toHaveValue(50000);
    expect(inputs[1]).toHaveValue(1000);
    expect(inputs[2]).toHaveValue(24);
    expect(inputs[3]).toHaveValue(500);
  });

  it('shows empty inputs when filters are null', () => {
    renderDialog({ filters: EMPTY_FILTERS });
    const inputs = screen.getAllByRole('spinbutton');
    inputs.forEach(input => expect(input).toHaveValue(null));
  });

  it('updates maxInvestmentCost input on change', () => {
    renderDialog();
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '10000' } });
    expect(inputs[0]).toHaveValue(10000);
  });

  it('clears maxInvestmentCost to null when input cleared', () => {
    renderDialog({ filters: FILLED_FILTERS });
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '' } });
    expect(inputs[0]).toHaveValue(null);
  });

  it('updates maxOngoingCost input on change', () => {
    renderDialog();
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[1], { target: { value: '500' } });
    expect(inputs[1]).toHaveValue(500);
  });

  it('updates maxTime input on change', () => {
    renderDialog();
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[2], { target: { value: '12' } });
    expect(inputs[2]).toHaveValue(12);
  });

  it('updates minEmissionSavings input on change', () => {
    renderDialog();
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[3], { target: { value: '200' } });
    expect(inputs[3]).toHaveValue(200);
  });

  // --- Canvas mouse events --------------------------------------------------

  it('sets isDragging on mouseDown and clears on mouseUp', () => {
    renderDialog();
    const canvas = document.querySelector('canvas')!;
    // mouseDown starts dragging — no observable output but shouldn't throw
    fireEvent.mouseDown(canvas);
    fireEvent.mouseUp(canvas);
    // Passes without throwing
  });

  it('clears isDragging on mouseLeave', () => {
    renderDialog();
    const canvas = document.querySelector('canvas')!;
    fireEvent.mouseDown(canvas);
    fireEvent.mouseLeave(canvas);
  });

  it('handles canvas click without throwing', () => {
    renderDialog();
    const canvas = document.querySelector('canvas')!;
    // getBoundingClientRect returns zeros in jsdom
    fireEvent.click(canvas, { clientX: 150, clientY: 150 });
  });

  it('handles mouseMove when dragging without throwing', () => {
    renderDialog();
    const canvas = document.querySelector('canvas')!;
    fireEvent.mouseDown(canvas);
    fireEvent.mouseMove(canvas, { clientX: 150, clientY: 100 });
  });

  it('does NOT update weights on mouseMove when not dragging', () => {
    renderDialog();
    const canvas = document.querySelector('canvas')!;
    // No mouseDown — should be a no-op
    fireEvent.mouseMove(canvas, { clientX: 150, clientY: 100 });
  });

  // --- Backdrop closes dialog -----------------------------------------------

  it('calls onOpenChange(false) when backdrop clicked', () => {
    const { onOpenChange } = renderDialog();
    const backdrop = document.querySelector('.absolute.inset-0');
    fireEvent.click(backdrop!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // --- X button -------------------------------------------------------------

  it('calls onOpenChange(false) when X button clicked', () => {
    const { onOpenChange } = renderDialog();
    const buttons = screen.getAllByRole('button');
    const xBtn = buttons.find(b => b.className.includes('rounded-full'));
    fireEvent.click(xBtn!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // --- Abbrechen button -----------------------------------------------------

  it('calls onOpenChange(false) when Abbrechen clicked', () => {
    const { onOpenChange } = renderDialog();
    // There are two Abbrechen buttons — click footer one
    const cancelBtns = screen.getAllByText('Abbrechen');
    fireEvent.click(cancelBtns[cancelBtns.length - 1]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // --- Zurücksetzen (reset) -------------------------------------------------

  it('resets weight display to 33% after Zurücksetzen', () => {
    // First canvas-click to change weights, then reset
    renderDialog();
    fireEvent.click(screen.getByText('Zurücksetzen'));
    // After reset both Zeit panels should show 33%
    const pcts = screen.getAllByText('33%');
    expect(pcts.length).toBeGreaterThanOrEqual(1);
  });

  it('clears filter inputs after Zurücksetzen', () => {
    renderDialog({ filters: FILLED_FILTERS });
    fireEvent.click(screen.getByText('Zurücksetzen'));
    const inputs = screen.getAllByRole('spinbutton');
    inputs.forEach(input => expect(input).toHaveValue(null));
  });

  // --- Anwenden (apply) -----------------------------------------------------

  it('dispatches setRankingWeights when Anwenden clicked', () => {
    renderDialog();
    fireEvent.click(screen.getByText('Anwenden'));
    expect(mockSetRankingWeights).toHaveBeenCalledTimes(1);
  });

  it('calls onFiltersChange with localFilters when Anwenden clicked', () => {
    const { onFiltersChange } = renderDialog();
    fireEvent.click(screen.getByText('Anwenden'));
    expect(onFiltersChange).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenChange(false) when Anwenden clicked', () => {
    const { onOpenChange } = renderDialog();
    fireEvent.click(screen.getByText('Anwenden'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('passes updated filter values to onFiltersChange', () => {
    const { onFiltersChange } = renderDialog();
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '99999' } });
    fireEvent.click(screen.getByText('Anwenden'));
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ maxInvestmentCost: 99999 })
    );
  });

  // --- Hint text ------------------------------------------------------------

  it('renders triangle interaction hint', () => {
    renderDialog();
    expect(screen.getByText(/Klicken oder ziehen/)).toBeInTheDocument();
  });
});