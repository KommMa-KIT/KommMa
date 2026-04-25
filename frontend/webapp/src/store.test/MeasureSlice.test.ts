/**
 * MeasuresSlice.additional.test.ts
 *
 * Additional tests for MeasuresSlice to reach ~100% coverage.
 * Covers: clearSearch when already empty, setSearchQuery with empty/whitespace,
 * fetchMeasures with generic non-Error rejection, and all selector edge cases.
 */

import reducer, {
  fetchMeasures,
  setSearchQuery,
  clearSearch,
  clearError,
  selectAllMeasures,
  selectFilteredMeasures,
  selectMeasuresLoading,
  selectMeasuresError,
  selectSearchQuery,
} from '../store/MeasuresSlice';
import measureService from '../services/MeasureService';
import { Measure, MeasuresState } from '../types/measureTypes';
import { configureStore } from '@reduxjs/toolkit';

jest.mock('../services/MeasureService');

describe('measuresSlice – additional coverage', () => {
  let initialState: MeasuresState;

  const measures: Measure[] = [
    { id: '1', title: 'Solaranlage', shortDescription: 'Solar kurz', description: 'Solar lang', popularity: 'high', popularityComment: '' },
    { id: '2', title: 'Wärmedämmung', shortDescription: 'Wärme kurz', description: 'Wärme lang', popularity: 'medium', popularityComment: '' },
    { id: '3', title: 'Windkraft', shortDescription: 'Wind kurz', description: 'Wind lang', popularity: 'low', popularityComment: '' },
  ];

  beforeEach(() => {
    initialState = {
      measures: [],
      filteredMeasures: [],
      loading: false,
      error: null,
      searchQuery: '',
    };
    jest.resetAllMocks();
    (measureService.searchMeasures as jest.Mock).mockReturnValue([]);
  });

  // ─── clearSearch when already empty ───────────────────────────────────────

  describe('clearSearch', () => {
    it('is a no-op when searchQuery is already empty', () => {
      const state: MeasuresState = { ...initialState, measures, filteredMeasures: measures };
      const next = reducer(state, clearSearch());
      expect(next.searchQuery).toBe('');
      expect(next.filteredMeasures).toEqual(measures);
    });

    it('resets filtered measures to the full list', () => {
      const state: MeasuresState = {
        ...initialState,
        searchQuery: 'Solar',
        measures,
        filteredMeasures: [measures[0]], // filtered subset
      };
      const next = reducer(state, clearSearch());
      expect(next.filteredMeasures).toEqual(measures);
    });

    it('works when measures list is empty', () => {
      const next = reducer(initialState, clearSearch());
      expect(next.filteredMeasures).toEqual([]);
      expect(next.searchQuery).toBe('');
    });
  });

  // ─── setSearchQuery ───────────────────────────────────────────────────────

  describe('setSearchQuery', () => {
    it('with empty string returns all measures', () => {
      (measureService.searchMeasures as jest.Mock).mockImplementation((ms, _) => ms);
      const state: MeasuresState = { ...initialState, measures, filteredMeasures: [measures[0]] };
      const next = reducer(state, setSearchQuery(''));
      expect(next.searchQuery).toBe('');
      expect(next.filteredMeasures).toHaveLength(3);
    });

    it('with whitespace-only string returns all measures', () => {
      (measureService.searchMeasures as jest.Mock).mockImplementation((ms, _) => ms);
      const state: MeasuresState = { ...initialState, measures, filteredMeasures: [] };
      const next = reducer(state, setSearchQuery('   '));
      expect(next.filteredMeasures).toHaveLength(3);
    });

    it('stores the raw query including trailing spaces', () => {
      (measureService.searchMeasures as jest.Mock).mockReturnValue([]);
      const state: MeasuresState = { ...initialState, measures, filteredMeasures: measures };
      const next = reducer(state, setSearchQuery('Solar '));
      expect(next.searchQuery).toBe('Solar ');
    });

    it('updates filteredMeasures when no match', () => {
      (measureService.searchMeasures as jest.Mock).mockReturnValue([]);
      const state: MeasuresState = { ...initialState, measures, filteredMeasures: measures };
      const next = reducer(state, setSearchQuery('zzz'));
      expect(next.filteredMeasures).toHaveLength(0);
    });

    it('passes the exact query to measureService.searchMeasures', () => {
      // Mock explizit für diesen Test setzen
      (measureService.searchMeasures as jest.Mock).mockReturnValue([]);
      const state: MeasuresState = { ...initialState, measures, filteredMeasures: [] };
      reducer(state, setSearchQuery('Wind'));
      expect(measureService.searchMeasures).toHaveBeenCalledWith(measures, 'Wind');
    });
  });

  // ─── clearError ───────────────────────────────────────────────────────────

  describe('clearError', () => {
    it('is a no-op when error is already null', () => {
      const next = reducer(initialState, clearError());
      expect(next.error).toBeNull();
    });

    it('sets error to null from a non-null value', () => {
      const state: MeasuresState = { ...initialState, error: 'Some error' };
      const next = reducer(state, clearError());
      expect(next.error).toBeNull();
    });
  });

  // ─── fetchMeasures – loading transitions ──────────────────────────────────

  describe('fetchMeasures loading transitions', () => {
    it('sets loading=true while pending and false on success', async () => {
      let resolve: (v: Measure[]) => void;
      const pending = new Promise<Measure[]>((res) => { resolve = res; });
      (measureService.fetchMeasures as jest.Mock).mockReturnValue(pending);

      const store = configureStore({ reducer: { measures: reducer } });
      const thunkPromise = store.dispatch(fetchMeasures() as any);
      expect(store.getState().measures.loading).toBe(true);

      resolve!([]);
      await thunkPromise;
      expect(store.getState().measures.loading).toBe(false);
      expect(store.getState().measures.error).toBeNull();
    });

    it('sets loading=true while pending and false on rejection', async () => {
      let reject: (err: Error) => void;
      const pending = new Promise<Measure[]>((_, rej) => { reject = rej; });
      (measureService.fetchMeasures as jest.Mock).mockReturnValue(pending);

      const store = configureStore({ reducer: { measures: reducer } });
      const thunkPromise = store.dispatch(fetchMeasures() as any);
      expect(store.getState().measures.loading).toBe(true);

      reject!(new Error('fail'));
      await thunkPromise;
      expect(store.getState().measures.loading).toBe(false);
    });

    it('uses error message string for Error rejections', async () => {
      (measureService.fetchMeasures as jest.Mock).mockRejectedValue(new Error('Custom Error'));
      const store = configureStore({ reducer: { measures: reducer } });
      await store.dispatch(fetchMeasures() as any);
      expect(store.getState().measures.error).toBe('Custom Error');
    });

    it('uses generic error message for non-Error rejections', async () => {
      (measureService.fetchMeasures as jest.Mock).mockRejectedValue('plain string');
      const store = configureStore({ reducer: { measures: reducer } });
      await store.dispatch(fetchMeasures() as any);
      expect(store.getState().measures.error).toBe('Error while fetching measure.');
    });

    it('clears previous error when a new fetch starts', async () => {
      const store = configureStore({
        reducer: { measures: reducer },
        preloadedState: { measures: { ...initialState, error: 'old error' } },
      });
      let resolve: (v: Measure[]) => void;
      const pending = new Promise<Measure[]>((res) => { resolve = res; });
      (measureService.fetchMeasures as jest.Mock).mockReturnValue(pending);

      store.dispatch(fetchMeasures() as any);
      // error cleared on pending
      expect(store.getState().measures.error).toBeNull();

      resolve!([]);
    });
  });

  // ─── fetchMeasures – fulfilled sets filteredMeasures ─────────────────────

  describe('fetchMeasures fulfilled', () => {
    it('sets both measures and filteredMeasures', async () => {
      (measureService.fetchMeasures as jest.Mock).mockResolvedValue(measures);
      const store = configureStore({ reducer: { measures: reducer } });
      await store.dispatch(fetchMeasures() as any);
      expect(store.getState().measures.measures).toEqual(measures);
      expect(store.getState().measures.filteredMeasures).toEqual(measures);
    });

    it('sets error to null on success', async () => {
      (measureService.fetchMeasures as jest.Mock).mockResolvedValue([]);
      const store = configureStore({
        reducer: { measures: reducer },
        preloadedState: { measures: { ...initialState, error: 'stale error' } },
      });
      await store.dispatch(fetchMeasures() as any);
      expect(store.getState().measures.error).toBeNull();
    });
  });

  // ─── Selectors ─────────────────────────────────────────────────────────────

  describe('Selectors edge cases', () => {
    it('selectAllMeasures returns empty array initially', () => {
      expect(selectAllMeasures({ measures: initialState })).toEqual([]);
    });

    it('selectFilteredMeasures returns empty array initially', () => {
      expect(selectFilteredMeasures({ measures: initialState })).toEqual([]);
    });

    it('selectMeasuresLoading returns false initially', () => {
      expect(selectMeasuresLoading({ measures: initialState })).toBe(false);
    });

    it('selectMeasuresError returns null initially', () => {
      expect(selectMeasuresError({ measures: initialState })).toBeNull();
    });

    it('selectSearchQuery returns empty string initially', () => {
      expect(selectSearchQuery({ measures: initialState })).toBe('');
    });

    it('selectSearchQuery returns current query', () => {
      const state = { measures: { ...initialState, searchQuery: 'test' } };
      expect(selectSearchQuery(state)).toBe('test');
    });
  });
});