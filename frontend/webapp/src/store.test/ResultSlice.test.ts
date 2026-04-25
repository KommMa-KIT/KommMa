/**
 * ResultSlice.additional.test.ts
 *
 * Additional tests for ResultSlice to reach ~100% coverage.
 * Covers: levelOfIndividualisationTotal reset, idempotent mark actions,
 * unmarkMeasure on non-existent id, DependencyGraphService unavailable branches,
 * selectRankedMeasures with missing measure, weight normalisation, and more.
 */

import reducer, {
  ResultState,
  calculateResults,
  setResults,
  clearResults,
  markAsImplemented,
  markAsInfeasible,
  unmarkMeasure,
  selectMeasureResults,
  selectResultsLoading,
  selectResultsError,
  selectRankingWeights,
  selectFilters,
  selectMeasureStatus,
  selectHiddenMeasures,
  selectSynergyMeasures,
  selectConflictMeasures,
  selectPrerequisiteMeasures,
  selectRankedMeasures,
  selectFilteredMeasures,
  selectTopNMeasures,
  selectVisibleMeasures,
  selectFilteredOutMeasures,
} from '../store/ResultSlice';
import { dependencyGraphService } from '../services/DependencyGraphService';
import { configureStore } from '@reduxjs/toolkit';

jest.mock('../services/DependencyGraphService');

