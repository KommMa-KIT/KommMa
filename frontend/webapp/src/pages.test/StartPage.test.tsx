/**
 * StartPage.test.tsx
 *
 * Unit tests for the StartPage component covering:
 *  - Outdated-data warning banner (shown/hidden)
 *  - Fetch-failure error banner
 *  - Reference commune loading states (spinner, card grid, empty state)
 *  - Navigation to /input on "Neue Analyse starten"
 *  - Import button render
 *  - handleSelectReferenceCommune: dispatch + navigation
 *  - formatDate helper via banner output
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import StartPage from '../../src/pages/StartPage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../src/components/Button', () =>
  ({ children, onClick, size, variant, className }: any) => (
    <button onClick={onClick} className={className}>{children}</button>
  )
);

jest.mock('../../src/components/ImportButton', () =>
  ({ children }: { children: (fn: () => void) => React.ReactNode }) => (
    <div data-testid="import-button">{children(jest.fn())}</div>
  )
);

jest.mock('../../src/components/ReferenceCommuneCard', () =>
  ({ commune, onSelect }: any) => (
    <div data-testid={`commune-card-${commune.id}`} onClick={onSelect}>
      {commune.name}
    </div>
  )
);

const mockFetchReferenceCommune = jest.fn();
const mockSetCurrentCategory    = jest.fn();

jest.mock('../../src/store/CommunitySlice', () => ({
  fetchReferenceCommune: (id: string) => mockFetchReferenceCommune(id),
}));

jest.mock('../../src/store/UISlice', () => ({
  setCurrentCategory: (c: string) => mockSetCurrentCategory(c),
}));

// Controllable fetch mock — reassigned per test in beforeEach
let fetchImpl: () => Promise<any>;
global.fetch = jest.fn(() => fetchImpl()) as any;

const mockGetReferenceCommunesList = jest.fn();
jest.mock('../../src/services/CommunityService', () => ({
  communityService: { getReferenceCommunesList: () => mockGetReferenceCommunesList() },
}));

jest.mock('../../src/config', () => ({ API_BASE_URL: 'http://localhost' }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COMMUNES = [
  { id: 'r1', name: 'Musterstadt', population: 10000, description: 'desc1' },
  { id: 'r2', name: 'Beispielort', population: 5000,  description: 'desc2' },
];

function buildStore() {
  return configureStore({ reducer: { community: () => ({}), ui: () => ({}) } });
}

function renderPage() {
  const store = buildStore();
  return render(
    <MemoryRouter>
      <Provider store={store}>
        <StartPage />
      </Provider>
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StartPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore fetch mock after clearAllMocks resets it
    (global.fetch as jest.Mock).mockImplementation(() => fetchImpl());
    // Default: plain action objects so dispatch() never throws
    mockFetchReferenceCommune.mockReturnValue({ type: 'community/fetchReference' });
    mockSetCurrentCategory.mockReturnValue({ type: 'ui/setCurrentCategory' });
  });

  // --- Static hero content --------------------------------------------------

  it('renders the KommMa heading', async () => {
    fetchImpl = () => Promise.resolve({ ok: true, json: async () => [] });
    mockGetReferenceCommunesList.mockResolvedValue([]);
    await act(async () => renderPage());
    expect(screen.getByText('KommMa')).toBeInTheDocument();
  });

  it('renders the subtitle', async () => {
    fetchImpl = () => Promise.resolve({ ok: true, json: async () => [] });
    mockGetReferenceCommunesList.mockResolvedValue([]);
    await act(async () => renderPage());
    expect(screen.getByText('Interaktives Tool für Klimaschutzmaßnahmen')).toBeInTheDocument();
  });

  it('renders "Neue Analyse starten" button', async () => {
    fetchImpl = () => Promise.resolve({ ok: true, json: async () => [] });
    mockGetReferenceCommunesList.mockResolvedValue([]);
    await act(async () => renderPage());
    expect(screen.getByText(/Neue Analyse starten/)).toBeInTheDocument();
  });

  it('renders ImportButton', async () => {
    fetchImpl = () => Promise.resolve({ ok: true, json: async () => [] });
    mockGetReferenceCommunesList.mockResolvedValue([]);
    await act(async () => renderPage());
    expect(screen.getByTestId('import-button')).toBeInTheDocument();
  });

  // --- Navigation -----------------------------------------------------------

  it('navigates to /input when "Neue Analyse starten" clicked', async () => {
    fetchImpl = () => Promise.resolve({ ok: true, json: async () => [] });
    mockGetReferenceCommunesList.mockResolvedValue([]);
    await act(async () => renderPage());
    fireEvent.click(screen.getByText(/Neue Analyse starten/));
    expect(mockNavigate).toHaveBeenCalledWith('/input');
  });

  // --- Outdated data warning ------------------------------------------------

  it('does NOT show outdated warning when backend returns empty array', async () => {
    fetchImpl = () => Promise.resolve({ ok: true, json: async () => [] });
    mockGetReferenceCommunesList.mockResolvedValue([]);
    await act(async () => renderPage());
    expect(screen.queryByText('Hinweis: Veraltete Daten')).not.toBeInTheDocument();
  });

  it('shows outdated warning when backend returns stale datasets', async () => {
    const stale = [{ title: 'Energieatlas', last_update: '2022-01-01' }];
    fetchImpl = () => Promise.resolve({ ok: true, json: async () => stale });
    mockGetReferenceCommunesList.mockResolvedValue([]);
    await act(async () => renderPage());
    expect(screen.getByText('Hinweis: Veraltete Daten')).toBeInTheDocument();
    expect(screen.getByText('Energieatlas')).toBeInTheDocument();
  });

  it('formats the last_update date in German locale', async () => {
    const stale = [{ title: 'Datenset', last_update: '2022-06-15' }];
    fetchImpl = () => Promise.resolve({ ok: true, json: async () => stale });
    mockGetReferenceCommunesList.mockResolvedValue([]);
    await act(async () => renderPage());
    const expectedDate = new Date('2022-06-15').toLocaleDateString('de-DE', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    expect(screen.getByText(`(Stand: ${expectedDate})`)).toBeInTheDocument();
  });

  // --- Fetch error banner ---------------------------------------------------

  it('shows error banner when outdated-data fetch fails', async () => {
    fetchImpl = () => Promise.resolve({ ok: false });
    mockGetReferenceCommunesList.mockResolvedValue([]);
    await act(async () => renderPage());
    expect(
      screen.getByText(/Aktualität der Daten konnte nicht überprüft werden/)
    ).toBeInTheDocument();
  });

  it('shows error banner when fetch throws', async () => {
    fetchImpl = () => Promise.reject(new Error('network'));
    mockGetReferenceCommunesList.mockResolvedValue([]);
    await act(async () => renderPage());
    expect(
      screen.getByText(/Aktualität der Daten konnte nicht überprüft werden/)
    ).toBeInTheDocument();
  });

  // --- Reference communes section -------------------------------------------

  it('shows loading spinner while reference communes load', async () => {
    fetchImpl = () => Promise.resolve({ ok: true, json: async () => [] });
    // Never resolves so loading stays true
    mockGetReferenceCommunesList.mockReturnValue(new Promise(() => {}));
    await act(async () => renderPage());
    expect(screen.getByText('Lade Beispielkommunen...')).toBeInTheDocument();
  });

  it('renders commune cards when communes load successfully', async () => {
    fetchImpl = () => Promise.resolve({ ok: true, json: async () => [] });
    mockGetReferenceCommunesList.mockResolvedValue(COMMUNES);
    await act(async () => renderPage());
    expect(screen.getByTestId('commune-card-r1')).toBeInTheDocument();
    expect(screen.getByTestId('commune-card-r2')).toBeInTheDocument();
  });

  it('renders empty state when commune list is empty', async () => {
    fetchImpl = () => Promise.resolve({ ok: true, json: async () => [] });
    mockGetReferenceCommunesList.mockResolvedValue([]);
    await act(async () => renderPage());
    expect(screen.getByText('Keine Beispielkommunen verfügbar')).toBeInTheDocument();
  });

  it('renders empty state when commune fetch fails', async () => {
    fetchImpl = () => Promise.resolve({ ok: true, json: async () => [] });
    mockGetReferenceCommunesList.mockRejectedValue(new Error('load fail'));
    await act(async () => renderPage());
    expect(screen.getByText('Keine Beispielkommunen verfügbar')).toBeInTheDocument();
  });

  // --- handleSelectReferenceCommune -----------------------------------------

  it('dispatches fetchReferenceCommune and navigates to /input on card select', async () => {
    fetchImpl = () => Promise.resolve({ ok: true, json: async () => [] });
    mockGetReferenceCommunesList.mockResolvedValue(COMMUNES);
    // Must return a thunk (function) so Redux-Thunk processes it,
    // and the thunk resolves so `await dispatch(...)` completes
    mockFetchReferenceCommune.mockReturnValue(() => Promise.resolve({}));
    mockSetCurrentCategory.mockReturnValue({ type: 'ui/setCurrentCategory' });

    const store = buildStore();
    await act(async () =>
      render(
        <MemoryRouter>
          <Provider store={store}>
            <StartPage />
          </Provider>
        </MemoryRouter>
      )
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('commune-card-r1'));
    });

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/input'));
    expect(mockFetchReferenceCommune).toHaveBeenCalledWith('r1');
  });

  // --- Reference commune section heading ------------------------------------

  it('renders prototypische Kommunen heading', async () => {
    fetchImpl = () => Promise.resolve({ ok: true, json: async () => [] });
    mockGetReferenceCommunesList.mockResolvedValue([]);
    await act(async () => renderPage());
    expect(screen.getByText('Prototypische Kommunen')).toBeInTheDocument();
  });
});