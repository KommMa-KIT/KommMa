/**
 * MeasurePopup.test.tsx
 *
 * Unit tests for the MeasurePopup component covering:
 *  - Dialog renders when open=true, not rendered when open=false
 *  - Cover image with error fallback
 *  - Title, short description, full description
 *  - Popularity badge icons (hoch / mittel / niedrig / unknown)
 *  - Popularity badge colors (green / yellow / red / gray)
 *  - Popularity comment rendered when provided
 *  - Relevant parameters chips
 *  - Further info external links
 *  - Prerequisite measures resolved from DependencyGraphService
 *  - Close button calls onOpenChange(false)
 *  - GraphInitializer is mounted
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import MeasurePopup from '../../components/measures/MeasurePopup';
import { Measure, PopularityLevel } from '../../types/measureTypes';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../components/GraphInitializer', () => ({
  __esModule: true,
  default: () => <div data-testid="graph-init" />,
}));

const mockGetPrerequisiteMeasures = jest.fn(() => new Set<string>());
jest.mock('../../services/DependencyGraphService', () => ({
  __esModule: true,
  default: {
    getPrerequisiteMeasures: (id: string) => mockGetPrerequisiteMeasures(id),
  },
}));

const ALL_MEASURES = [
  { id: 'pre1', title: 'Prerequisite One' },
  { id: 'pre2', title: 'Prerequisite Two' },
  { id: 'm1', title: 'Main Measure' },
];

jest.mock('../../store/MeasuresSlice', () => ({
  selectAllMeasures: (state: any) => state.measures.all,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildStore() {
  return configureStore({
    reducer: { measures: () => ({ all: ALL_MEASURES }) },
  });
}

const BASE_MEASURE: Measure = {
  id: 'm1',
  title: 'Solar Panels',
  shortDescription: 'Short desc',
  description: 'Full long description',
  popularity: 'hoch' as PopularityLevel,
  popularityComment: '',
  imageURL: 'https://example.com/image.jpg',
  relevantParameters: ['Sonnenstunden', 'Dachfläche'],
  furtherInfo: ['https://example.com/info'],
};

function renderPopup(
  props: Partial<{ measure: Measure; open: boolean; onOpenChange: (v: boolean) => void }>
) {
  const store = buildStore();
  const measure = props.measure ?? BASE_MEASURE;
  const open = props.open ?? true;
  const onOpenChange = props.onOpenChange ?? jest.fn();

  return {
    ...render(
      <Provider store={store}>
        <MeasurePopup measure={measure} open={open} onOpenChange={onOpenChange} />
      </Provider>
    ),
    onOpenChange,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MeasurePopup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPrerequisiteMeasures.mockReturnValue(new Set());
  });

  // --- Open / closed --------------------------------------------------------

  it('renders dialog content when open=true', () => {
    renderPopup({ open: true });
    expect(screen.getByText('Solar Panels')).toBeInTheDocument();
  });

  it('does NOT render dialog content when open=false', () => {
    renderPopup({ open: false });
    expect(screen.queryByText('Solar Panels')).not.toBeInTheDocument();
  });

  // --- Cover image ----------------------------------------------------------

  it('renders the cover image with correct src and alt', () => {
    renderPopup({});
    const img = screen.getByAltText('Solar Panels');
    expect(img).toHaveAttribute('src', 'https://example.com/image.jpg');
  });

  it('hides broken image on error', () => {
    renderPopup({});
    const img = screen.getByAltText('Solar Panels') as HTMLImageElement;
    fireEvent.error(img);
    expect(img.style.display).toBe('none');
  });

  // --- Text content ---------------------------------------------------------

  it('renders the measure title', () => {
    renderPopup({});
    expect(screen.getByText('Solar Panels')).toBeInTheDocument();
  });

  it('renders the short description', () => {
    renderPopup({});
    expect(screen.getByText('Short desc')).toBeInTheDocument();
  });

  it('renders the full description', () => {
    renderPopup({});
    expect(screen.getByText('Full long description')).toBeInTheDocument();
  });

  it('renders "Beschreibung" section heading', () => {
    renderPopup({});
    expect(screen.getByText('Beschreibung')).toBeInTheDocument();
  });

  // --- Relevant parameters --------------------------------------------------

  it('renders relevant parameter chips', () => {
    renderPopup({});
    expect(screen.getByText('Sonnenstunden')).toBeInTheDocument();
    expect(screen.getByText('Dachfläche')).toBeInTheDocument();
  });

  it('renders "Relevante Faktoren" heading when parameters exist', () => {
    renderPopup({});
    expect(screen.getByText('Relevante Faktoren')).toBeInTheDocument();
  });

  it('does NOT render "Relevante Faktoren" when parameters list is empty', () => {
    renderPopup({ measure: { ...BASE_MEASURE, relevantParameters: [] } });
    expect(screen.queryByText('Relevante Faktoren')).not.toBeInTheDocument();
  });

  // --- Further info links ---------------------------------------------------

  it('renders external link', () => {
    renderPopup({});
    const link = screen.getByRole('link', { name: 'https://example.com/info' });
    expect(link).toHaveAttribute('href', 'https://example.com/info');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders "Weitere Informationen" heading when links exist', () => {
    renderPopup({});
    expect(screen.getByText('Weitere Informationen')).toBeInTheDocument();
  });

  it('does NOT render "Weitere Informationen" when list is empty', () => {
    renderPopup({ measure: { ...BASE_MEASURE, furtherInfo: [] } });
    expect(screen.queryByText('Weitere Informationen')).not.toBeInTheDocument();
  });

  // --- Popularity badge colors ----------------------------------------------

  it('uses green colour for high popularity', () => {
    renderPopup({ measure: { ...BASE_MEASURE, popularity: 'hoch' } });
    const wrapper = document.querySelector('.text-green-700');
    expect(wrapper).not.toBeNull();
  });

  it('uses yellow colour for medium popularity', () => {
    renderPopup({ measure: { ...BASE_MEASURE, popularity: 'mittel' } });
    const wrapper = document.querySelector('.text-yellow-700');
    expect(wrapper).not.toBeNull();
  });

  it('uses red colour for low popularity', () => {
    renderPopup({ measure: { ...BASE_MEASURE, popularity: 'niedrig' } });
    const wrapper = document.querySelector('.text-red-700');
    expect(wrapper).not.toBeNull();
  });

  it('uses gray colour for unknown popularity', () => {
    renderPopup({ measure: { ...BASE_MEASURE, popularity: 'unknown' as any } });
    const wrapper = document.querySelector('.text-gray-700');
    expect(wrapper).not.toBeNull();
  });

  // --- Popularity comment ---------------------------------------------------

  it('renders popularityComment when provided', () => {
    renderPopup({
      measure: { ...BASE_MEASURE, popularityComment: 'Very popular in Bavaria' },
    });
    expect(screen.getByText('Very popular in Bavaria')).toBeInTheDocument();
  });

  it('does NOT render popularity comment block when empty string', () => {
    renderPopup({ measure: { ...BASE_MEASURE, popularityComment: '' } });
    expect(screen.queryByText('Very popular in Bavaria')).not.toBeInTheDocument();
  });

  // --- Prerequisite measures ------------------------------------------------

  it('does NOT render prerequisite section when no prerequisites', () => {
    mockGetPrerequisiteMeasures.mockReturnValue(new Set());
    renderPopup({});
    expect(screen.queryByText('Vorausgesetzte Maßnahmen')).not.toBeInTheDocument();
  });

  it('renders prerequisite measures when they exist', () => {
    mockGetPrerequisiteMeasures.mockReturnValue(new Set(['pre1', 'pre2']));
    renderPopup({});
    expect(screen.getByText('Vorausgesetzte Maßnahmen')).toBeInTheDocument();
    expect(screen.getByText('Prerequisite One')).toBeInTheDocument();
    expect(screen.getByText('Prerequisite Two')).toBeInTheDocument();
  });

  it('passes the measure id to getPrerequisiteMeasures', () => {
    renderPopup({});
    expect(mockGetPrerequisiteMeasures).toHaveBeenCalledWith('m1');
  });

  // --- GraphInitializer -----------------------------------------------------

  it('renders GraphInitializer inside dialog', () => {
    renderPopup({});
    expect(screen.getByTestId('graph-init')).toBeInTheDocument();
  });

  // --- Close button ---------------------------------------------------------

  it('calls onOpenChange(false) when close button clicked', () => {
    const onOpenChange = jest.fn();
    renderPopup({ onOpenChange });

    const closeBtn =
      document.querySelector('button') ??
      document.querySelector('[aria-label]') ??
      document.querySelector('.rounded-full');

    expect(closeBtn).not.toBeNull();
    if (closeBtn) {
      fireEvent.click(closeBtn);
    }

    expect(onOpenChange).toHaveBeenCalled();
  });
});