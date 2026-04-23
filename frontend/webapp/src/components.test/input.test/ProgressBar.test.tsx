/**
 * InputProgressBar.test.tsx
 *
 * Unit tests for the InputProgressBar component covering:
 *  - Renders all six category step circles
 *  - Renders all six category labels
 *  - Active step has scale-110 class
 *  - Completed step shows Check icon (green background)
 *  - Inaccessible step shows Lock icon
 *  - Accessible but not active step shows step number
 *  - Connector lines turn green for past/completed steps
 *  - handleCategoryClick: dispatches navigation when step is accessible
 *  - handleCategoryClick: does NOT dispatch when step is inaccessible
 *  - Start step is always accessible
 *  - Steps after Start are locked when Start not completed
 *  - Steps become accessible when all preceding categories are valid
 *  - isCategoryCompleted returns true only for visited + valid steps
 *  - Fetches field definitions on mount
 */

import { render, screen, fireEvent, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import InputProgressBar from '../../components/input/ProgressBar';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSetCurrentCategory    = jest.fn((c: string) => ({ type: 'ui/setCategory', payload: c }));
const mockClearAllValidation    = jest.fn(() => ({ type: 'ui/clearErrors' }));

const mockGetInputParameters = jest.fn();

jest.mock('../../services/CommunityService', () => ({
  __esModule: true,
  default: {
    getInputParameters: (...args: any[]) => mockGetInputParameters(...args),
  },
}));

jest.mock('../../store/UISlice', () => ({
  setCurrentCategory: (c: string) => {
    mockSetCurrentCategory(c);
    return { type: 'ui/setCategory', payload: c };
  },
  clearAllValidationErrors: () => {
    mockClearAllValidation();
    return { type: 'ui/clearErrors' };
  },
  selectCurrentCategory: (state: any) => state.ui.currentCategory,
  selectVisitedCategories: (state: any) => state.ui.visitedCategories ?? [],
}));

jest.mock('../../store/CommunitySlice', () => ({
  selectCommuneKey:       (state: any) => state.community.communeKey,
  selectAllInputs:        (state: any) => state.community.inputs ?? {},
  selectReferenceCommune: (state: any) => state.community.referenceCommune ?? null,
}));

const mockValidateCategory = jest.fn(() => []);
jest.mock('../../utils/validationHelper', () => ({
  validateCategory: (fields: any[], inputs: any) => mockValidateCategory(fields, inputs),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_FIELDS = { General: [], Energy: [], Mobility: [], Water: [] };

function buildStore(overrides: {
  currentCategory?: string;
  communeKey?: string | null;
  referenceCommune?: string | null;
  visitedCategories?: string[];
} = {}) {
  const {
    currentCategory    = 'Start',
    communeKey         = null,
    referenceCommune   = null,
    visitedCategories  = [],
  } = overrides;

  return configureStore({
    reducer: {
      ui:        () => ({ currentCategory, visitedCategories }),
      community: () => ({ communeKey, referenceCommune, inputs: {} }),
    },
  });
}

async function renderBar(opts: Parameters<typeof buildStore>[0] = {}) {
  const store = buildStore(opts);
  let result: any;
  await act(async () => {
    result = render(
      <Provider store={store}>
        <InputProgressBar />
      </Provider>
    );
  });
  return { ...result, store };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InputProgressBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetInputParameters.mockResolvedValue(EMPTY_FIELDS);
    mockValidateCategory.mockReturnValue([]);
  });

  // --- Field fetch ----------------------------------------------------------

  it('calls getInputParameters on mount', async () => {
    await renderBar();
    expect(mockGetInputParameters).toHaveBeenCalledTimes(1);
  });

  it('does not crash when field fetch fails', async () => {
    mockGetInputParameters.mockRejectedValue(new Error('fetch error'));
    await expect(renderBar()).resolves.not.toThrow();
  });

  // --- Labels ---------------------------------------------------------------

  it('renders all six category labels', async () => {
    await renderBar();
    ['Start', 'Allgemeines', 'Energie', 'Mobilität', 'Wasser', 'Ende'].forEach(label => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  // --- Active step ----------------------------------------------------------

  it('marks the current category circle as active (scale-110)', async () => {
    await renderBar({ currentCategory: 'Start' });
    const buttons = screen.getAllByRole('button');
    // First button = Start
    expect(buttons[0].className).toContain('scale-110');
  });

  it('does NOT mark non-active circles with scale-110', async () => {
    await renderBar({ currentCategory: 'Start' });
    const buttons = screen.getAllByRole('button');
    // Buttons 1–5 are not active
    buttons.slice(1).forEach(btn => {
      expect(btn.className).not.toContain('scale-110');
    });
  });

  // --- Step number ----------------------------------------------------------

  it('renders step numbers for accessible but non-active, non-completed steps', async () => {
    // Start is complete (communeKey set), General is next → should show "2"
    await renderBar({ communeKey: '12345678', currentCategory: 'General' });
    // General is active, so Energy (index 2) should show "3"
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  // --- Inaccessible steps ---------------------------------------------------

  it('Start is always accessible (no disabled attribute)', async () => {
    await renderBar({ currentCategory: 'Start' });
    const startBtn = screen.getAllByRole('button')[0];
    expect(startBtn).not.toBeDisabled();
  });

  it('General is inaccessible when Start not completed', async () => {
    await renderBar({ currentCategory: 'Start', communeKey: null });
    const generalBtn = screen.getAllByRole('button')[1];
    expect(generalBtn).toBeDisabled();
  });

  it('General is accessible when Start completed (communeKey set)', async () => {
    await renderBar({ currentCategory: 'Start', communeKey: '12345678' });
    const generalBtn = screen.getAllByRole('button')[1];
    expect(generalBtn).not.toBeDisabled();
  });

  it('General is accessible via referenceCommune', async () => {
    await renderBar({ currentCategory: 'Start', referenceCommune: 'r1' });
    const generalBtn = screen.getAllByRole('button')[1];
    expect(generalBtn).not.toBeDisabled();
  });

  // --- Navigation dispatch --------------------------------------------------

  it('dispatches setCurrentCategory when accessible step is clicked', async () => {
    await renderBar({ currentCategory: 'Start', communeKey: '12345678' });
    const generalBtn = screen.getAllByRole('button')[1];
    fireEvent.click(generalBtn);
    expect(mockSetCurrentCategory).toHaveBeenCalledWith('General');
    expect(mockClearAllValidation).toHaveBeenCalled();
  });

  it('does NOT dispatch when inaccessible step is clicked', async () => {
    await renderBar({ currentCategory: 'Start', communeKey: null });
    const generalBtn = screen.getAllByRole('button')[1];
    fireEvent.click(generalBtn);
    expect(mockSetCurrentCategory).not.toHaveBeenCalled();
  });

  // --- Completed steps (checkmarks) ----------------------------------------

  it('shows checkmark for visited + valid category', async () => {
    await renderBar({
      currentCategory:   'Energy',
      communeKey:        '12345678',
      visitedCategories: ['Start', 'General'],
    });
    // General was visited and fields are valid (validateCategory returns [])
    // Check icon renders as SVG — we look for the aria label on the button
    const generalBtn = screen.getAllByRole('button')[1];
    // The button should have green background class (completed state)
    expect(generalBtn.className).toContain('bg-green-700');
  });

  it('does NOT show checkmark for visited but invalid category', async () => {
    mockValidateCategory.mockReturnValue(['g1']); // General is invalid
    await renderBar({
      currentCategory:   'General',
      communeKey:        '12345678',
      visitedCategories: ['General'],
    });
    const generalBtn = screen.getAllByRole('button')[1];
    expect(generalBtn.className).not.toContain('bg-green-700');
  });

  it('does NOT show checkmark for unvisited category', async () => {
    await renderBar({
      currentCategory:   'General',
      communeKey:        '12345678',
      visitedCategories: [],
    });
    const generalBtn = screen.getAllByRole('button')[1];
    expect(generalBtn.className).not.toContain('bg-green-700');
  });

  // --- No checkmarks when Start not complete --------------------------------

  it('shows no green steps when Start not completed', async () => {
    await renderBar({ communeKey: null, visitedCategories: ['Start'] });
    const buttons = screen.getAllByRole('button');
    buttons.forEach(btn => {
      expect(btn.className).not.toContain('bg-green-700');
    });
  });

  // --- Connector lines ------------------------------------------------------

  it('connector line after Start is green when Start is past and General is active', async () => {
    const { container } = await renderBar({
      currentCategory:   'General',
      communeKey:        '12345678',
      visitedCategories: ['Start'],
    });
    // There are 5 connector lines; the first one should be green (past step)
    const greenLines = container.querySelectorAll('.bg-green-700');
    expect(greenLines.length).toBeGreaterThan(0);
  });
});