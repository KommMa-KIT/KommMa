/**
 * ResultMeasureCard.test.tsx
 *
 * Tests for ResultMeasureCard covering:
 *  - Renders title, description, metrics, rank badge
 *  - Image load / error fallback
 *  - Popularity badge rendered
 *  - renderScaleIcons (Zeit / Klima icon scale)
 *  - renderCostScale (savings indicator when ongoingCost < 0)
 *  - Status badges: implemented, infeasible, transitive infeasible, filtered
 *  - getBorderStyle: none / synergy ring / conflict ring / striped (both)
 *  - Clicking card opens MeasurePopup
 *  - handleImplemented: toggles implemented
 *  - handleInfeasible: toggles infeasible directly / shows confirmation dialog when dependents exist
 *  - ConfirmationDialog confirm → marks infeasible
 *  - ConfirmationDialog cancel → does NOT mark infeasible
 *  - Opacity/grayscale applied when filtered/hidden/implemented/infeasible
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ResultMeasureCard from '../../components/results/ResultMeasureCard';
import { Measure } from '../../types/measureTypes';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockMarkAsImplemented = jest.fn((id) => ({
  type: 'result/markImplemented',
  payload: id,
}));

const mockMarkAsInfeasible = jest.fn((id) => ({
  type: 'result/markInfeasible',
  payload: id,
}));

const mockUnmarkMeasure = jest.fn((id) => ({
  type: 'result/unmark',
  payload: id,
}));

jest.mock('../../store/ResultSlice', () => ({
  markAsImplemented: (id: string) => mockMarkAsImplemented(id),
  markAsInfeasible: (id: string) => mockMarkAsInfeasible(id),
  unmarkMeasure: (id: string) => mockUnmarkMeasure(id),
  selectMeasureStatus: (state: any) => state.results.measureStatus,
  selectMeasureResults: (state: any) => state.results.measureResults,
}));

jest.mock('../../components/measures/PopularityStyling', () => ({
  getPopularityStyle: () => 'popularity-style-class',
  getPopularityLabel: () => 'Sehr beliebt',
}));

let capturedPopupProps: any = {};
jest.mock('../../components/measures/MeasurePopup', () => (props: any) => {
  capturedPopupProps = props;
  return props.open ? (
    <div data-testid="measure-popup">
      <button onClick={() => props.onOpenChange(false)}>close-popup</button>
    </div>
  ) : null;
});

jest.mock('../../components/results/ConfirmationDialog', () => (props: any) =>
  props.open ? (
    <div data-testid="confirm-dialog">
      <span data-testid="confirm-title">{props.title}</span>
      <span data-testid="confirm-message">{props.message}</span>
      <button
        onClick={() => {
          props.onConfirm();
          props.onOpenChange(false);
        }}
      >
        confirm
      </button>
      <button onClick={() => props.onOpenChange(false)}>cancel</button>
    </div>
  ) : null
);

const mockIsInitialized = jest.fn(() => false);
const mockGetDependents = jest.fn(() => new Set<string>());

jest.mock('../../services/DependencyGraphService', () => ({
  dependencyGraphService: {
    isInitialized: () => mockIsInitialized(),
    getDependentMeasures: (id: string) => mockGetDependents(id),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MEASURE: Measure = {
  id: 'm1',
  title: 'Solar Panels',
  shortDescription: 'Install solar panels',
  description: 'Long description',
  imageURL: 'https://example.com/solar.jpg',
  popularity: 3 as any,
  popularityComment: 'Very popular',
  relevantParameters: [],
  furtherInfo: [],
};

const RESULT = {
  timeScore: 4,
  costScore: 3,
  climateScore: 5,
  timeScale: 3,
  costScale: 2,
  climateScale: 4,
  time: 12,
  investmentCost: 50000,
  ongoingCost: 500,
  totalCost: 60000,
  onetimeEmissionSavings: 1000,
  ongoingEmissionSavings: 200,
  rank: 1,
};

type ResultsState = {
  measureStatus: {
    implemented: string[];
    infeasible: string[];
  };
  measureResults: Array<{ measureId: string }>;
};

function createResultsReducer(initialState: ResultsState) {
  return (state = initialState, action: any): ResultsState => {
    switch (action.type) {
      case 'result/markImplemented':
        return {
          ...state,
          measureStatus: {
            implemented: state.measureStatus.implemented.includes(action.payload)
              ? state.measureStatus.implemented
              : [...state.measureStatus.implemented, action.payload],
            infeasible: state.measureStatus.infeasible.filter((id) => id !== action.payload),
          },
        };

      case 'result/markInfeasible':
        return {
          ...state,
          measureStatus: {
            implemented: state.measureStatus.implemented.filter((id) => id !== action.payload),
            infeasible: state.measureStatus.infeasible.includes(action.payload)
              ? state.measureStatus.infeasible
              : [...state.measureStatus.infeasible, action.payload],
          },
        };

      case 'result/unmark':
        return {
          ...state,
          measureStatus: {
            implemented: state.measureStatus.implemented.filter((id) => id !== action.payload),
            infeasible: state.measureStatus.infeasible.filter((id) => id !== action.payload),
          },
        };

      default:
        return state;
    }
  };
}

function buildStore({
  implemented = [] as string[],
  infeasible = [] as string[],
  measureResults = [{ measureId: 'm1' }],
} = {}) {
  const initialState: ResultsState = {
    measureStatus: {
      implemented,
      infeasible,
    },
    measureResults,
  };

  return configureStore({
    reducer: {
      results: createResultsReducer(initialState),
    },
    preloadedState: {
      results: initialState,
    },
  });
}

interface RenderOptions {
  isFiltered?: boolean;
  isHidden?: boolean;
  isTransitiveInfeasible?: boolean;
  hasSynergy?: boolean;
  hasConflict?: boolean;
  implemented?: string[];
  infeasible?: string[];
  measureResults?: any[];
  result?: typeof RESULT;
}

function renderCard(options: RenderOptions = {}) {
  const {
    isFiltered = false,
    isHidden = false,
    isTransitiveInfeasible = false,
    hasSynergy = false,
    hasConflict = false,
    implemented = [],
    infeasible = [],
    measureResults = [{ measureId: 'm1' }],
    result = RESULT,
  } = options;

  const store = buildStore({ implemented, infeasible, measureResults });
  const renderResult = render(
    <Provider store={store}>
      <ResultMeasureCard
        measure={MEASURE}
        result={result}
        isFiltered={isFiltered}
        isHidden={isHidden}
        isTransitiveInfeasible={isTransitiveInfeasible}
        hasSynergy={hasSynergy}
        hasConflict={hasConflict}
      />
    </Provider>
  );

  return { store, ...renderResult };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ResultMeasureCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedPopupProps = {};
    mockMarkAsImplemented.mockImplementation((id) => ({
      type: 'result/markImplemented',
      payload: id,
    }));
    mockMarkAsInfeasible.mockImplementation((id) => ({
      type: 'result/markInfeasible',
      payload: id,
    }));
    mockUnmarkMeasure.mockImplementation((id) => ({
      type: 'result/unmark',
      payload: id,
    }));
    mockIsInitialized.mockReturnValue(false);
    mockGetDependents.mockReturnValue(new Set<string>());
  });

  // --- Basic content --------------------------------------------------------

  it('renders the measure title', () => {
    renderCard();
    expect(screen.getByText('Solar Panels')).toBeInTheDocument();
  });

  it('renders the short description', () => {
    renderCard();
    expect(screen.getByText('Install solar panels')).toBeInTheDocument();
  });

  it('renders the rank badge (#1)', () => {
    renderCard();
    expect(screen.getByText('#1')).toBeInTheDocument();
  });

  it('renders popularity badge', () => {
    renderCard();
    expect(screen.getByText('Sehr beliebt')).toBeInTheDocument();
  });

  it('renders implementation time metric', () => {
    renderCard();
    expect(screen.getByText('12 Monate')).toBeInTheDocument();
  });

  it('renders investment cost metric', () => {
    renderCard();
    expect(screen.getByText(/50\.000/)).toBeInTheDocument();
  });

  it('renders ongoing cost metric', () => {
    renderCard();
    expect(screen.getByText(/500/)).toBeInTheDocument();
  });

  // --- Image ----------------------------------------------------------------

  it('renders image when imageURL loads successfully', () => {
    renderCard();
    expect(screen.getByAltText('Solar Panels')).toBeInTheDocument();
  });

  it('renders fallback icon when image errors', () => {
    renderCard();
    const img = screen.getByAltText('Solar Panels');
    fireEvent.error(img);
    expect(screen.queryByAltText('Solar Panels')).not.toBeInTheDocument();
    expect(document.querySelector('.text-gray-400 svg')).not.toBeNull();
  });

  // --- Score panels ---------------------------------------------------------

  it('renders Zeit scale panel', () => {
    renderCard();
    expect(screen.getByText('Zeit')).toBeInTheDocument();
  });

  it('renders Kosten scale panel', () => {
    renderCard();
    expect(screen.getAllByText('Kosten').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Klima scale panel', () => {
    renderCard();
    expect(screen.getByText('Klima')).toBeInTheDocument();
  });

  it('shows savings indicator when ongoingCost < 0', () => {
    renderCard({
      result: { ...RESULT, ongoingCost: -500 },
    });

    const scorePanel = document.querySelector('.bg-gray-50.border-l');
    const amberIcons = scorePanel?.querySelectorAll('.text-amber-600');
    expect(amberIcons?.length).toBeGreaterThan(0);
  });

  // --- Status badges --------------------------------------------------------

  it('shows "Umgesetzt" badge when implemented', () => {
    renderCard({ implemented: ['m1'] });
    expect(screen.getByText('Umgesetzt')).toBeInTheDocument();
  });

  it('shows "Nicht umsetzbar" badge when infeasible', () => {
    renderCard({ infeasible: ['m1'] });
    const badges = screen.getAllByText('Nicht umsetzbar');
    expect(badges.some((el) => el.closest('.bg-red-600\\/90'))).toBe(true);
  });

  it('shows "Nicht umsetzbar" badge when transitiveInfeasible', () => {
    renderCard({ isTransitiveInfeasible: true });
    const badges = screen.getAllByText('Nicht umsetzbar');
    expect(badges.some((el) => el.closest('.bg-red-600\\/90'))).toBe(true);
  });

  it('shows "Gefiltert" badge when isFiltered=true', () => {
    renderCard({ isFiltered: true });
    expect(screen.getByText('Gefiltert')).toBeInTheDocument();
  });

  it('does NOT show any status badge by default', () => {
    renderCard();
    expect(screen.queryByText('Umgesetzt')).not.toBeInTheDocument();
    expect(screen.queryByText('Gefiltert')).not.toBeInTheDocument();
    const badges = screen.queryAllByText('Nicht umsetzbar');
    expect(badges.every((el) => !el.closest('.bg-red-600\\/90'))).toBe(true);
  });

  // --- Opacity/grayscale ----------------------------------------------------

  it('applies opacity class when filtered', () => {
    const { container } = renderCard({ isFiltered: true });
    expect(container.querySelector('.opacity-40')).not.toBeNull();
  });

  it('applies opacity class when implemented', () => {
    const { container } = renderCard({ implemented: ['m1'] });
    expect(container.querySelector('.opacity-40')).not.toBeNull();
  });

  // --- Border styles --------------------------------------------------------

  it('applies no ring when no synergy/conflict', () => {
    const { container } = renderCard();
    expect(container.querySelector('.ring-green-500')).toBeNull();
    expect(container.querySelector('.ring-red-500')).toBeNull();
  });

  it('applies green ring when hasSynergy=true', () => {
    const { container } = renderCard({ hasSynergy: true });
    expect(container.querySelector('.ring-green-500')).not.toBeNull();
  });

  it('applies red ring when hasConflict=true', () => {
    const { container } = renderCard({ hasConflict: true });
    expect(container.querySelector('.ring-red-500')).not.toBeNull();
  });

  it('applies striped backgroundImage when both synergy and conflict', () => {
  const { container } = render(
    <Provider store={buildStore()}>
      <ResultMeasureCard
        measure={MEASURE}
        result={RESULT}
        hasSynergy={true}
        hasConflict={true}
      />
    </Provider>
  );

  const card = container.firstChild as HTMLElement;

  expect(card).toHaveClass('ring-2');
  expect(card.style.backgroundClip).toContain('padding-box');
  expect(card.style.backgroundOrigin).toBe('border-box');
  expect(card.style.border).toContain('3px solid transparent');
});
  it('no border style when isHidden=true (even with synergy)', () => {
    const { container } = renderCard({
      isHidden: true,
      hasSynergy: true,
    });
    expect(container.querySelector('.ring-green-500')).toBeNull();
  });

  it('no border style when isFiltered=true (even with conflict)', () => {
    const { container } = renderCard({
      isFiltered: true,
      hasConflict: true,
    });
    expect(container.querySelector('.ring-red-500')).toBeNull();
  });

  // --- MeasurePopup ---------------------------------------------------------

  it('popup is closed by default', () => {
    renderCard();
    expect(screen.queryByTestId('measure-popup')).not.toBeInTheDocument();
  });

  it('clicking the card opens MeasurePopup', () => {
    renderCard();
    const card = document.querySelector('.cursor-pointer') as HTMLElement;
    fireEvent.click(card);
    expect(screen.getByTestId('measure-popup')).toBeInTheDocument();
  });

  it('popup receives correct measure', () => {
    renderCard();
    fireEvent.click(document.querySelector('.cursor-pointer') as Element);
    expect(capturedPopupProps.measure.id).toBe('m1');
  });

  it('popup closes on onOpenChange(false)', () => {
    renderCard();
    fireEvent.click(document.querySelector('.cursor-pointer') as Element);
    fireEvent.click(screen.getByText('close-popup'));
    expect(screen.queryByTestId('measure-popup')).not.toBeInTheDocument();
  });

  // --- handleImplemented ----------------------------------------------------

  it('marks a measure as implemented when clicking the check button', () => {
    const { store } = renderCard();
    const [checkBtn] = screen.getAllByRole('button');

    fireEvent.click(checkBtn);

    expect(store.getState().results.measureStatus.implemented).toContain('m1');
    expect(store.getState().results.measureStatus.infeasible).not.toContain('m1');
  });

  it('unmarks an implemented measure when clicking the check button again', () => {
    const { store } = renderCard({ implemented: ['m1'] });
    const [checkBtn] = screen.getAllByRole('button');

    fireEvent.click(checkBtn);

    expect(store.getState().results.measureStatus.implemented).not.toContain('m1');
  });

  // --- handleInfeasible (no dependents) -------------------------------------

  it('marks a measure as infeasible directly when no dependents exist', () => {
    mockIsInitialized.mockReturnValue(true);
    mockGetDependents.mockReturnValue(new Set());

    const { store } = renderCard();
    const [, xBtn] = screen.getAllByRole('button');

    fireEvent.click(xBtn);

    expect(store.getState().results.measureStatus.infeasible).toContain('m1');
    expect(store.getState().results.measureStatus.implemented).not.toContain('m1');
  });

  it('unmarks an infeasible measure when clicking X again', () => {
    const { store } = renderCard({ infeasible: ['m1'] });
    const [, xBtn] = screen.getAllByRole('button');

    fireEvent.click(xBtn);

    expect(store.getState().results.measureStatus.infeasible).not.toContain('m1');
  });

  it('marks a measure as infeasible directly when dependencyGraph is not initialized', () => {
    mockIsInitialized.mockReturnValue(false);

    const { store } = renderCard();
    const [, xBtn] = screen.getAllByRole('button');

    fireEvent.click(xBtn);

    expect(store.getState().results.measureStatus.infeasible).toContain('m1');
  });

  // --- handleInfeasible (with dependents) -----------------------------------

  it('shows ConfirmationDialog when dependents exist in results', () => {
    mockIsInitialized.mockReturnValue(true);
    mockGetDependents.mockReturnValue(new Set(['m1']));

    renderCard({ measureResults: [{ measureId: 'm1' }] });
    const [, xBtn] = screen.getAllByRole('button');

    fireEvent.click(xBtn);

    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
  });

  it('confirmation dialog title mentions abhängige Maßnahmen', () => {
    mockIsInitialized.mockReturnValue(true);
    mockGetDependents.mockReturnValue(new Set(['m1']));

    renderCard({ measureResults: [{ measureId: 'm1' }] });
    const [, xBtn] = screen.getAllByRole('button');

    fireEvent.click(xBtn);

    expect(screen.getByTestId('confirm-title')).toHaveTextContent(
      'Abhängige Maßnahmen betroffen'
    );
  });

  it('confirming dialog marks the measure as infeasible', () => {
    mockIsInitialized.mockReturnValue(true);
    mockGetDependents.mockReturnValue(new Set(['m1']));

    const { store } = renderCard({ measureResults: [{ measureId: 'm1' }] });
    const [, xBtn] = screen.getAllByRole('button');

    fireEvent.click(xBtn);
    fireEvent.click(screen.getByText('confirm'));

    expect(store.getState().results.measureStatus.infeasible).toContain('m1');
  });

  it('cancelling dialog does NOT mark the measure as infeasible', () => {
    mockIsInitialized.mockReturnValue(true);
    mockGetDependents.mockReturnValue(new Set(['m1']));

    const { store } = renderCard({ measureResults: [{ measureId: 'm1' }] });
    const [, xBtn] = screen.getAllByRole('button');

    fireEvent.click(xBtn);
    fireEvent.click(screen.getByText('cancel'));

    expect(store.getState().results.measureStatus.infeasible).not.toContain('m1');
  });

  it('does NOT show dialog when dependents are not in measureResults', () => {
    mockIsInitialized.mockReturnValue(true);
    mockGetDependents.mockReturnValue(new Set(['m_other']));

    const { store } = renderCard({ measureResults: [{ measureId: 'm1' }] });
    const [, xBtn] = screen.getAllByRole('button');

    fireEvent.click(xBtn);

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    expect(store.getState().results.measureStatus.infeasible).toContain('m1');
  });
});