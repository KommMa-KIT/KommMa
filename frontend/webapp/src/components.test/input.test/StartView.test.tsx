/**
 * StartView.test.tsx
 */

import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import StartView from '../../components/input/StartView';
import communityService from '../../services/CommunityService';

// ---------------------------------------------------------------------------
// Redux slice mocks
// ---------------------------------------------------------------------------

const mockSetCommuneKey = jest.fn((v: string) => ({
  type: 'community/setCommuneKey',
  payload: v,
}));
const mockSetCommuneName = jest.fn((v: string) => ({
  type: 'community/setCommuneName',
  payload: v,
}));
const mockSetPostalCode = jest.fn((v: string) => ({
  type: 'community/setPostalCode',
  payload: v,
}));
const mockResetInputs = jest.fn(() => ({
  type: 'community/resetInputs',
}));

const mockFetchCommuneByKey = jest.fn();
const mockFetchCommuneByCode = jest.fn();
const mockFetchPrefillData = jest.fn();
const mockFetchAverageData = jest.fn();
const mockFetchReferenceCommune = jest.fn();

const mockResetVisitedCategories = jest.fn(() => ({
  type: 'ui/resetVisited',
}));

jest.mock('../../store/CommunitySlice', () => ({
  setCommuneKey: (v: string) => mockSetCommuneKey(v),
  setCommuneName: (v: string) => mockSetCommuneName(v),
  setPostalCode: (v: string) => mockSetPostalCode(v),
  resetInputs: () => mockResetInputs(),
  fetchCommuneByKey: (v: string) => mockFetchCommuneByKey(v),
  fetchCommuneByCode: (v: string) => mockFetchCommuneByCode(v),
  fetchPrefillData: (v: string) => mockFetchPrefillData(v),
  fetchAverageData: () => mockFetchAverageData(),
  fetchReferenceCommune: (v: string) => mockFetchReferenceCommune(v),
  selectCommuneKey: (s: any) => s.community.communeKey,
  selectCommuneName: (s: any) => s.community.communeName,
  selectPostalCode: (s: any) => s.community.postalCode,
  selectLoading: (s: any) => s.community.loading,
  selectError: (s: any) => s.community.error,
}));

jest.mock('../../store/UISlice', () => ({
  resetVisitedCategories: () => mockResetVisitedCategories(),
}));

// ---------------------------------------------------------------------------
// CommunityService mock
// ---------------------------------------------------------------------------

