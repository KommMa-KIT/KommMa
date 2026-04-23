/**
 * MeasureCard.test.tsx
 *
 * Unit tests for the MeasureCard component covering:
 *  - Cover image render and broken-image fallback
 *  - Popularity badge label and title (popularityComment)
 *  - Rank badge rendered only when result.rank provided
 *  - Title and short description
 *  - Short description line-clamp class
 *  - MeasurePopup opens on card click
 *  - MeasurePopup receives correct measure prop
 *  - MeasurePopup closes when onOpenChange(false) called
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import MeasureCard from '../../components/measures/MeasureCard';
import { Measure, PopularityLevel } from '../../types/measureTypes';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Capture the open prop so we can control it in assertions
let capturedPopupProps: any = {};
jest.mock('../../components/measures/MeasurePopup', () => (props: any) => {
  capturedPopupProps = props;
  return props.open ? (
    <div data-testid="measure-popup">
      <button onClick={() => props.onOpenChange(false)}>close-popup</button>
    </div>
  ) : null;
});

jest.mock('../../components/measures/PopularityStyling', () => ({
  getPopularityStyle: (p: string) => `style-${p}`,
  getPopularityLabel: (p: string) => `label-${p}`,
}));

// MeasurePopup needs a Redux store (via MeasuresSlice) — stub it out
jest.mock('../../store/MeasuresSlice', () => ({
  selectAllMeasures: (state: any) => state.measures?.all ?? [],
}));

jest.mock('../../services/DependencyGraphService', () => ({
  default: { getPrerequisiteMeasures: () => new Set() },
}));

jest.mock('../../components/GraphInitializer', () => () => null);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildStore() {
  return configureStore({ reducer: { measures: () => ({ all: [] }) } });
}

const BASE_MEASURE: Measure = {
  id: 'm1',
  title: 'Wind Farm',
  shortDescription: 'Short description text',
  description: 'Long description',
  popularity: 'hoch' as PopularityLevel,
  popularityComment: 'Very accepted',
  imageURL: 'https://example.com/wind.jpg',
  relevantParameters: [],
  furtherInfo: [],
};

function renderCard(
  measure: Measure = BASE_MEASURE,
  result?: { rank?: number; timeScore?: number; costScore?: number; co2Savings?: number }
) {
  const store = buildStore();
  return render(
    <Provider store={store}>
      <MeasureCard measure={measure} result={result} />
    </Provider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MeasureCard', () => {
  beforeEach(() => {
    capturedPopupProps = {};
  });

  // --- Image ----------------------------------------------------------------

  it('renders the cover image with correct src', () => {
    renderCard();
    const img = screen.getByAltText('Wind Farm') as HTMLImageElement;
    expect(img).toHaveAttribute('src', 'https://example.com/wind.jpg');
  });

  it('shows fallback icon when image fails to load', () => {
    renderCard();
    const img = screen.getByAltText('Wind Farm');
    fireEvent.error(img);
    // Image should be replaced by the Info icon fallback (no img visible)
    expect(screen.queryByAltText('Wind Farm')).not.toBeInTheDocument();
  });

  // --- Title & description --------------------------------------------------

  it('renders the measure title', () => {
    renderCard();
    expect(screen.getByText('Wind Farm')).toBeInTheDocument();
  });

  it('renders the short description', () => {
    renderCard();
    expect(screen.getByText('Short description text')).toBeInTheDocument();
  });

  it('short description has line-clamp-3 class', () => {
    renderCard();
    const desc = screen.getByText('Short description text');
    expect(desc.className).toContain('line-clamp-3');
  });

  // --- Popularity badge -----------------------------------------------------

  it('renders the popularity badge with label from helper', () => {
    renderCard();
    expect(screen.getByText('label-hoch')).toBeInTheDocument();
  });

  it('renders popularity badge with style class from helper', () => {
    renderCard();
    const badge = screen.getByText('label-hoch');
    expect(badge.className).toContain('style-hoch');
  });

  it('sets badge title to popularityComment', () => {
    renderCard();
    const badge = screen.getByText('label-hoch');
    expect(badge).toHaveAttribute('title', 'Very accepted');
  });

  // --- Rank badge -----------------------------------------------------------

  it('does NOT render rank badge when result is undefined', () => {
    renderCard();
    expect(screen.queryByText(/#\d/)).not.toBeInTheDocument();
  });

  it('does NOT render rank badge when result has no rank', () => {
    renderCard(BASE_MEASURE, { timeScore: 0.8 });
    expect(screen.queryByText(/#\d/)).not.toBeInTheDocument();
  });

  it('renders rank badge when result.rank is provided', () => {
    renderCard(BASE_MEASURE, { rank: 3 });
    expect(screen.getByText('#3')).toBeInTheDocument();
  });

  // --- Popup interaction ----------------------------------------------------

  it('popup is closed by default', () => {
    renderCard();
    expect(screen.queryByTestId('measure-popup')).not.toBeInTheDocument();
  });

  it('opens MeasurePopup on card click', () => {
    renderCard();
    // The card root div
    const card = screen.getByText('Wind Farm').closest('.cursor-pointer')!;
    fireEvent.click(card);
    expect(screen.getByTestId('measure-popup')).toBeInTheDocument();
  });

  it('passes correct measure to MeasurePopup', () => {
    renderCard();
    const card = screen.getByText('Wind Farm').closest('.cursor-pointer')!;
    fireEvent.click(card);
    expect(capturedPopupProps.measure).toEqual(BASE_MEASURE);
  });

  it('closes MeasurePopup when onOpenChange(false) is called', () => {
    renderCard();
    const card = screen.getByText('Wind Farm').closest('.cursor-pointer')!;
    fireEvent.click(card);
    fireEvent.click(screen.getByText('close-popup'));
    expect(screen.queryByTestId('measure-popup')).not.toBeInTheDocument();
  });

  // --- Hover styles ---------------------------------------------------------

  it('card has cursor-pointer class', () => {
    renderCard();
    const card = screen.getByText('Wind Farm').closest('.cursor-pointer');
    expect(card).not.toBeNull();
  });
});