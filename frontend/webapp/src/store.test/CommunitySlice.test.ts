/**
 * CommunitySlice.additional.test.ts
 *
 * Additional tests for CommunitySlice to significantly increase coverage.
 * Covers:
 * - initial state
 * - all sync reducers
 * - async thunk pending / fulfilled / rejected branches
 * - partial overwrite behaviour
 * - selector coverage
 * - subsidy edge cases
 * - import/reset edge cases
 */

import { configureStore } from '@reduxjs/toolkit';
import reducer, {
  resetInputs,
  setCommuneKey,
  setCommuneName,
  setPostalCode,
  setReferenceCommune,
  setInput,
  addSubsidy,
  removeSubsidy,
  updateSubsidy,
  importData,
  reset,
  clearError,
  fetchCommuneByKey,
  fetchCommuneByCode,
  fetchPrefillData,
  fetchAverageData,
  fetchReferenceCommune,
  selectCommuneKey,
  selectCommuneName,
  selectPostalCode,
  selectReferenceCommune,
  selectInputValue,
  selectAllInputs,
  selectIndividual,
  selectFieldSource,
  selectSubsidies,
  selectLoading,
  selectPrefillLoading,
  selectError,
} from '../store/CommunitySlice';
import { communityService } from '../services/CommunityService';
import type {
  InputValue,
  Subsidy,
  PrefillData,
  CommuneInfo,
  ReferenceCommune,
  InputExport,
} from '../types/inputTypes';

jest.mock('../services/CommunityService');

type CommunityState = ReturnType<typeof reducer>;

