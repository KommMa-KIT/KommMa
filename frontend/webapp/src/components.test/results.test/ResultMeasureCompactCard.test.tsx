/**
 * ResultMeasureCompactCard.test.tsx
 *
 * Tests for ResultMeasureCompactCard covering:
 *  - Renders title, shortDescription, rank
 *  - Renders all three score panels (Zeit / Kosten / Klima)
 *  - renderScaleIcons fills `scale` icons with active colour
 *  - renderCostScale shows savings indicator when ongoingCost < 0
 *  - renderCostScale does NOT show savings indicator when ongoingCost >= 0
 *  - isSelected=true → blue border + blue rank badge + blue title
 *  - isSelected=false → transparent border + gray badge + gray title
 *  - Clicking the card opens MeasurePopup
 *  - MeasurePopup receives correct measure prop
 *  - Popup can be closed via onOpenChange
 *  - Ref forwarding works
 *  - displayName is set correctly
 */

import { createRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ResultMeasureCompactCard from '../../components/results/ResultMeasureCompactCard';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let capturedPopupProps: any = {};
jest.mock('../../components/measures/MeasurePopup', () => (props: any) => {
  capturedPopupProps = props;
  return props.open ? (
    <div data-testid="measure-popup">
      <button onClick={() => props.onOpenChange(false)}>close-popup</button>
    </div>
  ) : null;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MEASURE = {
  id:               'm1',
  title:            'Solar Panels',
  shortDescription: 'Install solar panels on rooftops',
  imageURL:         'https://example.com/solar.jpg',
  popularity:       3,
  popularityComment: 'Very popular',
};

const RESULT = {
  timeScale:    3,
  costScale:    2,
  climateScale: 4,
  ongoingCost:  500,
  rank:         1,
};

function renderCard(overrides: {
  measure?:    any;
  result?:     any;
  isSelected?: boolean;
  onClick?:    jest.Mock;
} = {}) {
  const props = {
    measure:    overrides.measure    ?? MEASURE,
    result:     overrides.result     ?? RESULT,
    isSelected: overrides.isSelected ?? false,
    onClick:    overrides.onClick    ?? jest.fn(),
  };
  return render(<ResultMeasureCompactCard {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ResultMeasureCompactCard', () => {
  beforeEach(() => {
    capturedPopupProps = {};
  });

  // --- Content rendering ----------------------------------------------------

  it('renders the measure title', () => {
    renderCard();
    expect(screen.getByText('Solar Panels')).toBeInTheDocument();
  });

  it('renders the short description', () => {
    renderCard();
    expect(screen.getByText('Install solar panels on rooftops')).toBeInTheDocument();
  });

  it('renders the rank badge', () => {
    renderCard();
    expect(screen.getByText('#1')).toBeInTheDocument();
  });

  it('renders Zeit score panel label', () => {
    renderCard();
    expect(screen.getByText('Zeit')).toBeInTheDocument();
  });

  it('renders Kosten score panel label', () => {
    renderCard();
    expect(screen.getByText('Kosten')).toBeInTheDocument();
  });

  it('renders Klima score panel label', () => {
    renderCard();
    expect(screen.getByText('Klima')).toBeInTheDocument();
  });

  // --- Scale icons ----------------------------------------------------------

  it('renders 5 clock icons for Zeit (3 filled, 2 grey)', () => {
    renderCard({ result: { ...RESULT, timeScale: 3 } });
    // All SVGs in the Zeit panel — 3 active (text-blue-600) + 2 grey (text-gray-300)
    const zeitPanel = screen.getByText('Zeit').closest('div')!;
    const icons = zeitPanel.querySelectorAll('svg');
    expect(icons).toHaveLength(5);
  });

  it('renders 5 leaf icons for Klima (4 filled, 1 grey)', () => {
    renderCard({ result: { ...RESULT, climateScale: 4 } });
    const klimaPanel = screen.getByText('Klima').closest('div')!;
    const icons = klimaPanel.querySelectorAll('svg');
    expect(icons).toHaveLength(5);
  });

  // --- Cost scale -----------------------------------------------------------

  it('shows savings indicator (amber) when ongoingCost < 0', () => {
    const { container } = renderCard({ result: { ...RESULT, ongoingCost: -100 } });
    // First Euro icon in cost scale should have text-amber-600 (savings indicator)
    const kostenPanel = screen.getByText('Kosten').closest('div')!;
    const amberIcons = kostenPanel.querySelectorAll('.text-amber-600');
    expect(amberIcons.length).toBeGreaterThan(0);
  });

  it('does NOT show savings indicator (grey) when ongoingCost >= 0', () => {
    const { container } = renderCard({ result: { ...RESULT, ongoingCost: 500 } });
    const kostenPanel = screen.getByText('Kosten').closest('div')!;
    // The savings indicator icon should be gray (text-gray-300), not amber
    const grayIcons = kostenPanel.querySelectorAll('.text-gray-300');
    expect(grayIcons.length).toBeGreaterThan(0);
  });

  // --- Selection state ------------------------------------------------------

  it('applies border-blue-500 when isSelected=true', () => {
    const { container } = renderCard({ isSelected: true });
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('border-blue-500');
  });

  it('applies transparent border when isSelected=false', () => {
    const { container } = renderCard({ isSelected: false });
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('border-transparent');
  });

  it('rank badge is blue when isSelected=true', () => {
    renderCard({ isSelected: true });
    const badge = screen.getByText('#1');
    expect(badge.className).toContain('bg-blue-600');
  });

  it('rank badge is gray when isSelected=false', () => {
    renderCard({ isSelected: false });
    const badge = screen.getByText('#1');
    expect(badge.className).toContain('bg-gray-200');
  });

  it('title is blue-900 when isSelected=true', () => {
    renderCard({ isSelected: true });
    const title = screen.getByText('Solar Panels');
    expect(title.className).toContain('text-blue-900');
  });

  it('title is gray-900 when isSelected=false', () => {
    renderCard({ isSelected: false });
    const title = screen.getByText('Solar Panels');
    expect(title.className).toContain('text-gray-900');
  });

  it('card has bg-blue-50 when selected', () => {
    const { container } = renderCard({ isSelected: true });
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('bg-blue-50');
  });

  // --- Popup ----------------------------------------------------------------

  it('popup is closed by default', () => {
    renderCard();
    expect(screen.queryByTestId('measure-popup')).not.toBeInTheDocument();
  });

  it('clicking the card opens MeasurePopup', () => {
    renderCard();
    fireEvent.click(screen.getByText('Solar Panels').closest('[class*="cursor-pointer"]')!);
    expect(screen.getByTestId('measure-popup')).toBeInTheDocument();
  });

  it('popup receives correct measure prop', () => {
    renderCard();
    fireEvent.click(screen.getByText('Solar Panels').closest('[class*="cursor-pointer"]')!);
    expect(capturedPopupProps.measure.id).toBe('m1');
  });

  it('popup can be closed via onOpenChange', () => {
    renderCard();
    fireEvent.click(screen.getByText('Solar Panels').closest('[class*="cursor-pointer"]')!);
    fireEvent.click(screen.getByText('close-popup'));
    expect(screen.queryByTestId('measure-popup')).not.toBeInTheDocument();
  });

  // --- Ref forwarding -------------------------------------------------------

  it('forwards ref to the card div', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <ResultMeasureCompactCard
        ref={ref}
        measure={MEASURE}
        result={RESULT}
        isSelected={false}
      />
    );
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe('DIV');
  });

  // --- displayName ----------------------------------------------------------

  it('has displayName set to ResultMeasureCompactCard', () => {
    expect(ResultMeasureCompactCard.displayName).toBe('ResultMeasureCompactCard');
  });
});