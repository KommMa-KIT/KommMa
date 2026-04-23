/**
 * EndView.test.tsx  (fixed)
 *
 * Fixes vs. original:
 *
 * 1. RTK actionCreatorInvariantMiddleware
 *    Same root cause as StartView: mock action-creators return plain objects
 *    but lack RTK's internal Symbol tag → dispatch throws.
 *    Fix: `middleware: () => []` in buildStore.
 *
 * 2. Categories not appearing / "Weitere" button missing
 *    The component loads categories in a useEffect. renderEndView wraps
 *    render in act(async), which flushes the microtask queue — but only if
 *    the mock is already configured before render. Some tests set up the mock
 *    after renderEndView, so the effect ran against the previous mock.
 *    Fix: always configure mockGetSubsidyCategories before renderEndView.
 *    Also added a post-render waitFor where the test relies on async-loaded
 *    category data appearing in the DOM.
 *
 * 3. "Weitere Fördermittel hinzufügen" button not found
 *    The button only renders when categories.length > subsidies.length.
 *    With 1 subsidy and 2 categories that condition holds — but categories
 *    are loaded asynchronously. Added waitFor to let the effect resolve first.
 *
 * 4. updateSubsidy called with old id='' instead of 'cat1'
 *    fireEvent.change on a <select> does not update the DOM value in jsdom
 *    unless the option actually exists. The mock returned categories only
 *    after renderEndView, so the option was not rendered.
 *    Fix: same as (2) — configure mock before render.
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import EndView from '../../components/input/EndView';
import { SubsidyCategory } from '../../types/inputTypes';

// ---------------------------------------------------------------------------
// Redux slice mock — self-contained factory, mock-prefixed vars for Babel.
// ---------------------------------------------------------------------------

const mockAddSubsidy    = jest.fn((p: any)      => ({ type: 'community/addSubsidy',    payload: p }));
const mockUpdateSubsidy = jest.fn((p: any)      => ({ type: 'community/updateSubsidy', payload: p }));
const mockRemoveSubsidy = jest.fn((i: number)   => ({ type: 'community/removeSubsidy', payload: i }));

jest.mock('../../store/CommunitySlice', () => ({
  addSubsidy:      (p: any)    => mockAddSubsidy(p),
  updateSubsidy:   (p: any)    => mockUpdateSubsidy(p),
  removeSubsidy:   (i: number) => mockRemoveSubsidy(i),
  selectSubsidies: (state: any) => state.community.subsidies,
}));

// ---------------------------------------------------------------------------
// CommunityService mock — factory is self-contained; reference via
// jest.mocked() lazily inside tests.
// ---------------------------------------------------------------------------

jest.mock('../../services/CommunityService', () => ({
  __esModule: true,
  default: {
    getSubsidyCategories: jest.fn(),
  },
}));

import communityService from '../../services/CommunityService';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES: SubsidyCategory[] = [
  { id: 'cat1', title: 'Energie' },
  { id: 'cat2', title: 'Mobilität' },
];

// ---------------------------------------------------------------------------
// Store — middleware disabled so RTK invariant checks never fire.
// ---------------------------------------------------------------------------

function buildStore(subsidies: any[] = []) {
  return configureStore({
    reducer: {
      community: (state = { subsidies }, action: any) => {
        switch (action.type) {
          case 'community/addSubsidy':
            return { ...state, subsidies: [...state.subsidies, action.payload] };
          case 'community/updateSubsidy':
            return {
              ...state,
              subsidies: state.subsidies.map((s: any, i: number) =>
                i === action.payload.index ? action.payload.subsidy : s
              ),
            };
          case 'community/removeSubsidy':
            return {
              ...state,
              subsidies: state.subsidies.filter((_: any, i: number) => i !== action.payload),
            };
          default:
            return state;
        }
      },
    },
    // Disable all RTK dev middleware — our mock creators lack the RTK Symbol tag.
    middleware: () => [],
  });
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

async function renderEndView(subsidies: any[] = []) {
  const store = buildStore(subsidies);
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <Provider store={store}>
        <EndView />
      </Provider>
    );
  });
  return { ...result, store };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EndView', () => {
  let svc: jest.Mocked<typeof communityService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Restore action-creator implementations after clearAllMocks().
    mockAddSubsidy   .mockImplementation((p: any)    => ({ type: 'community/addSubsidy',    payload: p }));
    mockUpdateSubsidy.mockImplementation((p: any)    => ({ type: 'community/updateSubsidy', payload: p }));
    mockRemoveSubsidy.mockImplementation((i: number) => ({ type: 'community/removeSubsidy', payload: i }));

    // Lazy reference — safe after Jest's module registry is fully set up.
    svc = jest.mocked(communityService);
    svc.getSubsidyCategories.mockResolvedValue([]);
  });

  // --- Loading state --------------------------------------------------------

  it('shows loading spinner while categories are being fetched', () => {
    svc.getSubsidyCategories.mockReturnValue(new Promise(() => {})); // never resolves
    const store = buildStore();
    render(
      <Provider store={store}>
        <EndView />
      </Provider>
    );
    expect(screen.getByText('Lade Fördermittel-Kategorien...')).toBeInTheDocument();
  });

  // --- Empty state ----------------------------------------------------------

  it('shows empty state when no subsidies exist', async () => {
    svc.getSubsidyCategories.mockResolvedValue(CATEGORIES);
    await renderEndView([]);
    expect(screen.getByText('Noch keine Fördermittel eingetragen')).toBeInTheDocument();
  });

  it('shows "Erstes Fördermittel hinzufügen" button in empty state', async () => {
    svc.getSubsidyCategories.mockResolvedValue(CATEGORIES);
    await renderEndView([]);
    expect(screen.getByText('Erstes Fördermittel hinzufügen')).toBeInTheDocument();
  });

  // --- Adding subsidies -----------------------------------------------------

  it('dispatches addSubsidy when "Erstes Fördermittel hinzufügen" clicked', async () => {
    svc.getSubsidyCategories.mockResolvedValue(CATEGORIES);
    await renderEndView([]);
    fireEvent.click(screen.getByText('Erstes Fördermittel hinzufügen'));
    expect(mockAddSubsidy).toHaveBeenCalledWith({ id: '', value: 0, unit: 'euro' });
  });

  it('dispatches addSubsidy when "Weitere" button clicked', async () => {
    svc.getSubsidyCategories.mockResolvedValue(CATEGORIES);
    // 1 subsidy, 2 categories → "Weitere" button visible once categories load.
    await renderEndView([{ id: 'cat1', value: 100, unit: 'euro' }]);
    await waitFor(() =>
      expect(screen.getByText('Weitere Fördermittel hinzufügen')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText('Weitere Fördermittel hinzufügen'));
    expect(mockAddSubsidy).toHaveBeenCalledTimes(1);
  });

  // --- All categories used --------------------------------------------------

  it('hides "Weitere" button when all categories are assigned', async () => {
    svc.getSubsidyCategories.mockResolvedValue(CATEGORIES);
    const subsidies = [
      { id: 'cat1', value: 100, unit: 'euro' },
      { id: 'cat2', value: 50,  unit: 'euro' },
    ];
    await renderEndView(subsidies);
    await waitFor(() =>
      expect(screen.queryByText('Weitere Fördermittel hinzufügen')).not.toBeInTheDocument()
    );
  });

  it('shows "all categories used" notice when fully assigned', async () => {
    svc.getSubsidyCategories.mockResolvedValue(CATEGORIES);
    const subsidies = [
      { id: 'cat1', value: 100, unit: 'euro' },
      { id: 'cat2', value: 50,  unit: 'euro' },
    ];
    await renderEndView(subsidies);
    await waitFor(() =>
      expect(
        screen.getByText(/Alle verfügbaren Fördermittel-Kategorien wurden hinzugefügt/)
      ).toBeInTheDocument()
    );
  });

  // --- Category dropdown ----------------------------------------------------

  it('renders category options in the dropdown', async () => {
    svc.getSubsidyCategories.mockResolvedValue(CATEGORIES);
    await renderEndView([{ id: '', value: 0, unit: 'euro' }]);
    await waitFor(() => {
      expect(screen.getByText('Energie')).toBeInTheDocument();
      expect(screen.getByText('Mobilität')).toBeInTheDocument();
    });
  });

  it('dispatches updateSubsidy when category selected', async () => {
    svc.getSubsidyCategories.mockResolvedValue(CATEGORIES);
    await renderEndView([{ id: '', value: 0, unit: 'euro' }]);
    // Wait for options to be rendered before interacting.
    await waitFor(() => expect(screen.getByText('Energie')).toBeInTheDocument());
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'cat1' } });
    expect(mockUpdateSubsidy).toHaveBeenCalledWith({
      index: 0,
      subsidy: { id: 'cat1', value: 0, unit: 'euro' },
    });
  });

  // --- Amount input ---------------------------------------------------------

  it('dispatches updateSubsidy when amount changed', async () => {
    svc.getSubsidyCategories.mockResolvedValue(CATEGORIES);
    await renderEndView([{ id: 'cat1', value: 0, unit: 'euro' }]);
    const input = screen.getByPlaceholderText('0');
    fireEvent.change(input, { target: { value: '500' } });
    expect(mockUpdateSubsidy).toHaveBeenCalledWith({
      index: 0,
      subsidy: { id: 'cat1', value: 500, unit: 'euro' },
    });
  });

  it('dispatches updateSubsidy with 0 for non-numeric input', async () => {
    svc.getSubsidyCategories.mockResolvedValue(CATEGORIES);
    await renderEndView([{ id: 'cat1', value: 100, unit: 'euro' }]);
    const input = screen.getByPlaceholderText('0');
    // jsdom sets e.target.value='' for non-numeric input on type=number fields.
    // The component handles this via `parseFloat('') || 0` → dispatches value:0.
    fireEvent.change(input, { target: { value: '' } });
    expect(mockUpdateSubsidy).toHaveBeenCalledWith({
      index: 0,
      subsidy: { id: 'cat1', value: 0, unit: 'euro' },
    });
  });

  // --- Unit toggle ----------------------------------------------------------

  it('dispatches updateSubsidy with unit="percent" on percent button click', async () => {
    svc.getSubsidyCategories.mockResolvedValue(CATEGORIES);
    await renderEndView([{ id: 'cat1', value: 50, unit: 'euro' }]);
    // Find the percent button by its SVG class (buttons have no text label).
    const allButtons = screen.getAllByRole('button');
    const pBtn = allButtons.find(b => b.querySelector('.lucide-percent'));
    expect(pBtn).toBeDefined();
    fireEvent.click(pBtn!);
    expect(mockUpdateSubsidy).toHaveBeenCalledWith({
      index: 0,
      subsidy: { id: 'cat1', value: 50, unit: 'percent' },
    });
  });

  // --- Remove button --------------------------------------------------------

  it('dispatches removeSubsidy on delete button click', async () => {
    svc.getSubsidyCategories.mockResolvedValue(CATEGORIES);
    await renderEndView([{ id: 'cat1', value: 100, unit: 'euro' }]);
    fireEvent.click(screen.getByTitle('Entfernen'));
    expect(mockRemoveSubsidy).toHaveBeenCalledWith(0);
  });

  // --- Completion summary ---------------------------------------------------

  it('shows completion summary when category and value are set', async () => {
    svc.getSubsidyCategories.mockResolvedValue(CATEGORIES);
    await renderEndView([{ id: 'cat1', value: 1000, unit: 'euro' }]);
    expect(screen.getByText('Zusammenfassung:')).toBeInTheDocument();
    expect(screen.getByText(/1\.000 €/)).toBeInTheDocument();
  });

  it('shows percentage in summary when unit is percent', async () => {
    svc.getSubsidyCategories.mockResolvedValue(CATEGORIES);
    await renderEndView([{ id: 'cat1', value: 30, unit: 'percent' }]);
    expect(screen.getByText(/30 %/)).toBeInTheDocument();
  });

  it('does NOT show summary when value is 0', async () => {
    svc.getSubsidyCategories.mockResolvedValue(CATEGORIES);
    await renderEndView([{ id: 'cat1', value: 0, unit: 'euro' }]);
    expect(screen.queryByText('Zusammenfassung:')).not.toBeInTheDocument();
  });

  it('does NOT show summary when category id is empty', async () => {
    svc.getSubsidyCategories.mockResolvedValue(CATEGORIES);
    await renderEndView([{ id: '', value: 500, unit: 'euro' }]);
    expect(screen.queryByText('Zusammenfassung:')).not.toBeInTheDocument();
  });

  // --- Static content -------------------------------------------------------

  it('renders the static info box', async () => {
    svc.getSubsidyCategories.mockResolvedValue(CATEGORIES);
    await renderEndView([]);
    expect(screen.getByText('Hinweis zu Fördermitteln')).toBeInTheDocument();
  });

  it('renders the section heading', async () => {
    svc.getSubsidyCategories.mockResolvedValue(CATEGORIES);
    await renderEndView([]);
    expect(screen.getByText('Fördermittel')).toBeInTheDocument();
  });

  // --- Error resilience -----------------------------------------------------

  it('does not crash when category fetch fails', async () => {
    svc.getSubsidyCategories.mockRejectedValue(new Error('fetch error'));
    await expect(renderEndView([])).resolves.not.toThrow();
    expect(screen.getByText('Fördermittel')).toBeInTheDocument();
  });
});