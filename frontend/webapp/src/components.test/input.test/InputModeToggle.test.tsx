/**
 * InputModeToggle.test.tsx
 *
 * Tests for the beginner/full mode toggle on the input page: rendering per
 * mode, mode switching, and the stranded-category correction that forwards
 * the user off steps hidden by beginner mode.
 */

import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import InputModeToggle from '../../components/input/InputModeToggle';
import uiReducer, { setCurrentCategory, setInputMode } from '../../store/UISlice';
import { CategorizedFields } from '../../types/inputTypes';

// ---------------------------------------------------------------------------
// CommunityService mock
// ---------------------------------------------------------------------------

const mockGetInputParameters = jest.fn();
jest.mock('../../services/CommunityService', () => ({
  __esModule: true,
  default: { getInputParameters: () => mockGetInputParameters() },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** General and Water carry mandatory fields; Energy and Mobility do not. */
const FIELDS: CategorizedFields = {
  General:  [{ id: 'g1', title: 'g1', type: 'number', description: '', critical: true,  subinputs: [] }],
  Energy:   [{ id: 'e1', title: 'e1', type: 'number', description: '', critical: false, subinputs: [] }],
  Mobility: [],
  Water:    [{ id: 'w1', title: 'w1', type: 'number', description: '', critical: true,  subinputs: [] }],
};

function buildStore() {
  return configureStore({ reducer: { ui: uiReducer } });
}

async function renderToggle(store: ReturnType<typeof buildStore>) {
  await act(async () => {
    render(
      <Provider store={store}>
        <InputModeToggle />
      </Provider>
    );
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InputModeToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInputParameters.mockResolvedValue(FIELDS);
  });

  it('offers the beginner switch in full mode', async () => {
    const store = buildStore();
    await renderToggle(store);
    expect(
      screen.getByText('Nur Pflichtfelder anzeigen (Einsteiger-Modus)')
    ).toBeInTheDocument();
  });

  it('switches to beginner mode on click', async () => {
    const store = buildStore();
    await renderToggle(store);
    fireEvent.click(screen.getByText('Nur Pflichtfelder anzeigen (Einsteiger-Modus)'));
    expect(store.getState().ui.inputMode).toBe('beginner');
  });

  it('shows the active-mode label and the full switch in beginner mode', async () => {
    const store = buildStore();
    store.dispatch(setInputMode('beginner'));
    await renderToggle(store);
    expect(
      screen.getByText('Einsteiger-Modus aktiv — es werden nur Pflichtfelder abgefragt.')
    ).toBeInTheDocument();
    expect(screen.getByText('Alle Eingabefelder anzeigen')).toBeInTheDocument();
  });

  it('switches back to full mode on click', async () => {
    const store = buildStore();
    store.dispatch(setInputMode('beginner'));
    await renderToggle(store);
    fireEvent.click(screen.getByText('Alle Eingabefelder anzeigen'));
    expect(store.getState().ui.inputMode).toBe('full');
  });

  it('forwards the user to the next visible step when the current category is hidden in beginner mode', async () => {
    const store = buildStore();
    store.dispatch(setInputMode('beginner'));
    store.dispatch(setCurrentCategory('Energy')); // no mandatory fields → hidden
    await renderToggle(store);
    expect(store.getState().ui.currentCategory).toBe('Water');
  });

  it('falls back to End when no later data category is visible', async () => {
    const store = buildStore();
    store.dispatch(setInputMode('beginner'));
    store.dispatch(setCurrentCategory('Water'));
    mockGetInputParameters.mockResolvedValue({ ...FIELDS, Water: [] });
    await renderToggle(store);
    expect(store.getState().ui.currentCategory).toBe('End');
  });

  it('does not change the category when it stays visible', async () => {
    const store = buildStore();
    store.dispatch(setInputMode('beginner'));
    store.dispatch(setCurrentCategory('General'));
    await renderToggle(store);
    expect(store.getState().ui.currentCategory).toBe('General');
  });
});
