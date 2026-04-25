/**
 * IndividualisationProgressBar.test.tsx
 *
 * Tests for IndividualisationProgressBar covering:
 *  - Percentage display for various scores
 *  - Green / yellow / red colour classes at the correct thresholds
 *  - Progress bar width matches percentage
 *  - Info button only shown when levels prop provided
 *  - Info button opens IndividualisationDetailPopup
 *  - IndividualisationDetailPopup not rendered when levels absent
 *  - Caption text always rendered
 */

import { render, screen, fireEvent } from '@testing-library/react';
import IndividualisationProgressBar from '../../components/results/IndividualisationProgressBar';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../components/results/IndividualisationDetailPopup', () =>
  ({ open, onOpenChange, levels }: any) =>
    open ? (
      <div data-testid="detail-popup">
        <button onClick={() => onOpenChange(false)}>close-popup</button>
        <span data-testid="popup-total">{levels.total}</span>
      </div>
    ) : null
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LEVELS = {
  general:  0.8,
  energy:   0.6,
  mobility: 0.5,
  water:    0.9,
  total:    0.7,
};

function renderBar(score: number, levels?: typeof LEVELS) {
  return render(<IndividualisationProgressBar score={score} levels={levels} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IndividualisationProgressBar', () => {

  // --- Percentage display ---------------------------------------------------

  it('shows 70% for score=0.7', () => {
    renderBar(0.7);
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('shows 0% for score=0', () => {
    renderBar(0);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows 100% for score=1', () => {
    renderBar(1);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('rounds score correctly (0.456 → 46%)', () => {
    renderBar(0.456);
    expect(screen.getByText('46%')).toBeInTheDocument();
  });

  // --- Colour thresholds — progress fill ------------------------------------

  it('uses green fill for score >= 0.7', () => {
    renderBar(0.7);
    const fill = document.querySelector('.bg-green-500');
    expect(fill).not.toBeNull();
  });

  it('uses yellow fill for score >= 0.4 and < 0.7', () => {
    renderBar(0.5);
    const fill = document.querySelector('.bg-yellow-500');
    expect(fill).not.toBeNull();
  });

  it('uses red fill for score < 0.4', () => {
    renderBar(0.3);
    const fill = document.querySelector('.bg-red-500');
    expect(fill).not.toBeNull();
  });

  it('uses green fill at exact boundary 0.7', () => {
    renderBar(0.7);
    expect(document.querySelector('.bg-green-500')).not.toBeNull();
  });

  it('uses yellow fill at exact boundary 0.4', () => {
    renderBar(0.4);
    expect(document.querySelector('.bg-yellow-500')).not.toBeNull();
  });

  // --- Colour thresholds — percentage text ----------------------------------

  it('percentage text is green for score >= 0.7', () => {
    renderBar(0.7);
    expect(document.querySelector('.text-green-700')).not.toBeNull();
  });

  it('percentage text is yellow for score in [0.4, 0.7)', () => {
    renderBar(0.5);
    expect(document.querySelector('.text-yellow-700')).not.toBeNull();
  });

  it('percentage text is red for score < 0.4', () => {
    renderBar(0.2);
    expect(document.querySelector('.text-red-700')).not.toBeNull();
  });

  // --- Progress bar width ---------------------------------------------------

  it('progress bar fill has correct width style', () => {
    renderBar(0.6);
    const fill = document.querySelector('.bg-yellow-500') as HTMLElement;
    expect(fill?.style.width).toBe('60%');
  });

  it('progress bar fill is 100% for score=1', () => {
    renderBar(1);
    const fill = document.querySelector('.bg-green-500') as HTMLElement;
    expect(fill?.style.width).toBe('100%');
  });

  // --- Info button ----------------------------------------------------------

  it('does NOT render info button when levels is undefined', () => {
    renderBar(0.5);
    expect(screen.queryByTitle('Details anzeigen')).not.toBeInTheDocument();
  });

  it('renders info button when levels prop is provided', () => {
    renderBar(0.5, LEVELS);
    expect(screen.getByTitle('Details anzeigen')).toBeInTheDocument();
  });

  // --- Detail popup ---------------------------------------------------------

  it('popup is closed by default', () => {
    renderBar(0.5, LEVELS);
    expect(screen.queryByTestId('detail-popup')).not.toBeInTheDocument();
  });

  it('opens detail popup when info button clicked', () => {
    renderBar(0.5, LEVELS);
    fireEvent.click(screen.getByTitle('Details anzeigen'));
    expect(screen.getByTestId('detail-popup')).toBeInTheDocument();
  });

  it('passes levels to detail popup', () => {
    renderBar(0.5, LEVELS);
    fireEvent.click(screen.getByTitle('Details anzeigen'));
    expect(screen.getByTestId('popup-total')).toHaveTextContent('0.7');
  });

  it('closes popup via onOpenChange callback', () => {
    renderBar(0.5, LEVELS);
    fireEvent.click(screen.getByTitle('Details anzeigen'));
    fireEvent.click(screen.getByText('close-popup'));
    expect(screen.queryByTestId('detail-popup')).not.toBeInTheDocument();
  });

  it('does NOT render IndividualisationDetailPopup when levels absent', () => {
    renderBar(0.5, undefined);
    // Even in closed state the popup is not mounted without levels
    expect(screen.queryByTestId('detail-popup')).not.toBeInTheDocument();
  });

  // --- Caption --------------------------------------------------------------

  it('always renders the caption text', () => {
    renderBar(0.5);
    expect(screen.getByText(/individuellen Angaben/)).toBeInTheDocument();
  });

  // --- Section heading ------------------------------------------------------

  it('renders "Individualisierungsgrad" heading', () => {
    renderBar(0.5);
    expect(screen.getByText('Individualisierungsgrad')).toBeInTheDocument();
  });
});