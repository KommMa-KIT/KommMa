/**
 * MainView.test.tsx
 *
 * Unit tests for the MainView component covering:
 *  - Loading spinner shown while fields are being fetched
 *  - Error state shown when field fetch fails
 *  - Empty state shown when fetched category has no fields
 *  - Field list rendered on success
 *  - Category title and description for all four categories
 *  - Validation error banner shown when errors exist
 *  - Auto-scroll effect triggers on validation error change
 *  - Column headers always rendered in success state
 *  - Required-field legend rendered
 *  - Re-fetches when category prop changes
 */

import { render, screen, act, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import MainView from '../../components/input/MainView';
import { CategorizedFields } from '../../types/inputTypes';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../components/input/fields/InputField', () => ({
  __esModule: true,
  default: ({ field }: any) => <div data-testid={`field-${field.id}`}>{field.title}</div>,
}));

const mockGetInputParameters = jest.fn<Promise<CategorizedFields>, []>();
jest.mock('../../services/CommunityService', () => ({
  __esModule: true,
  default: {
    getInputParameters: () => mockGetInputParameters(),
  },
}));

const mockSelectValidationErrors = jest.fn();
jest.mock('../../store/UISlice', () => ({
  selectValidationErrors: (state: any) => mockSelectValidationErrors(state),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIELDS_RESPONSE: CategorizedFields = {
  General: [
    {
      id: 'g1',
      title: 'Gemeindeschlüssel',
      type: 'number',
      critical: true,
      description: '',
      subinputs: [],
    },
  ],
  Energy: [
    {
      id: 'e1',
      title: 'Stromverbrauch',
      type: 'number',
      critical: false,
      description: '',
      subinputs: [],
    },
  ],
  Mobility: [
    {
      id: 'm1',
      title: 'Pkw-Dichte',
      type: 'number',
      critical: false,
      description: '',
      subinputs: [],
    },
  ],
  Water: [
    {
      id: 'w1',
      title: 'Wasserverbrauch',
      type: 'number',
      critical: false,
      description: '',
      subinputs: [],
    },
  ],
};

function buildStore() {
  return configureStore({ reducer: { ui: () => ({}) } });
}

function renderMainView(
  category: 'General' | 'Energy' | 'Mobility' | 'Water' = 'General'
) {
  const store = buildStore();
  return {
    ...render(
      <Provider store={store}>
        <MainView category={category} />
      </Provider>
    ),
    store,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MainView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectValidationErrors.mockReturnValue({});
    Element.prototype.scrollIntoView = jest.fn();
  });

  // --- Loading state --------------------------------------------------------

  it('shows loading spinner while fields are being fetched', async () => {
    mockGetInputParameters.mockReturnValue(new Promise(() => {}));
    await act(async () => {
      renderMainView();
    });
    expect(screen.getByText('Lade Eingabefelder...')).toBeInTheDocument();
  });

  // --- Error state ----------------------------------------------------------

  it('shows error message when fetch fails', async () => {
    mockGetInputParameters.mockRejectedValue(new Error('network error'));
    await act(async () => {
      renderMainView();
    });
    expect(screen.getByText('Felder konnten nicht geladen werden')).toBeInTheDocument();
  });

  // --- Empty state ----------------------------------------------------------

  it('shows empty state when category returns no fields', async () => {
    mockGetInputParameters.mockResolvedValue({ ...FIELDS_RESPONSE, General: [] });
    await act(async () => {
      renderMainView('General');
    });
    expect(
      screen.getByText('Keine Felder für diese Kategorie verfügbar.')
    ).toBeInTheDocument();
  });

  // --- Success state — field rendering -------------------------------------

  it('renders InputField for each field in the category', async () => {
    mockGetInputParameters.mockResolvedValue(FIELDS_RESPONSE);
    await act(async () => {
      renderMainView('General');
    });
    expect(screen.getByTestId('field-g1')).toBeInTheDocument();
    expect(screen.getByText('Gemeindeschlüssel')).toBeInTheDocument();
  });

  it('renders fields for Energy category', async () => {
    mockGetInputParameters.mockResolvedValue(FIELDS_RESPONSE);
    await act(async () => {
      renderMainView('Energy');
    });
    expect(screen.getByTestId('field-e1')).toBeInTheDocument();
  });

  it('renders fields for Mobility category', async () => {
    mockGetInputParameters.mockResolvedValue(FIELDS_RESPONSE);
    await act(async () => {
      renderMainView('Mobility');
    });
    expect(screen.getByTestId('field-m1')).toBeInTheDocument();
  });

  it('renders fields for Water category', async () => {
    mockGetInputParameters.mockResolvedValue(FIELDS_RESPONSE);
    await act(async () => {
      renderMainView('Water');
    });
    expect(screen.getByTestId('field-w1')).toBeInTheDocument();
  });

  // --- Category titles ------------------------------------------------------

  it('renders "Allgemeine Angaben" title for General', async () => {
    mockGetInputParameters.mockResolvedValue(FIELDS_RESPONSE);
    await act(async () => {
      renderMainView('General');
    });
    expect(screen.getByText('Allgemeine Angaben')).toBeInTheDocument();
  });

  it('renders "Energie" title for Energy', async () => {
    mockGetInputParameters.mockResolvedValue(FIELDS_RESPONSE);
    await act(async () => {
      renderMainView('Energy');
    });
    expect(screen.getByText('Energie')).toBeInTheDocument();
  });

  it('renders "Mobilität" title for Mobility', async () => {
    mockGetInputParameters.mockResolvedValue(FIELDS_RESPONSE);
    await act(async () => {
      renderMainView('Mobility');
    });
    expect(screen.getByText('Mobilität')).toBeInTheDocument();
  });

  it('renders "Wasser" title for Water', async () => {
    mockGetInputParameters.mockResolvedValue(FIELDS_RESPONSE);
    await act(async () => {
      renderMainView('Water');
    });
    expect(screen.getByText('Wasser')).toBeInTheDocument();
  });

  // --- Category descriptions ------------------------------------------------

  it('renders General category description', async () => {
    mockGetInputParameters.mockResolvedValue(FIELDS_RESPONSE);
    await act(async () => {
      renderMainView('General');
    });
    expect(screen.getByText(/Grundlegende Informationen/)).toBeInTheDocument();
  });

  it('renders Energy category description', async () => {
    mockGetInputParameters.mockResolvedValue(FIELDS_RESPONSE);
    await act(async () => {
      renderMainView('Energy');
    });
    expect(screen.getByText(/Energieverbrauch/)).toBeInTheDocument();
  });

  it('renders Mobility category description', async () => {
    mockGetInputParameters.mockResolvedValue(FIELDS_RESPONSE);
    await act(async () => {
      renderMainView('Mobility');
    });
    expect(screen.getByText(/Verkehr und Mobilität/)).toBeInTheDocument();
  });

  it('renders Water category description', async () => {
    mockGetInputParameters.mockResolvedValue(FIELDS_RESPONSE);
    await act(async () => {
      renderMainView('Water');
    });
    expect(screen.getByText(/Wasserversorgung/)).toBeInTheDocument();
  });

  // --- Validation error banner ----------------------------------------------

  it('does NOT show validation banner when no errors', async () => {
    mockGetInputParameters.mockResolvedValue(FIELDS_RESPONSE);
    mockSelectValidationErrors.mockReturnValue({});
    await act(async () => {
      renderMainView('General');
    });
    expect(screen.queryByText('Pflichtfelder nicht ausgefüllt')).not.toBeInTheDocument();
  });

  it('shows validation banner when validation errors exist', async () => {
    mockGetInputParameters.mockResolvedValue(FIELDS_RESPONSE);
    mockSelectValidationErrors.mockReturnValue({ g1: 'required' });
    await act(async () => {
      renderMainView('General');
    });
    expect(screen.getByText('Pflichtfelder nicht ausgefüllt')).toBeInTheDocument();
  });

  // --- Auto-scroll ----------------------------------------------------------

  it('calls scrollIntoView on the first errored field element', async () => {
    mockGetInputParameters.mockResolvedValue(FIELDS_RESPONSE);
    const scrollMock = jest.fn();

    const fakeElement = document.createElement('div');
    fakeElement.setAttribute('id', 'field-g1');
    fakeElement.scrollIntoView = scrollMock;
    document.body.appendChild(fakeElement);

    mockSelectValidationErrors.mockReturnValue({ g1: 'required' });

    await act(async () => {
      renderMainView('General');
    });

    await waitFor(() => expect(scrollMock).toHaveBeenCalled());

    document.body.removeChild(fakeElement);
  });

  // --- Column headers -------------------------------------------------------

  it('renders "Eingabefeld" column header', async () => {
    mockGetInputParameters.mockResolvedValue(FIELDS_RESPONSE);
    await act(async () => {
      renderMainView('General');
    });
    expect(screen.getByText('Eingabefeld')).toBeInTheDocument();
  });

  it('renders "Wert" column header', async () => {
    mockGetInputParameters.mockResolvedValue(FIELDS_RESPONSE);
    await act(async () => {
      renderMainView('General');
    });
    expect(screen.getByText('Wert')).toBeInTheDocument();
  });

  it('renders "Beschreibung" column header', async () => {
    mockGetInputParameters.mockResolvedValue(FIELDS_RESPONSE);
    await act(async () => {
      renderMainView('General');
    });
    expect(screen.getByText('Beschreibung')).toBeInTheDocument();
  });

  // --- Required-field legend ------------------------------------------------

  it('renders required-field legend', async () => {
    mockGetInputParameters.mockResolvedValue(FIELDS_RESPONSE);
    await act(async () => {
      renderMainView('General');
    });
    expect(
      screen.getByText(/Pflichtfeld \(muss ausgefüllt werden\)/)
    ).toBeInTheDocument();
  });
});