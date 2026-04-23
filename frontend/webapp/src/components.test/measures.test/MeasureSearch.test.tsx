/**
 * MeasureSearch.test.tsx
 *
 * Tests for MeasureSearch – controlled input, search dispatch, clear button.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../../store/MeasuresSlice', () => ({
  selectSearchQuery: (state: any) => state.measures.searchQuery,
  setSearchQuery: (value: string) => ({ type: 'measures/setSearchQuery', payload: value }),
  clearSearch: () => ({ type: 'measures/clearSearch' }),
}));

// ─── Import ───────────────────────────────────────────────────────────────────

import MeasureSearch from '../../components/measures/MeasureSearch';

// ─── Store Factory ────────────────────────────────────────────────────────────

function makeStore(searchQuery = '') {
  return configureStore({
    reducer: {
      measures: (state = { searchQuery }, action: any) => {
        if (action.type === 'measures/setSearchQuery') {
          return { ...state, searchQuery: action.payload };
        }
        if (action.type === 'measures/clearSearch') {
          return { ...state, searchQuery: '' };
        }
        return state;
      },
    },
  });
}

function renderSearch(searchQuery = '') {
  const store = makeStore(searchQuery);
  return {
    store,
    ...render(
      <Provider store={store}>
        <MeasureSearch />
      </Provider>
    ),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MeasureSearch', () => {
  // --- Rendering ---

  it('renders a search input with correct placeholder', () => {
    renderSearch();
    expect(screen.getByPlaceholderText('Maßnahmen durchsuchen...')).toBeInTheDocument();
  });

  it('displays the current search query as the input value', () => {
    renderSearch('solar');
    const input = screen.getByPlaceholderText('Maßnahmen durchsuchen...') as HTMLInputElement;
    expect(input.value).toBe('solar');
  });

  it('displays an empty input when query is empty', () => {
    renderSearch('');
    const input = screen.getByPlaceholderText('Maßnahmen durchsuchen...') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  // --- Clear button visibility ---

  it('does not render the clear button when query is empty', () => {
    renderSearch('');
    expect(screen.queryByLabelText('Suche löschen')).toBeNull();
  });

  it('renders the clear button when query is active', () => {
    renderSearch('solar');
    expect(screen.getByLabelText('Suche löschen')).toBeInTheDocument();
  });

  // --- Dispatch: setSearchQuery ---

  it('dispatches setSearchQuery on input change', () => {
    const store = makeStore('');
    const dispatchSpy = jest.spyOn(store, 'dispatch');

    render(
      <Provider store={store}>
        <MeasureSearch />
      </Provider>
    );

    fireEvent.change(screen.getByPlaceholderText('Maßnahmen durchsuchen...'), {
      target: { value: 'windkraft' },
    });

    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'measures/setSearchQuery',
      payload: 'windkraft',
    });
  });

  it('dispatches setSearchQuery with empty string when cleared via input', () => {
    const store = makeStore('solar');
    const dispatchSpy = jest.spyOn(store, 'dispatch');

    render(
      <Provider store={store}>
        <MeasureSearch />
      </Provider>
    );

    fireEvent.change(screen.getByPlaceholderText('Maßnahmen durchsuchen...'), {
      target: { value: '' },
    });

    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'measures/setSearchQuery',
      payload: '',
    });
  });

  it('dispatches clearSearch when clear button is clicked', () => {
    const store = makeStore('solar');
    const dispatchSpy = jest.spyOn(store, 'dispatch');

    render(
      <Provider store={store}>
        <MeasureSearch />
      </Provider>
    );

    fireEvent.click(screen.getByLabelText('Suche löschen'));
    expect(dispatchSpy).toHaveBeenCalledWith({ type: 'measures/clearSearch' });
  });
});