jest.mock('../../services/CommunityService', () => ({
  __esModule: true,
  default: {
    searchCommunes: jest.fn().mockResolvedValue([]),
    getReferenceCommunesList: jest.fn().mockResolvedValue([]),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_COMMUNE = {
  name: 'Karlsruhe',
  key: '08212000',
  postal_code: '76133',
};

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

interface StoreOpts {
  communeKey?: string | null;
  communeName?: string;
  postalCode?: string;
  loading?: boolean;
  error?: string | null;
}

function buildStore(opts: StoreOpts = {}) {
  const {
    communeKey = null,
    communeName = '',
    postalCode = '',
    loading = false,
    error = null,
  } = opts;

  return configureStore({
    reducer: {
      community: (
        state = { communeKey, communeName, postalCode, loading, error },
        action: any
      ) => {
        switch (action.type) {
          case 'community/setCommuneKey':
            return { ...state, communeKey: action.payload };
          case 'community/setCommuneName':
            return { ...state, communeName: action.payload };
          case 'community/setPostalCode':
            return { ...state, postalCode: action.payload };
          case 'community/resetInputs':
            return { ...state };
          default:
            return state;
        }
      },
      ui: (state = {}) => state,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
        immutableCheck: false,
      }),
  });
}

async function renderStartView(opts: StoreOpts = {}) {
  const store = buildStore(opts);
  let result!: ReturnType<typeof render>;

  await act(async () => {
    result = render(
      <Provider store={store}>
        <StartView />
      </Provider>
    );
  });

  return { ...result, store };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StartView', () => {
  let svc: jest.Mocked<typeof communityService>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    svc = jest.mocked(communityService);
    svc.searchCommunes.mockResolvedValue([]);
    svc.getReferenceCommunesList.mockResolvedValue([]);

    mockSetCommuneKey.mockImplementation((v: string) => ({
      type: 'community/setCommuneKey',
      payload: v,
    }));
    mockSetCommuneName.mockImplementation((v: string) => ({
      type: 'community/setCommuneName',
      payload: v,
    }));
    mockSetPostalCode.mockImplementation((v: string) => ({
      type: 'community/setPostalCode',
      payload: v,
    }));
    mockResetInputs.mockImplementation(() => ({
      type: 'community/resetInputs',
    }));
    mockResetVisitedCategories.mockImplementation(() => ({
      type: 'ui/resetVisited',
    }));

    mockFetchCommuneByKey.mockImplementation(
      (_value: string) => () => ({
        unwrap: () => Promise.resolve(DEFAULT_COMMUNE),
        then: (fn: (v: typeof DEFAULT_COMMUNE) => unknown) =>
          Promise.resolve(DEFAULT_COMMUNE).then(fn),
      })
    );

    mockFetchCommuneByCode.mockImplementation(
      (_value: string) => () => ({
        unwrap: () => Promise.resolve(DEFAULT_COMMUNE),
        then: (fn: (v: typeof DEFAULT_COMMUNE) => unknown) =>
          Promise.resolve(DEFAULT_COMMUNE).then(fn),
      })
    );

    mockFetchPrefillData.mockImplementation(
      (_value: string) => async () => ({})
    );

    mockFetchAverageData.mockImplementation(
      () => async () => ({})
    );

    mockFetchReferenceCommune.mockImplementation(
      (_value: string) => async () => ({})
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Static content
  // -------------------------------------------------------------------------

  it('renders the page heading', async () => {
    await renderStartView();
    expect(screen.getByText('Gemeinde auswählen')).toBeInTheDocument();
  });

  it('renders the AGS input section', async () => {
    await renderStartView();
    expect(screen.getByText('Amtlicher Gemeindeschlüssel (AGS)')).toBeInTheDocument();
  });

  it('renders the name input section', async () => {
    await renderStartView();
    expect(screen.getByText('Name der Kommune')).toBeInTheDocument();
  });

  it('renders the postal code input section', async () => {
    await renderStartView();
    expect(screen.getByText('Postleitzahl')).toBeInTheDocument();
  });

  it('renders the reference commune selector', async () => {
    await renderStartView();
    expect(screen.getByText('Prototypische Kommune (Optional)')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Inputs: basic behaviour
  // -------------------------------------------------------------------------

  it('AGS input has maxLength=8', async () => {
    await renderStartView();
    expect(screen.getByPlaceholderText('z.B. 08212000')).toHaveAttribute('maxlength', '8');
  });

  it('PLZ input has maxLength=5', async () => {
    await renderStartView();
    expect(screen.getByPlaceholderText('z.B. 76133')).toHaveAttribute('maxlength', '5');
  });

  it('updates AGS input value on change', async () => {
    await renderStartView();
    const input = screen.getByPlaceholderText('z.B. 08212000') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { value: '1234' } });
    });

    expect(input.value).toBe('1234');
  });

  it('dispatches setCommuneKey on AGS input change', async () => {
    await renderStartView();
    const input = screen.getByPlaceholderText('z.B. 08212000');

    await act(async () => {
      fireEvent.change(input, { target: { value: '1234' } });
    });

    expect(mockSetCommuneKey).toHaveBeenCalledWith('1234');
  });

  it('dispatches setPostalCode on PLZ input change', async () => {
    await renderStartView();
    const input = screen.getByPlaceholderText('z.B. 76133');

    await act(async () => {
      fireEvent.change(input, { target: { value: '761' } });
    });

    expect(mockSetPostalCode).toHaveBeenCalledWith('761');
  });

  it('dispatches setCommuneName on name input change', async () => {
    await renderStartView();
    const input = screen.getByPlaceholderText('z.B. Karlsruhe');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Berlin' } });
    });

    expect(mockSetCommuneName).toHaveBeenCalledWith('Berlin');
  });

  // -------------------------------------------------------------------------
  // Redux prefill
  // -------------------------------------------------------------------------

  it('pre-fills AGS input from Redux communeKey', async () => {
    await renderStartView({ communeKey: '08212000' });
    expect(screen.getByPlaceholderText('z.B. 08212000')).toHaveValue('08212000');
  });

  it('pre-fills name input from Redux communeName', async () => {
    await renderStartView({ communeName: 'Karlsruhe' });
    expect(screen.getByPlaceholderText('z.B. Karlsruhe')).toHaveValue('Karlsruhe');
  });

  it('pre-fills PLZ input from Redux postalCode', async () => {
    await renderStartView({ postalCode: '76133' });
    expect(screen.getByPlaceholderText('z.B. 76133')).toHaveValue('76133');
  });

  // -------------------------------------------------------------------------
  // Error / loading
  // -------------------------------------------------------------------------

  it('shows error banner when Redux error is set', async () => {
    await renderStartView({ error: 'Keine Daten gefunden' });
    expect(screen.getByText('Keine Daten gefunden')).toBeInTheDocument();
  });

  it('does NOT show error banner when error is null', async () => {
    await renderStartView({ error: null });
    expect(screen.queryByText('Keine Daten gefunden')).not.toBeInTheDocument();
  });

  it('shows loading spinner when loading is true', async () => {
    await renderStartView({ loading: true });
    expect(screen.getByText('Lade Gemeindedaten...')).toBeInTheDocument();
  });

  it('does NOT show loading spinner when loading is false', async () => {
    await renderStartView({ loading: false });
    expect(screen.queryByText('Lade Gemeindedaten...')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Name autocomplete / debounce
  // -------------------------------------------------------------------------

  it('does not search on initial mount', async () => {
    await renderStartView();

    await act(async () => {
      jest.runAllTimers();
    });
    await flushPromises();

    expect(svc.searchCommunes).not.toHaveBeenCalled();
  });

  it('does not search when fewer than 2 chars are entered', async () => {
    await renderStartView();
    const input = screen.getByPlaceholderText('z.B. Karlsruhe');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'B' } });
      jest.advanceTimersByTime(300);
    });
    await flushPromises();

    expect(svc.searchCommunes).not.toHaveBeenCalled();
    expect(screen.queryByText('Berlin')).not.toBeInTheDocument();
  });

  it('searches only after the debounce delay', async () => {
    await renderStartView();
    const input = screen.getByPlaceholderText('z.B. Karlsruhe');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Be' } });
      jest.advanceTimersByTime(299);
    });
    await flushPromises();

    expect(svc.searchCommunes).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    await flushPromises();

    expect(svc.searchCommunes).toHaveBeenCalledWith('Be');
  });

  it('shows autocomplete suggestions after debounce when 2+ chars entered', async () => {
    svc.searchCommunes.mockResolvedValue([
      { key: '11000000', name: 'Berlin', postal_code: '10115' },
    ]);

    await renderStartView();
    const input = screen.getByPlaceholderText('z.B. Karlsruhe');

    await act(async () => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'Be' } });
      jest.advanceTimersByTime(300);
    });
    await flushPromises();

    expect(screen.getByText('Berlin')).toBeInTheDocument();
    expect(screen.getByText(/AGS: 11000000 · PLZ: 10115/)).toBeInTheDocument();
  });

  it('logs and clears suggestions when name search fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    svc.searchCommunes.mockRejectedValue(new Error('search failed'));

    await renderStartView();
    const input = screen.getByPlaceholderText('z.B. Karlsruhe');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Be' } });
      jest.advanceTimersByTime(300);
    });
    await flushPromises();

    expect(errorSpy).toHaveBeenCalled();
    expect(screen.queryByText('Berlin')).not.toBeInTheDocument();

    errorSpy.mockRestore();
  });

  it('reopens existing suggestions on focus when debounced name has at least 2 characters', async () => {
    svc.searchCommunes.mockResolvedValue([
      { key: '11000000', name: 'Berlin', postal_code: '10115' },
    ]);

    await renderStartView();
    const input = screen.getByPlaceholderText('z.B. Karlsruhe');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Be' } });
      jest.advanceTimersByTime(300);
    });
    await flushPromises();

    expect(screen.getByText('Berlin')).toBeInTheDocument();

    await act(async () => {
      fireEvent.blur(input);
      jest.advanceTimersByTime(150);
    });
    await flushPromises();

    expect(screen.queryByText('Berlin')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.focus(input);
    });
    await flushPromises();

    expect(screen.getByText('Berlin')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Suggestion selection
  // -------------------------------------------------------------------------

  it('selecting a suggestion populates all fields and triggers prefill fetches', async () => {
    svc.searchCommunes.mockResolvedValue([
      { key: '11000000', name: 'Berlin', postal_code: '10115' },
    ]);

    await renderStartView();

    const nameInput = screen.getByPlaceholderText('z.B. Karlsruhe');
    const keyInput = screen.getByPlaceholderText('z.B. 08212000');
    const codeInput = screen.getByPlaceholderText('z.B. 76133');

    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Be' } });
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByText('Berlin')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.mouseDown(screen.getByText('Berlin'));
    });

    await waitFor(() => expect(nameInput).toHaveValue('Berlin'));
    await waitFor(() => expect(keyInput).toHaveValue('11000000'));
    await waitFor(() => expect(codeInput).toHaveValue('10115'));

    expect(mockSetCommuneName).toHaveBeenCalledWith('Berlin');
    expect(mockSetCommuneKey).toHaveBeenCalledWith('11000000');
    expect(mockSetPostalCode).toHaveBeenCalledWith('10115');

    expect(mockResetInputs).toHaveBeenCalled();
    expect(mockResetVisitedCategories).toHaveBeenCalled();
    expect(mockFetchPrefillData).toHaveBeenCalledWith('11000000');
    expect(mockFetchAverageData).toHaveBeenCalled();
  });

  it('suppresses an immediate re-search after selecting a suggestion', async () => {
    svc.searchCommunes.mockResolvedValue([
      { key: '11000000', name: 'Berlin', postal_code: '10115' },
    ]);

    await renderStartView();
    const input = screen.getByPlaceholderText('z.B. Karlsruhe');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Be' } });
      jest.advanceTimersByTime(300);
    });
    await flushPromises();

    expect(svc.searchCommunes).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.mouseDown(screen.getByText('Berlin'));
    });

    await waitFor(() => {
      expect(input).toHaveValue('Berlin');
    });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await flushPromises();

    expect(svc.searchCommunes).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // AGS lookup
  // -------------------------------------------------------------------------

  it('does not fetch commune by key before 8 digits are entered', async () => {
    await renderStartView();
    const input = screen.getByPlaceholderText('z.B. 08212000');

    await act(async () => {
      fireEvent.change(input, { target: { value: '0821200' } });
    });
    await flushPromises();

    expect(mockFetchCommuneByKey).not.toHaveBeenCalled();
    expect(mockFetchPrefillData).not.toHaveBeenCalled();
    expect(mockFetchAverageData).not.toHaveBeenCalled();
  });

  it('fetches commune by key after 8 digits and populates name and postal code', async () => {
    await renderStartView();

    const keyInput = screen.getByPlaceholderText('z.B. 08212000');
    const nameInput = screen.getByPlaceholderText('z.B. Karlsruhe');
    const codeInput = screen.getByPlaceholderText('z.B. 76133');

    await act(async () => {
      fireEvent.change(keyInput, { target: { value: '08212000' } });
    });

    expect(mockFetchCommuneByKey).toHaveBeenCalledWith('08212000');

    await waitFor(() => expect(nameInput).toHaveValue('Karlsruhe'));
    await waitFor(() => expect(codeInput).toHaveValue('76133'));

    expect(mockResetInputs).toHaveBeenCalled();
    expect(mockResetVisitedCategories).toHaveBeenCalled();
    expect(mockFetchPrefillData).toHaveBeenCalledWith('08212000');
    expect(mockFetchAverageData).toHaveBeenCalled();
  });

  it('suppresses name autocomplete after programmatic AGS lookup name update', async () => {
    await renderStartView();
    const keyInput = screen.getByPlaceholderText('z.B. 08212000');

    await act(async () => {
      fireEvent.change(keyInput, { target: { value: '08212000' } });
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('z.B. Karlsruhe')).toHaveValue('Karlsruhe');
    });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await flushPromises();

    expect(svc.searchCommunes).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // PLZ lookup
  // -------------------------------------------------------------------------

  it('does not fetch commune by postal code before 5 digits are entered', async () => {
    await renderStartView();
    const input = screen.getByPlaceholderText('z.B. 76133');

    await act(async () => {
      fireEvent.change(input, { target: { value: '7613' } });
    });
    await flushPromises();

    expect(mockFetchCommuneByCode).not.toHaveBeenCalled();
    expect(mockFetchPrefillData).not.toHaveBeenCalled();
    expect(mockFetchAverageData).not.toHaveBeenCalled();
  });

  it('fetches commune by postal code after 5 digits when no communeKey exists', async () => {
    await renderStartView();

    const keyInput = screen.getByPlaceholderText('z.B. 08212000');
    const nameInput = screen.getByPlaceholderText('z.B. Karlsruhe');
    const codeInput = screen.getByPlaceholderText('z.B. 76133');

    await act(async () => {
      fireEvent.change(codeInput, { target: { value: '76133' } });
    });

    expect(mockFetchCommuneByCode).toHaveBeenCalledWith('76133');

    await waitFor(() => expect(keyInput).toHaveValue('08212000'));
    await waitFor(() => expect(nameInput).toHaveValue('Karlsruhe'));

    expect(mockResetInputs).toHaveBeenCalled();
    expect(mockResetVisitedCategories).toHaveBeenCalled();
    expect(mockFetchPrefillData).toHaveBeenCalledWith('08212000');
    expect(mockFetchAverageData).toHaveBeenCalled();
  });

  it('does not fetch commune by postal code when communeKey already exists', async () => {
    await renderStartView({ communeKey: '08212000' });
    const codeInput = screen.getByPlaceholderText('z.B. 76133');

    await act(async () => {
      fireEvent.change(codeInput, { target: { value: '76133' } });
    });
    await flushPromises();

    expect(mockFetchCommuneByCode).not.toHaveBeenCalled();
  });

  it('does not overwrite an already typed local name during postal code lookup', async () => {
    await renderStartView();
    const nameInput = screen.getByPlaceholderText('z.B. Karlsruhe');
    const codeInput = screen.getByPlaceholderText('z.B. 76133');

    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Mein Testname' } });
    });

    await act(async () => {
      fireEvent.change(codeInput, { target: { value: '76133' } });
    });

    expect(mockFetchCommuneByCode).toHaveBeenCalledWith('76133');
    await waitFor(() => expect(nameInput).toHaveValue('Mein Testname'));
  });

  // -------------------------------------------------------------------------
  // Reference communes
  // -------------------------------------------------------------------------

  it('loads reference communes on mount', async () => {
    svc.getReferenceCommunesList.mockResolvedValue([
      { id: 'r1', name: 'Musterstadt', population: 5000, description: 'desc' },
    ]);

    await renderStartView();

    await waitFor(() => {
      expect(screen.getByText(/Musterstadt/)).toBeInTheDocument();
    });
  });

  it('has "Keine" default option in reference dropdown', async () => {
    await renderStartView();

    expect(
      screen.getByRole('option', { name: /Keine \(eigene Daten verwenden\)/ })
    ).toBeInTheDocument();
  });

  it('logs an error when loading reference communes fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    svc.getReferenceCommunesList.mockRejectedValue(new Error('load failed'));

    await renderStartView();
    await flushPromises();

    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('selecting a specific reference commune resets inputs and fetches reference data', async () => {
    svc.getReferenceCommunesList.mockResolvedValue([
      { id: 'r1', name: 'Musterstadt', population: 5000, description: 'desc' },
    ]);

    await renderStartView();

    await waitFor(() => {
      expect(screen.getByText(/Musterstadt/)).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');

    await act(async () => {
      fireEvent.change(select, { target: { value: 'r1' } });
    });

    await waitFor(() => {
      expect(mockFetchReferenceCommune).toHaveBeenCalledWith('r1');
    });

    expect(mockResetInputs).toHaveBeenCalled();
    expect(mockResetVisitedCategories).toHaveBeenCalled();
  });

  it('selecting "none" re-fetches actual commune prefill data when communeKey exists', async () => {
    await renderStartView({ communeKey: '08212000' });

    const select = screen.getByRole('combobox');

    await act(async () => {
      fireEvent.change(select, { target: { value: 'none' } });
    });

    await waitFor(() => {
      expect(mockFetchPrefillData).toHaveBeenCalledWith('08212000');
    });

    expect(mockResetInputs).toHaveBeenCalled();
    expect(mockResetVisitedCategories).toHaveBeenCalled();
    expect(mockFetchAverageData).toHaveBeenCalled();
  });

  it('selecting "none" does not fetch prefill data when no communeKey exists', async () => {
    await renderStartView({ communeKey: null });

    const select = screen.getByRole('combobox');

    await act(async () => {
      fireEvent.change(select, { target: { value: 'none' } });
    });
    await flushPromises();

    expect(mockFetchPrefillData).not.toHaveBeenCalled();
    expect(mockFetchAverageData).not.toHaveBeenCalled();
  });
});