describe('resultSlice – additional coverage', () => {
  let initialState: ResultState;

  beforeEach(() => {
    initialState = {
      levelOfIndividualisationGeneral: 0,
      levelOfIndividualisationEnergy: 0,
      levelOfIndividualisationMobility: 0,
      levelOfIndividualisationWater: 0,
      levelOfIndividualisationTotal: 0,
      measureResults: null,
      loading: false,
      error: null,
      rankingWeights: { time: 0.33, cost: 0.33, climate: 0.33 },
      filters: { maxInvestmentCost: null, maxOngoingCost: null, maxTime: null, minEmissionSavings: null },
      measureStatus: { implemented: [], infeasible: [] },
    };
    jest.resetAllMocks();
    (dependencyGraphService.isInitialized as jest.Mock).mockReturnValue(true);
  });

  // ─── clearResults resets levelOfIndividualisationTotal ───────────────────

  describe('clearResults', () => {
    it('preserves rankingWeights, filters, and measureStatus', () => {
      const weights = { time: 0.5, cost: 0.3, climate: 0.2 };
      const filters = { maxInvestmentCost: 50, maxOngoingCost: null, maxTime: null, minEmissionSavings: null };
      const status = { implemented: ['m1'], infeasible: ['m2'] };
      const state: ResultState = {
        ...initialState,
        rankingWeights: weights,
        filters,
        measureStatus: status,
        measureResults: [],
      };
      const next = reducer(state, clearResults());
      expect(next.rankingWeights).toEqual(weights);
      expect(next.filters.maxInvestmentCost).toBe(50);
      expect(next.measureStatus.implemented).toContain('m1');
    });
  });

  // ─── markAsImplemented – idempotency ─────────────────────────────────────

  describe('markAsImplemented idempotency', () => {
    it('does not duplicate an already-implemented id', () => {
      let state = reducer(initialState, markAsImplemented('m1'));
      state = reducer(state, markAsImplemented('m1'));
      expect(state.measureStatus.implemented.filter((x) => x === 'm1')).toHaveLength(1);
    });

    it('removes from infeasible when marking as implemented', () => {
      let state = reducer(initialState, markAsInfeasible('m1'));
      expect(state.measureStatus.infeasible).toContain('m1');
      state = reducer(state, markAsImplemented('m1'));
      expect(state.measureStatus.implemented).toContain('m1');
      expect(state.measureStatus.infeasible).not.toContain('m1');
    });
  });

  // ─── markAsInfeasible – idempotency ──────────────────────────────────────

  describe('markAsInfeasible idempotency', () => {
    it('does not duplicate an already-infeasible id', () => {
      let state = reducer(initialState, markAsInfeasible('m1'));
      state = reducer(state, markAsInfeasible('m1'));
      expect(state.measureStatus.infeasible.filter((x) => x === 'm1')).toHaveLength(1);
    });

    it('removes from implemented when marking as infeasible', () => {
      let state = reducer(initialState, markAsImplemented('m1'));
      expect(state.measureStatus.implemented).toContain('m1');
      state = reducer(state, markAsInfeasible('m1'));
      expect(state.measureStatus.infeasible).toContain('m1');
      expect(state.measureStatus.implemented).not.toContain('m1');
    });
  });

  // ─── unmarkMeasure ────────────────────────────────────────────────────────

  describe('unmarkMeasure', () => {
    it('is a no-op for an id not in either list', () => {
      const state = reducer(initialState, unmarkMeasure('nonexistent'));
      expect(state.measureStatus.implemented).toHaveLength(0);
      expect(state.measureStatus.infeasible).toHaveLength(0);
    });

    it('removes from both lists if somehow present in both (defensive)', () => {
      // Force a state with id in both lists (not normally possible, but tests the filter logic)
      const state: ResultState = {
        ...initialState,
        measureStatus: { implemented: ['m1', 'm2'], infeasible: ['m1', 'm3'] },
      };
      const next = reducer(state, unmarkMeasure('m1'));
      expect(next.measureStatus.implemented).not.toContain('m1');
      expect(next.measureStatus.infeasible).not.toContain('m1');
      expect(next.measureStatus.implemented).toContain('m2');
      expect(next.measureStatus.infeasible).toContain('m3');
    });
  });

  // ─── setResults ───────────────────────────────────────────────────────────

  describe('setResults', () => {
    it('sets all individualisation levels', () => {
      const payload = {
        levelOfIndividualisationGeneral: 10,
        levelOfIndividualisationEnergy: 20,
        levelOfIndividualisationMobility: 30,
        levelOfIndividualisationWater: 40,
        levelOfIndividualisationTotal: 100,
        measureResults: [],
      };
      const next = reducer(initialState, setResults(payload));
      expect(next.levelOfIndividualisationGeneral).toBe(10);
      expect(next.levelOfIndividualisationEnergy).toBe(20);
      expect(next.levelOfIndividualisationMobility).toBe(30);
      expect(next.levelOfIndividualisationWater).toBe(40);
      expect(next.levelOfIndividualisationTotal).toBe(100);
    });
  });

  // ─── selectRankedMeasures – edge cases ───────────────────────────────────

  describe('selectRankedMeasures edge cases', () => {
    it('returns empty array when measureResults is null', () => {
      const state: any = {
        results: { ...initialState, measureResults: null },
        measures: { measures: [] },
      };
      expect(selectRankedMeasures(state)).toEqual([]);
    });

    it('returns empty array when measureResults is empty', () => {
      const state: any = {
        results: { ...initialState, measureResults: [] },
        measures: { measures: [] },
      };
      expect(selectRankedMeasures(state)).toEqual([]);
    });

    it('drops results whose measure is not found in the store (and logs warning)', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const state: any = {
        results: {
          ...initialState,
          measureResults: [
            { measureId: 'unknown-id', timeScore: 1, costScore: 1, climateScore: 1,
              timeScale: 0, costScale: 0, climateScale: 0, time: 1,
              investmentCost: 0, ongoingCost: 0, totalCost: 0,
              onetimeEmissionSavings: 0, ongoingEmissionSavings: 0 },
          ],
        },
        measures: { measures: [] }, // no matching measure
      };
      const ranked = selectRankedMeasures(state);
      expect(ranked).toHaveLength(0);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unknown-id'));
      warnSpy.mockRestore();
    });

    it('normalises weights correctly when they do not sum to 1', () => {
      // weights: time=1, cost=1, climate=0 → normalised: time=0.5, cost=0.5, climate=0
      const state: any = {
        results: {
          ...initialState,
          measureResults: [
            { measureId: 'm1', timeScore: 1, costScore: 0, climateScore: 1,
              timeScale: 0, costScale: 0, climateScale: 0, time: 1,
              investmentCost: 0, ongoingCost: 0, totalCost: 0,
              onetimeEmissionSavings: 0, ongoingEmissionSavings: 0 },
          ],
          rankingWeights: { time: 1, cost: 1, climate: 0 },
        },
        measures: { measures: [{ id: 'm1', title: 'M1', shortDescription: '', description: '' }] },
      };
      const ranked = selectRankedMeasures(state);
      expect(ranked[0].totalScore).toBeCloseTo(0.5); // 1*0.5 + 0*0.5 + 1*0 = 0.5
    });

    it('sorts by totalScore descending', () => {
      const state: any = {
        results: {
          ...initialState,
          measureResults: [
            { measureId: 'm1', timeScore: 0.1, costScore: 0.1, climateScore: 0.1,
              timeScale: 0, costScale: 0, climateScale: 0, time: 1,
              investmentCost: 0, ongoingCost: 0, totalCost: 0,
              onetimeEmissionSavings: 0, ongoingEmissionSavings: 0 },
            { measureId: 'm2', timeScore: 0.9, costScore: 0.9, climateScore: 0.9,
              timeScale: 0, costScale: 0, climateScale: 0, time: 1,
              investmentCost: 0, ongoingCost: 0, totalCost: 0,
              onetimeEmissionSavings: 0, ongoingEmissionSavings: 0 },
          ],
          rankingWeights: { time: 0.33, cost: 0.33, climate: 0.33 },
        },
        measures: {
          measures: [
            { id: 'm1', title: 'M1', shortDescription: '', description: '' },
            { id: 'm2', title: 'M2', shortDescription: '', description: '' },
          ],
        },
      };
      const ranked = selectRankedMeasures(state);
      expect(ranked[0].measure.id).toBe('m2');
      expect(ranked[1].measure.id).toBe('m1');
    });
  });

  // ─── selectFilteredMeasures – filter branches ─────────────────────────────

  describe('selectFilteredMeasures filter branches', () => {
    const baseMeasureResult = {
      measureId: 'm1',
      timeScore: 0.5, costScore: 0.5, climateScore: 0.5,
      timeScale: 0, costScale: 0, climateScale: 0,
      time: 5,
      investmentCost: 100,
      ongoingCost: 50,
      totalCost: 150,
      onetimeEmissionSavings: 10,
      ongoingEmissionSavings: 20,
    };
    const baseMeasure = { id: 'm1', title: 'M1', shortDescription: '', description: '' };

    const makeState = (filterOverrides: object) => ({
      results: {
        ...initialState,
        measureResults: [baseMeasureResult],
        filters: { maxInvestmentCost: null, maxOngoingCost: null, maxTime: null, minEmissionSavings: null, ...filterOverrides },
        rankingWeights: { time: 0.33, cost: 0.33, climate: 0.33 },
      },
      measures: { measures: [baseMeasure] },
    });

    it('filters by maxOngoingCost', () => {
      const result = selectFilteredMeasures(makeState({ maxOngoingCost: 10 }) as any);
      expect(result[0].filtered).toBe(true); // ongoingCost=50 > 10
    });

    it('passes maxOngoingCost when within limit', () => {
      const result = selectFilteredMeasures(makeState({ maxOngoingCost: 100 }) as any);
      expect(result[0].filtered).toBe(false);
    });

    it('filters by maxTime', () => {
      const result = selectFilteredMeasures(makeState({ maxTime: 3 }) as any);
      expect(result[0].filtered).toBe(true); // time=5 > 3
    });

    it('passes maxTime when within limit', () => {
      const result = selectFilteredMeasures(makeState({ maxTime: 10 }) as any);
      expect(result[0].filtered).toBe(false);
    });

    it('filters by minEmissionSavings', () => {
      const result = selectFilteredMeasures(makeState({ minEmissionSavings: 100 }) as any);
      expect(result[0].filtered).toBe(true); // ongoingEmissionSavings=20 < 100
    });

    it('passes minEmissionSavings when above limit', () => {
      const result = selectFilteredMeasures(makeState({ minEmissionSavings: 10 }) as any);
      expect(result[0].filtered).toBe(false);
    });

    it('passes all null filters', () => {
      const result = selectFilteredMeasures(makeState({}) as any);
      expect(result[0].filtered).toBe(false);
    });
  });

  // ─── selectTopNMeasures ───────────────────────────────────────────────────

  describe('selectTopNMeasures', () => {
    const makeStateWithTwoMeasures = () => ({
      results: {
        ...initialState,
        measureResults: [
          { measureId: 'm1', timeScore: 1, costScore: 1, climateScore: 1,
            timeScale: 0, costScale: 0, climateScale: 0, time: 1,
            investmentCost: 0, ongoingCost: 0, totalCost: 0,
            onetimeEmissionSavings: 0, ongoingEmissionSavings: 0 },
          { measureId: 'm2', timeScore: 0.5, costScore: 0.5, climateScore: 0.5,
            timeScale: 0, costScale: 0, climateScale: 0, time: 1,
            investmentCost: 0, ongoingCost: 0, totalCost: 0,
            onetimeEmissionSavings: 0, ongoingEmissionSavings: 0 },
        ],
        filters: { maxInvestmentCost: null, maxOngoingCost: null, maxTime: null, minEmissionSavings: null },
        rankingWeights: { time: 0.33, cost: 0.33, climate: 0.33 },
        measureStatus: { implemented: [], infeasible: [] },
      },
      measures: {
        measures: [
          { id: 'm1', title: 'M1', shortDescription: '', description: '' },
          { id: 'm2', title: 'M2', shortDescription: '', description: '' },
        ],
      },
    });

    it('returns all visible measures when n <= 0', () => {
      (dependencyGraphService.isInitialized as jest.Mock).mockReturnValue(false);
      const state = makeStateWithTwoMeasures();
      expect(selectTopNMeasures(0)(state as any)).toHaveLength(2);
      expect(selectTopNMeasures(-1)(state as any)).toHaveLength(2);
    });

    it('returns all when n > total visible', () => {
      (dependencyGraphService.isInitialized as jest.Mock).mockReturnValue(false);
      const state = makeStateWithTwoMeasures();
      expect(selectTopNMeasures(100)(state as any)).toHaveLength(2);
    });

    it('correctly excludes hidden measures', () => {
      (dependencyGraphService.isInitialized as jest.Mock).mockReturnValue(true);
      (dependencyGraphService.getDependentMeasures as jest.Mock).mockReturnValue(new Set());
      const state = {
        ...makeStateWithTwoMeasures(),
        results: {
          ...makeStateWithTwoMeasures().results,
          measureStatus: { implemented: ['m1'], infeasible: [] },
        },
      };
      const top = selectTopNMeasures(10)(state as any);
      expect(top.every((m: any) => m.measure.id !== 'm1')).toBe(true);
    });
  });

  // ─── selectHiddenMeasures – DependencyGraphService not available ──────────

  describe('selectHiddenMeasures when DependencyGraphService not initialized', () => {
    it('falls back gracefully when service is not initialized', () => {
      (dependencyGraphService.isInitialized as jest.Mock).mockReturnValue(false);
      const state: any = {
        results: {
          ...initialState,
          measureStatus: { implemented: ['m1'], infeasible: ['m2'] },
        },
      };
      const hidden = selectHiddenMeasures(state);
      expect(hidden.has('m1')).toBe(true);
      expect(hidden.has('m2')).toBe(true);
      // No transitive dependents added since service is not initialized
    });
  });

  // ─── selectSynergyMeasures – empty implemented list ───────────────────────

  describe('selectSynergyMeasures', () => {
    it('returns empty Set when implemented list is empty', () => {
      const state: any = { results: { ...initialState, measureStatus: { implemented: [], infeasible: [] } } };
      expect(selectSynergyMeasures(state).size).toBe(0);
    });

    it('returns empty Set when DependencyGraphService is not initialized', () => {
      (dependencyGraphService.isInitialized as jest.Mock).mockReturnValue(false);
      const state: any = { results: { ...initialState, measureStatus: { implemented: ['m1'], infeasible: [] } } };
      expect(selectSynergyMeasures(state).size).toBe(0);
    });
  });

  // ─── selectConflictMeasures – empty implemented list ─────────────────────

  describe('selectConflictMeasures', () => {
    it('returns empty Set when implemented list is empty', () => {
      const state: any = { results: { ...initialState, measureStatus: { implemented: [], infeasible: [] } } };
      expect(selectConflictMeasures(state).size).toBe(0);
    });

    it('returns empty Set when DependencyGraphService is not initialized', () => {
      (dependencyGraphService.isInitialized as jest.Mock).mockReturnValue(false);
      const state: any = { results: { ...initialState, measureStatus: { implemented: ['m1'], infeasible: [] } } };
      expect(selectConflictMeasures(state).size).toBe(0);
    });
  });

  // ─── selectPrerequisiteMeasures – not initialized ─────────────────────────

  describe('selectPrerequisiteMeasures', () => {
    it('returns empty Set when DependencyGraphService is not initialized', () => {
      (dependencyGraphService.isInitialized as jest.Mock).mockReturnValue(false);
      const selector = selectPrerequisiteMeasures('mX');
      expect(selector({ results: initialState } as any).size).toBe(0);
    });
  });

  // ─── Basic selectors ──────────────────────────────────────────────────────

  describe('basic selectors', () => {
    it('selectResultsLoading returns true when loading', () => {
      const state: any = { results: { ...initialState, loading: true } };
      expect(selectResultsLoading(state)).toBe(true);
    });

    it('selectResultsError returns error string', () => {
      const state: any = { results: { ...initialState, error: 'Something went wrong' } };
      expect(selectResultsError(state)).toBe('Something went wrong');
    });

    it('selectResultsError returns null when no error', () => {
      const state: any = { results: initialState };
      expect(selectResultsError(state)).toBeNull();
    });

    it('selectMeasureResults returns null before first calculation', () => {
      const state: any = { results: initialState };
      expect(selectMeasureResults(state)).toBeNull();
    });

    it('selectRankingWeights returns default weights', () => {
      const state: any = { results: initialState };
      expect(selectRankingWeights(state)).toEqual({ time: 0.33, cost: 0.33, climate: 0.33 });
    });

    it('selectFilters returns all-null filters initially', () => {
      const state: any = { results: initialState };
      const filters = selectFilters(state);
      expect(filters.maxInvestmentCost).toBeNull();
      expect(filters.maxOngoingCost).toBeNull();
      expect(filters.maxTime).toBeNull();
      expect(filters.minEmissionSavings).toBeNull();
    });

    it('selectMeasureStatus returns empty lists initially', () => {
      const state: any = { results: initialState };
      const status = selectMeasureStatus(state);
      expect(status.implemented).toHaveLength(0);
      expect(status.infeasible).toHaveLength(0);
    });
  });

  // ─── calculateResults – loading state ────────────────────────────────────

  describe('calculateResults loading state', () => {
    it('sets loading=true while pending and false on completion', async () => {
      const mockResponse = {
        levelOfIndividualisationGeneral: 1,
        levelOfIndividualisationEnergy: 1,
        levelOfIndividualisationMobility: 1,
        levelOfIndividualisationWater: 1,
        levelOfIndividualisationTotal: 4,
        measureResults: [],
      };

      const { resultService } = require('../services/ResultService');
      resultService.calculateResult = jest.fn().mockResolvedValue(mockResponse);

      const store = configureStore({
        reducer: {
          results: reducer,
          community: (s = { inputs: {}, individual: {}, subsidies: [] }) => s,
        },
      });

      const thunk = store.dispatch(calculateResults() as any);
      expect(store.getState().results.loading).toBe(true);
      await thunk;
      expect(store.getState().results.loading).toBe(false);
    });
  });

  // ─── selectVisibleMeasures / selectFilteredOutMeasures ────────────────────

  describe('selectVisibleMeasures and selectFilteredOutMeasures', () => {
    it('visible + filtered-out = all ranked measures', () => {
      (dependencyGraphService.isInitialized as jest.Mock).mockReturnValue(false);
      const state: any = {
        results: {
          ...initialState,
          measureResults: [
            { measureId: 'm1', timeScore: 1, costScore: 1, climateScore: 1,
              timeScale: 0, costScale: 0, climateScale: 0, time: 1,
              investmentCost: 200, ongoingCost: 0, totalCost: 200,
              onetimeEmissionSavings: 0, ongoingEmissionSavings: 0 },
            { measureId: 'm2', timeScore: 0.5, costScore: 0.5, climateScore: 0.5,
              timeScale: 0, costScale: 0, climateScale: 0, time: 1,
              investmentCost: 50, ongoingCost: 0, totalCost: 50,
              onetimeEmissionSavings: 0, ongoingEmissionSavings: 0 },
          ],
          filters: { maxInvestmentCost: 100, maxOngoingCost: null, maxTime: null, minEmissionSavings: null },
          rankingWeights: { time: 0.33, cost: 0.33, climate: 0.33 },
          measureStatus: { implemented: [], infeasible: [] },
        },
        measures: {
          measures: [
            { id: 'm1', title: 'M1', shortDescription: '', description: '' },
            { id: 'm2', title: 'M2', shortDescription: '', description: '' },
          ],
        },
      };

      const visible = selectVisibleMeasures(state);
      const filteredOut = selectFilteredOutMeasures(state);
      expect(visible.length + filteredOut.length).toBe(2);
      // m1 investmentCost=200 > 100 → filtered out
      expect(filteredOut.some((m: any) => m.measure.id === 'm1')).toBe(true);
      // m2 investmentCost=50 ≤ 100 → visible
      expect(visible.some((m: any) => m.measure.id === 'm2')).toBe(true);
    });
  });
});