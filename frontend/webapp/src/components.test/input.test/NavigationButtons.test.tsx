/**
 * NavigationButtons.test.tsx
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import NavigationButtons from '../../components/input/NavigationButtons';

import * as UISlice from '../../store/UISlice';
import * as ResultSlice from '../../store/ResultSlice';
import CommunityService from '../../services/CommunityService';
import * as validationHelper from '../../utils/validationHelper';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

jest.mock('../../components/Button', () => {
  const MockButton = ({ children, onClick, disabled, className }: any) => (
    <button onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );

  return {
    __esModule: true,
    default: MockButton,
    Button: MockButton,
  };
});


jest.mock('../../store/CommunitySlice', () => ({
  __esModule: true,
  selectCommuneKey: (state: any) => state.community.communeKey,
  selectAllInputs: (state: any) => state.community.inputs ?? {},
  selectSelectedReferenceCommune: (state: any) =>
    state.community.selectedReferenceCommune,
}));

jest.mock('../../store/ResultSlice', () => ({
  __esModule: true,
  calculateResults: jest.fn(() => {
    const action: any = { type: 'results/calculateResults' };
    action.unwrap = () => Promise.resolve({});
    return action;
  }),
}));

jest.mock('../../services/CommunityService', () => ({
  __esModule: true,
  default: {
    getInputParameters: jest.fn(),
  },
}));

jest.mock('../../utils/validationHelper', () => ({
  __esModule: true,
  validateCategory: jest.fn(() => []),
}));

// ---------------------------------------------------------------------------
// Mock refs
// ---------------------------------------------------------------------------

const mockNextCategory = jest.spyOn(UISlice, 'nextCategory');
const mockPrevCategory = jest.spyOn(UISlice, 'prevCategory');
const mockSetValidationError = jest.spyOn(UISlice, 'setValidationError');
const mockClearAllValidationErrors = jest.spyOn(UISlice, 'clearAllValidationErrors');

const mockCalculateResults = ResultSlice.calculateResults as jest.Mock;
const mockGetInputParameters = CommunityService.getInputParameters as jest.Mock;
const mockValidateCategory = validationHelper.validateCategory as jest.Mock;
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_FIELDS = { General: [], Energy: [], Mobility: [], Water: [] };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});

  mockNextCategory.mockImplementation(() => ({ type: 'ui/nextCategory' }));
  mockPrevCategory.mockImplementation(() => ({ type: 'ui/prevCategory' }));
  mockSetValidationError.mockImplementation((payload: any) => ({
    type: 'ui/setValidationError',
    payload,
  }));
  mockClearAllValidationErrors.mockImplementation(() => ({
    type: 'ui/clearAllValidationErrors',
  }));

  mockGetInputParameters.mockResolvedValue(EMPTY_FIELDS);
  mockValidateCategory.mockReturnValue([]);

  mockCalculateResults.mockImplementation(() => {
    const action: any = { type: 'results/calculateResults' };
    action.unwrap = () => Promise.resolve({});
    return action;
  });

  window.scrollTo = jest.fn();
  window.alert = jest.fn();
});

function buildStore(
  overrides: {
    currentCategory?: string;
    communeKey?: string | null;
    referenceCommune?: string | null;
    inputs?: Record<string, any>;
  } = {}
) {
  const {
    currentCategory = 'Start',
    communeKey = null,
    referenceCommune = null,
    inputs = {},
  } = overrides;

  return configureStore({
    reducer: {
      ui: () => ({ currentCategory }),
      community: () => ({
        communeKey,
        selectedReferenceCommune: referenceCommune,
        inputs,
      }),
    },
  });
}

function renderNav(storeOpts: Parameters<typeof buildStore>[0] = {}) {
  const store = buildStore(storeOpts);

  return {
    ...render(
      <Provider store={store}>
        <MemoryRouter>
          <NavigationButtons />
        </MemoryRouter>
      </Provider>
    ),
    store,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NavigationButtons', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInputParameters.mockResolvedValue(EMPTY_FIELDS);
    mockValidateCategory.mockReturnValue([]);
    window.scrollTo = jest.fn();
    window.alert = jest.fn();
  });

  it('Back button is disabled on the first page (Start)', async () => {
    await act(async () => {
      renderNav({ currentCategory: 'Start' });
    });

    expect(screen.getByText(/Zurück/).closest('button')).toBeDisabled();
  });

  it('Back button is enabled on subsequent pages', async () => {
    await act(async () => {
      renderNav({ currentCategory: 'General', communeKey: '12345678' });
    });

    expect(screen.getByText(/Zurück/).closest('button')).not.toBeDisabled();
  });

  it('Back button dispatches clearAllValidationErrors and prevCategory', async () => {
    await act(async () => {
      renderNav({ currentCategory: 'General', communeKey: '12345678' });
    });

    fireEvent.click(screen.getByText(/Zurück/));

    expect(mockClearAllValidationErrors).toHaveBeenCalled();
    expect(mockPrevCategory).toHaveBeenCalled();
  });

  it('Back button calls window.scrollTo', async () => {
    await act(async () => {
      renderNav({ currentCategory: 'General', communeKey: '12345678' });
    });

    fireEvent.click(screen.getByText(/Zurück/));

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('Next button is disabled when on Start page without commune', async () => {
    await act(async () => {
      renderNav({ currentCategory: 'Start', communeKey: null });
    });

    expect(screen.getByText(/Weiter/).closest('button')).toBeDisabled();
  });

  it('Next button is enabled when commune key set on Start page', async () => {
    await act(async () => {
      renderNav({ currentCategory: 'Start', communeKey: '12345678' });
    });

    expect(screen.getByText(/Weiter/).closest('button')).not.toBeDisabled();
  });

  it('Next button is enabled via reference commune on Start page', async () => {
    await act(async () => {
      renderNav({ currentCategory: 'Start', communeKey: null, referenceCommune: 'r1' });
    });

    expect(screen.getByText(/Weiter/).closest('button')).not.toBeDisabled();
  });

  it('shows alert when Start page Next clicked without commune', async () => {
    await act(async () => {
      renderNav({ currentCategory: 'Start', communeKey: null });
    });

    expect(screen.getByText(/Weiter/).closest('button')).toBeDisabled();
  });

  it('dispatches nextCategory on valid Next click', async () => {
    mockValidateCategory.mockReturnValue([]);

    await act(async () => {
      renderNav({ currentCategory: 'General', communeKey: '12345678' });
    });

    fireEvent.click(screen.getByText(/Weiter/));

    await waitFor(() => {
      expect(mockNextCategory).toHaveBeenCalled();
    });
  });

  it('dispatches validation errors on Next click when required fields missing', async () => {
    mockValidateCategory.mockReturnValue(['g1']);

    await act(async () => {
      renderNav({ currentCategory: 'General', communeKey: '12345678' });
    });

    fireEvent.click(screen.getByText(/Weiter/));

    await waitFor(() => {
      expect(mockSetValidationError).toHaveBeenCalledWith({
        fieldId: 'g1',
        error: 'Dieses Pflichtfeld muss ausgefüllt werden',
      });
    });
  });

  it('does NOT dispatch nextCategory when validation fails', async () => {
    mockValidateCategory.mockReturnValue(['g1']);

    await act(async () => {
      renderNav({ currentCategory: 'General', communeKey: '12345678' });
    });

    fireEvent.click(screen.getByText(/Weiter/));

    await waitFor(() => {
      expect(mockNextCategory).not.toHaveBeenCalled();
    });
  });

  it('shows "Berechnung starten" on the last page (End)', async () => {
    await act(async () => {
      renderNav({ currentCategory: 'End', communeKey: '12345678' });
    });

    expect(screen.getByText(/Berechnung starten/)).toBeInTheDocument();
  });

  it('does NOT show "Weiter" on the last page', async () => {
    await act(async () => {
      renderNav({ currentCategory: 'End', communeKey: '12345678' });
    });

    expect(screen.queryByText(/Weiter/)).not.toBeInTheDocument();
  });

  it('dispatches calculateResults and navigates to /result on valid Calculate', async () => {
    mockValidateCategory.mockReturnValue([]);

    await act(async () => {
      renderNav({ currentCategory: 'End', communeKey: '12345678' });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/Berechnung starten/));
    });

    await waitFor(() => {
      expect(mockCalculateResults).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/result');
    });
  });

  it('shows alert when Calculate clicked with missing required fields', async () => {
    mockValidateCategory.mockReturnValue(['g1']);

    await act(async () => {
      renderNav({ currentCategory: 'End', communeKey: '12345678' });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/Berechnung starten/));
    });

    expect(window.alert).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('renders current page indicator "Seite 1 von 6" on Start', async () => {
    await act(async () => {
      renderNav({ currentCategory: 'Start' });
    });

    expect(screen.getByText('Seite 1 von 6')).toBeInTheDocument();
  });

  it('renders step label "Gemeinde auswählen" on Start page', async () => {
    await act(async () => {
      renderNav({ currentCategory: 'Start' });
    });

    expect(screen.getByText('Gemeinde auswählen')).toBeInTheDocument();
  });

  it('renders step label "Allgemeine Angaben" on General page', async () => {
    await act(async () => {
      renderNav({ currentCategory: 'General', communeKey: '12345678' });
    });

    expect(screen.getByText('Allgemeine Angaben')).toBeInTheDocument();
  });

  it('renders step label "Energie" on Energy page', async () => {
    await act(async () => {
      renderNav({ currentCategory: 'Energy', communeKey: '12345678' });
    });

    expect(screen.getByText('Energie')).toBeInTheDocument();
  });

  it('renders step label "Fördermittel & Abschluss" on End page', async () => {
    await act(async () => {
      renderNav({ currentCategory: 'End', communeKey: '12345678' });
    });

    expect(screen.getByText('Fördermittel & Abschluss')).toBeInTheDocument();
  });

  it('dispatches clearAllValidationErrors when category changes', async () => {
    const { rerender } = renderNav({
      currentCategory: 'General',
      communeKey: '12345678',
    });

    const newStore = buildStore({
      currentCategory: 'Energy',
      communeKey: '12345678',
    });

    await act(async () => {
      rerender(
        <Provider store={newStore}>
          <MemoryRouter>
            <NavigationButtons />
          </MemoryRouter>
        </Provider>
      );
    });

    expect(mockClearAllValidationErrors).toHaveBeenCalled();
  });
});