describe('communitySlice – additional coverage', () => {
  let initialState: CommunityState;

  const makeStore = (preloaded?: Partial<CommunityState>) =>
    configureStore({
      reducer: { community: reducer },
      preloadedState: {
        community: { ...initialState, ...preloaded },
      },
    });

  beforeEach(() => {
    initialState = {
      communeKey: null,
      communeName: null,
      postalCode: null,
      selectedReferenceCommune: null,
      inputs: {},
      individual: {},
      sources: {},
      subsidies: [],
      loading: false,
      prefillLoading: false,
      error: null,
    };
    jest.resetAllMocks();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  describe('initial state', () => {
    it('returns the initial state for an unknown action', () => {
      const state = reducer(undefined, { type: 'unknown' });
      expect(state).toEqual(initialState);
    });
  });

  // -------------------------------------------------------------------------
  // resetInputs
  // -------------------------------------------------------------------------

  describe('resetInputs', () => {
    it('clears inputs, individual and sources maps', () => {
      const state: CommunityState = {
        ...initialState,
        inputs: { f1: 10 },
        individual: { f1: true },
        sources: { f1: 'API' },
      };

      const next = reducer(state, resetInputs());

      expect(next.inputs).toEqual({});
      expect(next.individual).toEqual({});
      expect(next.sources).toEqual({});
    });

    it('does not touch other top-level state', () => {
      const state: CommunityState = {
        ...initialState,
        communeKey: '08212000',
        subsidies: [{ id: 'x', value: 1, unit: 'euro' }],
      };

      const next = reducer(state, resetInputs());

      expect(next.communeKey).toBe('08212000');
      expect(next.subsidies).toHaveLength(1);
    });

    it('is a no-op when already empty', () => {
      const next = reducer(initialState, resetInputs());
      expect(next.inputs).toEqual({});
      expect(next.individual).toEqual({});
      expect(next.sources).toEqual({});
    });
  });

  // -------------------------------------------------------------------------
  // setInput
  // -------------------------------------------------------------------------

  describe('setInput', () => {
    it('sets value and marks individual/source when userInput=true', () => {
      const next = reducer(
        initialState,
        setInput({ id: 'f1', value: 42 as InputValue, userInput: true })
      );

      expect(next.inputs['f1']).toBe(42);
      expect(next.individual['f1']).toBe(true);
      expect(next.sources['f1']).toBe('');
    });

    it('sets value without touching individual or sources when userInput=false', () => {
      const state: CommunityState = {
        ...initialState,
        individual: { f1: true },
        sources: { f1: 'existing-source' },
      };

      const next = reducer(
        state,
        setInput({ id: 'f1', value: 99 as InputValue, userInput: false })
      );

      expect(next.inputs['f1']).toBe(99);
      expect(next.individual['f1']).toBe(true);
      expect(next.sources['f1']).toBe('existing-source');
    });

    it('can set a new field without creating individual or source entries when userInput=false', () => {
      const next = reducer(
        initialState,
        setInput({ id: 'newField', value: 'hello' as InputValue, userInput: false })
      );

      expect(next.inputs['newField']).toBe('hello');
      expect(next.individual['newField']).toBeUndefined();
      expect(next.sources['newField']).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Manual setters
  // -------------------------------------------------------------------------

  describe('manual setters', () => {
    it('setCommuneKey overwrites an existing key', () => {
      const state: CommunityState = { ...initialState, communeKey: 'OLD' };
      expect(reducer(state, setCommuneKey('NEW')).communeKey).toBe('NEW');
    });

    it('setCommuneName overwrites an existing name', () => {
      const state: CommunityState = { ...initialState, communeName: 'Old City' };
      expect(reducer(state, setCommuneName('New City')).communeName).toBe('New City');
    });

    it('setPostalCode overwrites an existing code', () => {
      const state: CommunityState = { ...initialState, postalCode: '00000' };
      expect(reducer(state, setPostalCode('99999')).postalCode).toBe('99999');
    });

    it('setReferenceCommune replaces existing reference', () => {
      const state: CommunityState = { ...initialState, selectedReferenceCommune: 'RefA' };
      expect(reducer(state, setReferenceCommune('RefB')).selectedReferenceCommune).toBe('RefB');
    });

    it('setReferenceCommune accepts null', () => {
      const state: CommunityState = { ...initialState, selectedReferenceCommune: 'RefA' };
      expect(reducer(state, setReferenceCommune(null)).selectedReferenceCommune).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Subsidies
  // -------------------------------------------------------------------------

  describe('addSubsidy', () => {
    it('maintains order of subsidies', () => {
      const s1: Subsidy = { id: 'solar', value: 100, unit: 'euro' };
      const s2: Subsidy = { id: 'wind', value: 200, unit: 'percent' };
      const s3: Subsidy = { id: 'water', value: 300, unit: 'euro' };

      let state = reducer(initialState, addSubsidy(s1));
      state = reducer(state, addSubsidy(s2));
      state = reducer(state, addSubsidy(s3));

      expect(state.subsidies[0].id).toBe('solar');
      expect(state.subsidies[1].id).toBe('wind');
      expect(state.subsidies[2].id).toBe('water');
    });
  });

  describe('removeSubsidy', () => {
    it('removes element from the middle of the list', () => {
      const s1: Subsidy = { id: 'a', value: 1, unit: 'euro' };
      const s2: Subsidy = { id: 'b', value: 2, unit: 'euro' };
      const s3: Subsidy = { id: 'c', value: 3, unit: 'euro' };

      const state: CommunityState = { ...initialState, subsidies: [s1, s2, s3] };
      const next = reducer(state, removeSubsidy(1));

      expect(next.subsidies).toHaveLength(2);
      expect(next.subsidies[0].id).toBe('a');
      expect(next.subsidies[1].id).toBe('c');
    });

    it('removing an out-of-range index leaves the array unchanged', () => {
      const s1: Subsidy = { id: 'a', value: 1, unit: 'euro' };
      const state: CommunityState = { ...initialState, subsidies: [s1] };

      const next = reducer(state, removeSubsidy(99));

      expect(next.subsidies).toEqual([s1]);
    });
  });

  describe('updateSubsidy', () => {
    it('updates the last element in the list', () => {
      const s1: Subsidy = { id: 'a', value: 1, unit: 'euro' };
      const s2: Subsidy = { id: 'b', value: 2, unit: 'euro' };
      const updated: Subsidy = { id: 'b-updated', value: 99, unit: 'percent' };

      const state: CommunityState = { ...initialState, subsidies: [s1, s2] };
      const next = reducer(state, updateSubsidy({ index: 1, subsidy: updated }));

      expect(next.subsidies[1]).toEqual(updated);
      expect(next.subsidies[0]).toEqual(s1);
    });

    it('does nothing when index is invalid', () => {
      const s1: Subsidy = { id: 'a', value: 1, unit: 'euro' };
      const updated: Subsidy = { id: 'x', value: 99, unit: 'percent' };

      const state: CommunityState = { ...initialState, subsidies: [s1] };
      const next = reducer(state, updateSubsidy({ index: 10, subsidy: updated }));

      expect(next.subsidies).toEqual([s1]);
    });
  });

  // -------------------------------------------------------------------------
  // importData
  // -------------------------------------------------------------------------

  describe('importData', () => {
    it('imports all fields', () => {
      const data: InputExport = {
        timestamp: '',
        communeKey: '08212000',
        communeName: 'Karlsruhe',
        postalCode: '76133',
        selectedReferenceCommune: 'Ref1',
        inputs: { a: 1 },
        individual: { a: true },
        sources: { a: 'api' },
        subsidies: [{ id: 'x', value: 10, unit: 'euro' }],
      };

      const next = reducer(initialState, importData(data));

      expect(next.communeKey).toBe('08212000');
      expect(next.communeName).toBe('Karlsruhe');
      expect(next.postalCode).toBe('76133');
      expect(next.selectedReferenceCommune).toBe('Ref1');
      expect(next.inputs).toEqual({ a: 1 });
      expect(next.individual).toEqual({ a: true });
      expect(next.sources).toEqual({ a: 'api' });
      expect(next.subsidies).toEqual([{ id: 'x', value: 10, unit: 'euro' }]);
    });

    it('sets null fields from import data', () => {
      const data: InputExport = {
        timestamp: '',
        communeKey: null,
        communeName: null,
        postalCode: null,
        selectedReferenceCommune: null,
        inputs: {},
        individual: {},
        sources: {},
        subsidies: [],
      };

      const next = reducer(initialState, importData(data));

      expect(next.communeKey).toBeNull();
      expect(next.communeName).toBeNull();
      expect(next.postalCode).toBeNull();
      expect(next.selectedReferenceCommune).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // reset / clearError
  // -------------------------------------------------------------------------

  describe('reset', () => {
    it('returns the initial state again', () => {
      const state: CommunityState = {
        ...initialState,
        communeKey: 'K',
        communeName: 'N',
        postalCode: 'P',
        selectedReferenceCommune: 'R',
        inputs: { x: 1 },
        individual: { x: true },
        sources: { x: 'api' },
        subsidies: [{ id: 'x', value: 1, unit: 'euro' }],
        loading: true,
        prefillLoading: true,
        error: 'err',
      };

      const next = reducer(state, reset());

      expect(next).toEqual(initialState);
    });

    it('clears all subsidies', () => {
      const state: CommunityState = {
        ...initialState,
        subsidies: [{ id: 'x', value: 1, unit: 'euro' }],
      };

      const next = reducer(state, reset());
      expect(next.subsidies).toHaveLength(0);
    });

    it('clears selectedReferenceCommune', () => {
      const state: CommunityState = { ...initialState, selectedReferenceCommune: 'Ref1' };
      const next = reducer(state, reset());
      expect(next.selectedReferenceCommune).toBeNull();
    });
  });

  describe('clearError', () => {
    it('clears an existing error', () => {
      const state: CommunityState = { ...initialState, error: 'some error' };
      const next = reducer(state, clearError());
      expect(next.error).toBeNull();
    });

    it('works when called from a store', () => {
      const store = makeStore({ error: 'some error' });
      store.dispatch(clearError());
      expect(store.getState().community.error).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // fetchCommuneByKey
  // -------------------------------------------------------------------------

  describe('fetchCommuneByKey', () => {
    it('sets loading=true and clears error while pending', async () => {
      let resolve!: (value: CommuneInfo) => void;
      const pending = new Promise<CommuneInfo>((res) => {
        resolve = res;
      });

      (communityService.getCommuneInfoByKey as jest.Mock).mockReturnValue(pending);

      const store = makeStore({ error: 'old error' });
      const thunk = store.dispatch(fetchCommuneByKey('08212000') as any);

      expect(store.getState().community.loading).toBe(true);
      expect(store.getState().community.error).toBeNull();

      resolve({ key: '08212000', name: 'Karlsruhe', postal_code: '76133' });
      await thunk;

      expect(store.getState().community.loading).toBe(false);
    });

    it('writes all three commune fields on fulfilled', async () => {
      (communityService.getCommuneInfoByKey as jest.Mock).mockResolvedValue({
        key: '08212000',
        name: 'Karlsruhe',
        postal_code: '76133',
      });

      const store = makeStore();
      await store.dispatch(fetchCommuneByKey('08212000') as any);

      expect(store.getState().community.communeKey).toBe('08212000');
      expect(store.getState().community.communeName).toBe('Karlsruhe');
      expect(store.getState().community.postalCode).toBe('76133');
      expect(store.getState().community.loading).toBe(false);
    });

    it('stores Error.message when thunk rejects with an Error', async () => {
      (communityService.getCommuneInfoByKey as jest.Mock).mockRejectedValue(new Error('kaputt'));

      const store = makeStore();
      await store.dispatch(fetchCommuneByKey('08212000') as any);

      expect(store.getState().community.loading).toBe(false);
      expect(store.getState().community.error).toBe('kaputt');
    });

    it('uses generic error message for non-Error rejections', async () => {
      (communityService.getCommuneInfoByKey as jest.Mock).mockRejectedValue('plain string error');

      const store = makeStore();
      await store.dispatch(fetchCommuneByKey('08212000') as any);

      expect(store.getState().community.error).toBe('Fehler');
    });
  });

  // -------------------------------------------------------------------------
  // fetchCommuneByCode
  // -------------------------------------------------------------------------

  describe('fetchCommuneByCode', () => {
    it('sets loading=true while pending', async () => {
      let resolve!: (value: CommuneInfo) => void;
      const pending = new Promise<CommuneInfo>((res) => {
        resolve = res;
      });

      (communityService.getCommuneInfoByCode as jest.Mock).mockReturnValue(pending);

      const store = makeStore();
      const thunk = store.dispatch(fetchCommuneByCode('12345') as any);

      expect(store.getState().community.loading).toBe(true);

      resolve({ key: 'K', name: 'N', postal_code: '12345' });
      await thunk;

      expect(store.getState().community.loading).toBe(false);
    });

    it('clears error while pending', async () => {
      let resolve!: (value: CommuneInfo) => void;
      const pending = new Promise<CommuneInfo>((res) => {
        resolve = res;
      });

      (communityService.getCommuneInfoByCode as jest.Mock).mockReturnValue(pending);

      const store = makeStore({ error: 'old error' });
      const thunk = store.dispatch(fetchCommuneByCode('12345') as any);

      expect(store.getState().community.error).toBeNull();

      resolve({ key: 'K', name: 'N', postal_code: '12345' });
      await thunk;
    });

    it('overwrites communeKey when only communeKey is null', async () => {
      const store = makeStore({
        communeKey: null,
        communeName: 'ExistingName',
        postalCode: 'ExistingCode',
      });

      (communityService.getCommuneInfoByCode as jest.Mock).mockResolvedValue({
        key: 'NewKey',
        name: 'NewName',
        postal_code: 'NewCode',
      });

      await store.dispatch(fetchCommuneByCode('NewCode') as any);

      expect(store.getState().community.communeKey).toBe('NewKey');
      expect(store.getState().community.communeName).toBe('ExistingName');
      expect(store.getState().community.postalCode).toBe('ExistingCode');
    });

    it('overwrites communeName when only communeName is null', async () => {
      const store = makeStore({
        communeKey: 'ExistingKey',
        communeName: null,
        postalCode: 'ExistingCode',
      });

      (communityService.getCommuneInfoByCode as jest.Mock).mockResolvedValue({
        key: 'NewKey',
        name: 'NewName',
        postal_code: 'NewCode',
      });

      await store.dispatch(fetchCommuneByCode('NewCode') as any);

      expect(store.getState().community.communeKey).toBe('ExistingKey');
      expect(store.getState().community.communeName).toBe('NewName');
      expect(store.getState().community.postalCode).toBe('ExistingCode');
    });

    it('overwrites postalCode when only postalCode is null', async () => {
      const store = makeStore({
        communeKey: 'ExistingKey',
        communeName: 'ExistingName',
        postalCode: null,
      });

      (communityService.getCommuneInfoByCode as jest.Mock).mockResolvedValue({
        key: 'NewKey',
        name: 'NewName',
        postal_code: 'NewCode',
      });

      await store.dispatch(fetchCommuneByCode('NewCode') as any);

      expect(store.getState().community.communeKey).toBe('ExistingKey');
      expect(store.getState().community.communeName).toBe('ExistingName');
      expect(store.getState().community.postalCode).toBe('NewCode');
    });

    it('overwrites all fields when all are null', async () => {
      const store = makeStore({
        communeKey: null,
        communeName: null,
        postalCode: null,
      });

      (communityService.getCommuneInfoByCode as jest.Mock).mockResolvedValue({
        key: 'K',
        name: 'N',
        postal_code: 'P',
      });

      await store.dispatch(fetchCommuneByCode('P') as any);

      expect(store.getState().community.communeKey).toBe('K');
      expect(store.getState().community.communeName).toBe('N');
      expect(store.getState().community.postalCode).toBe('P');
    });

    it('does not overwrite existing values when all are already present', async () => {
      const store = makeStore({
        communeKey: 'ExistingKey',
        communeName: 'ExistingName',
        postalCode: 'ExistingCode',
      });

      (communityService.getCommuneInfoByCode as jest.Mock).mockResolvedValue({
        key: 'NewKey',
        name: 'NewName',
        postal_code: 'NewCode',
      });

      await store.dispatch(fetchCommuneByCode('NewCode') as any);

      expect(store.getState().community.communeKey).toBe('ExistingKey');
      expect(store.getState().community.communeName).toBe('ExistingName');
      expect(store.getState().community.postalCode).toBe('ExistingCode');
    });

    it('uses Error.message when thunk rejects with an Error', async () => {
      (communityService.getCommuneInfoByCode as jest.Mock).mockRejectedValue(
        new Error('bad postal code')
      );

      const store = makeStore();
      await store.dispatch(fetchCommuneByCode('99999') as any);

      expect(store.getState().community.error).toBe('bad postal code');
      expect(store.getState().community.loading).toBe(false);
    });

    it('uses generic error message for non-Error rejections', async () => {
      (communityService.getCommuneInfoByCode as jest.Mock).mockRejectedValue('plain string error');

      const store = makeStore();
      await store.dispatch(fetchCommuneByCode('99999') as any);

      expect(store.getState().community.error).toBe('Fehler');
    });
  });

  // -------------------------------------------------------------------------
  // fetchPrefillData
  // -------------------------------------------------------------------------

  describe('fetchPrefillData', () => {
    it('sets prefillLoading=true while pending', async () => {
      let resolve!: (value: PrefillData) => void;
      const pending = new Promise<PrefillData>((res) => {
        resolve = res;
      });

      (communityService.getPrefillData as jest.Mock).mockReturnValue(pending);

      const store = makeStore();
      const thunk = store.dispatch(fetchPrefillData('08212000') as any);

      expect(store.getState().community.prefillLoading).toBe(true);

      resolve({
        f1: { value: 10, individual: true, source: 'api', date: '' },
      });
      await thunk;

      expect(store.getState().community.prefillLoading).toBe(false);
    });

    it('writes inputs, individual flags and sources on fulfilled', async () => {
      (communityService.getPrefillData as jest.Mock).mockResolvedValue({
        f1: { value: 10, individual: true, source: 'api1', date: '' },
        f2: { value: 'abc', individual: false, source: 'api2', date: '' },
      });

      const store = makeStore();
      await store.dispatch(fetchPrefillData('08212000') as any);

      expect(store.getState().community.inputs['f1']).toBe(10);
      expect(store.getState().community.inputs['f2']).toBe('abc');
      expect(store.getState().community.individual['f1']).toBe(true);
      expect(store.getState().community.individual['f2']).toBe(false);
      expect(store.getState().community.sources['f1']).toBe('api1');
      expect(store.getState().community.sources['f2']).toBe('api2');
      expect(store.getState().community.prefillLoading).toBe(false);
    });

    it('overwrites existing prefill values on fulfilled', async () => {
      const store = makeStore({
        inputs: { f1: 999 },
        individual: { f1: false },
        sources: { f1: 'old' },
      });

      (communityService.getPrefillData as jest.Mock).mockResolvedValue({
        f1: { value: 123, individual: true, source: 'new', date: '' },
      });

      await store.dispatch(fetchPrefillData('08212000') as any);

      expect(store.getState().community.inputs['f1']).toBe(123);
      expect(store.getState().community.individual['f1']).toBe(true);
      expect(store.getState().community.sources['f1']).toBe('new');
    });

    it('resets prefillLoading on rejected', async () => {
      (communityService.getPrefillData as jest.Mock).mockRejectedValue(new Error('prefill failed'));

      const store = makeStore();
      await store.dispatch(fetchPrefillData('08212000') as any);

      expect(store.getState().community.prefillLoading).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // fetchAverageData
  // -------------------------------------------------------------------------

  describe('fetchAverageData', () => {
    it('does not overwrite a field already set to 0', () => {
      const state: CommunityState = {
        ...initialState,
        inputs: { f1: 0 },
      };

      const mockAverage: PrefillData = {
        f1: { value: 99, individual: false, source: 'avg', date: '' },
      };

      const next = reducer(state, fetchAverageData.fulfilled(mockAverage, '', undefined));

      expect(next.inputs['f1']).toBe(0);
    });

    it('does not overwrite a field already set to an empty string', () => {
      const state: CommunityState = {
        ...initialState,
        inputs: { f1: '' },
      };

      const mockAverage: PrefillData = {
        f1: { value: 'replacement', individual: false, source: 'avg', date: '' },
      };

      const next = reducer(state, fetchAverageData.fulfilled(mockAverage, '', undefined));

      expect(next.inputs['f1']).toBe('');
    });

    it('overwrites undefined fields', () => {
      const mockAverage: PrefillData = {
        f2: { value: 55, individual: false, source: '', date: '' },
      };

      const next = reducer(initialState, fetchAverageData.fulfilled(mockAverage, '', undefined));

      expect(next.inputs['f2']).toBe(55);
      expect(next.individual['f2']).toBe(false);
      expect(next.sources['f2']).toBe('Durchschnittswerte');
    });

    it('overwrites null fields', () => {
      const state: CommunityState = {
        ...initialState,
        inputs: { f3: null },
      };

      const mockAverage: PrefillData = {
        f3: { value: 77, individual: false, source: 'avg-db', date: '' },
      };

      const next = reducer(state, fetchAverageData.fulfilled(mockAverage, '', undefined));

      expect(next.inputs['f3']).toBe(77);
      expect(next.individual['f3']).toBe(false);
      expect(next.sources['f3']).toBe('avg-db');
    });

    it('uses source from payload when source is non-empty', () => {
      const mockAverage: PrefillData = {
        f1: { value: 10, individual: false, source: 'StatisticsDB', date: '' },
      };

      const next = reducer(initialState, fetchAverageData.fulfilled(mockAverage, '', undefined));

      expect(next.sources['f1']).toBe('StatisticsDB');
    });

    it('fills multiple missing fields in one go', () => {
      const mockAverage: PrefillData = {
        a: { value: 1, individual: false, source: '', date: '' },
        b: { value: 2, individual: false, source: 'stats', date: '' },
      };

      const next = reducer(initialState, fetchAverageData.fulfilled(mockAverage, '', undefined));

      expect(next.inputs['a']).toBe(1);
      expect(next.inputs['b']).toBe(2);
      expect(next.individual['a']).toBe(false);
      expect(next.individual['b']).toBe(false);
      expect(next.sources['a']).toBe('Durchschnittswerte');
      expect(next.sources['b']).toBe('stats');
    });

    it('dispatching the thunk calls the service', async () => {
      (communityService.getAverageData as jest.Mock).mockResolvedValue({});

      const store = makeStore();
      await store.dispatch(fetchAverageData() as any);

      expect(communityService.getAverageData).toHaveBeenCalledTimes(1);
    });

    it('uses reject path for service failure without changing existing state shape', async () => {
      (communityService.getAverageData as jest.Mock).mockRejectedValue(new Error('average failed'));

      const store = makeStore();
      await store.dispatch(fetchAverageData() as any);

      expect(store.getState().community.inputs).toEqual({});
      expect(store.getState().community.individual).toEqual({});
      expect(store.getState().community.sources).toEqual({});
    });
  });

  // -------------------------------------------------------------------------
  // fetchReferenceCommune
  // -------------------------------------------------------------------------

  describe('fetchReferenceCommune', () => {
    it('always overwrites inputs regardless of prior values', () => {
      const prior: CommunityState = {
        ...initialState,
        inputs: { field1: 999, fieldX: 'old' },
      };

      const mockRef: ReferenceCommune = {
        id: 'R1',
        name: 'RefCity',
        inputs: [{ id: 'field1', value: 42 }],
      };

      const next = reducer(prior, fetchReferenceCommune.fulfilled(mockRef, '', ''));

      expect(next.inputs['field1']).toBe(42);
      expect(next.inputs['fieldX']).toBe('old');
    });

    it('sets selectedReferenceCommune from payload id', () => {
      const mockRef: ReferenceCommune = {
        id: 'ABC',
        name: 'Test',
        inputs: [],
      };

      const next = reducer(initialState, fetchReferenceCommune.fulfilled(mockRef, '', ''));

      expect(next.selectedReferenceCommune).toBe('ABC');
    });

    it('marks imported reference fields as non-individual and sets source label', () => {
      const mockRef: ReferenceCommune = {
        id: 'R1',
        name: 'RefCity',
        inputs: [
          { id: 'field1', value: 42 },
          { id: 'field2', value: 'abc' },
        ],
      };

      const next = reducer(initialState, fetchReferenceCommune.fulfilled(mockRef, '', ''));

      expect(next.inputs['field1']).toBe(42);
      expect(next.inputs['field2']).toBe('abc');
      expect(next.individual['field1']).toBe(false);
      expect(next.individual['field2']).toBe(false);
      expect(next.sources['field1']).toBe('Referenzkommune: RefCity');
      expect(next.sources['field2']).toBe('Referenzkommune: RefCity');
    });

    it('dispatching the thunk calls the service', async () => {
      (communityService.getReferenceCommune as jest.Mock).mockResolvedValue({
        id: 'R1',
        name: 'RefCity',
        inputs: [],
      });

      const store = makeStore();
      await store.dispatch(fetchReferenceCommune('R1') as any);

      expect(communityService.getReferenceCommune).toHaveBeenCalledWith('R1');
    });
  });

  // -------------------------------------------------------------------------
  // Selectors
  // -------------------------------------------------------------------------

  describe('selectors', () => {
    it('selectCommuneKey returns communeKey', () => {
      expect(selectCommuneKey({ community: { ...initialState, communeKey: 'K' } })).toBe('K');
    });

    it('selectCommuneName returns communeName', () => {
      expect(selectCommuneName({ community: { ...initialState, communeName: 'Name' } })).toBe('Name');
    });

    it('selectPostalCode returns postalCode', () => {
      expect(selectPostalCode({ community: { ...initialState, postalCode: '76133' } })).toBe('76133');
    });

    it('selectReferenceCommune returns null initially', () => {
      const state = { community: initialState };
      expect(selectReferenceCommune(state)).toBeNull();
    });

    it('selectReferenceCommune returns the selected reference commune id', () => {
      const state = { community: { ...initialState, selectedReferenceCommune: 'Ref42' } };
      expect(selectReferenceCommune(state)).toBe('Ref42');
    });

    it('selectInputValue returns a field value', () => {
      const selector = selectInputValue('f1');
      expect(selector({ community: { ...initialState, inputs: { f1: 123 } } })).toBe(123);
    });

    it('selectFieldSource returns a field source', () => {
      const selector = selectFieldSource('f1');
      expect(selector({ community: { ...initialState, sources: { f1: 'API' } } })).toBe('API');
    });

    it('selectSubsidies returns the subsidies array', () => {
      const subsidies = [{ id: 'x', value: 1, unit: 'euro' }];
      expect(selectSubsidies({ community: { ...initialState, subsidies } })).toEqual(subsidies);
    });

    it('selectLoading returns false by default', () => {
      expect(selectLoading({ community: initialState })).toBe(false);
    });

    it('selectPrefillLoading returns false by default', () => {
      expect(selectPrefillLoading({ community: initialState })).toBe(false);
    });

    it('selectError returns null by default', () => {
      expect(selectError({ community: initialState })).toBeNull();
    });

    it('selectAllInputs returns empty object initially', () => {
      expect(selectAllInputs({ community: initialState })).toEqual({});
    });

    it('selectIndividual returns empty object initially', () => {
      expect(selectIndividual({ community: initialState })).toEqual({});
    });
  });
});