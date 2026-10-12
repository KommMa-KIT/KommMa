/**
 * ResultSlice.ts
 *
 * Redux slice managing the full results state:
 *  - Individualisation levels (general, energy, mobility, water, total).
 *  - Raw measure results from the backend.
 *  - User-defined ranking weights (time / cost / climate).
 *  - Active filter constraints.
 *  - Per-measure status (implemented / infeasible).
 *
 * Derived data (ranked, filtered, visible, and hidden measures) is exposed via
 * memoisation-free selectors that compose directly on the Redux state.
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { Result } from '../types/resultTypes';
import type { RootState } from './store';
import resultService from '../services/ResultService';
import { CalculateResultResponse } from '../types/resultTypes';

// --- Types ---

export interface FilterState {
  maxInvestmentCost:  number | null;
  maxOngoingCost:     number | null;
  maxTime:            number | null;
  minEmissionSavings: number | null;
}

export interface MeasureStatus {
  /** IDs of measures the user has marked as already implemented. */
  implemented: string[];
  /** IDs of measures the user has marked as infeasible. */
  infeasible:  string[];
}

export interface ResultState {
  levelOfIndividualisationGeneral:  number;
  levelOfIndividualisationEnergy:   number;
  levelOfIndividualisationMobility: number;
  levelOfIndividualisationWater:    number;
  levelOfIndividualisationTotal:    number;
  measureResults: Result[] | null;
  loading: boolean;
  error:   string | null;
  /** User-adjustable weights for the composite ranking score. */
  rankingWeights: { time: number; cost: number; climate: number };
  /** Active filter constraints; null means "no limit". */
  filters:       FilterState;
  /** Per-measure implemented / infeasible flags. */
  measureStatus: MeasureStatus;
}

// --- Initial state ---

const initialState: ResultState = {
  levelOfIndividualisationGeneral:  0,
  levelOfIndividualisationEnergy:   0,
  levelOfIndividualisationMobility: 0,
  levelOfIndividualisationWater:    0,
  levelOfIndividualisationTotal:    0,
  measureResults: null,
  loading: false,
  error:   null,
  rankingWeights: { time: 0.33, cost: 0.33, climate: 0.33 },
  filters: {
    maxInvestmentCost:  null,
    maxOngoingCost:     null,
    maxTime:            null,
    minEmissionSavings: null,
  },
  measureStatus: { implemented: [], infeasible: [] },
};

// --- Async thunk ---

/**
 * Sends community input data to the backend and retrieves ranked measure results.
 * Reads the full community state (inputs, individual flags, subsidies) from the Redux store.
 */
export const calculateResults = createAsyncThunk<
  CalculateResultResponse,
  void,
  { state: RootState }
>(
  'results/calculateResults',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state     = getState();
      const community = state.community;

      const payload = {
        inputs: Object.entries(community.inputs).map(([id, value]) => ({
          id,
          value,
          individual: community.individual[id] ?? false,
        })),
        subsidies: community.subsidies.map((s) => ({
          id:    s.id,
          value: s.value,
          unit:  s.unit,
        })),
      };

      return await resultService.calculateResult(payload);
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Error while calculating results.',
      );
    }
  },
);

// --- Slice ---

const resultSlice = createSlice({
  name: 'results',
  initialState,
  reducers: {
    /** Directly sets all result fields from a backend response (e.g. from a restored session). */
    setResults(state, action: PayloadAction<CalculateResultResponse>) {
      state.levelOfIndividualisationGeneral  = action.payload.levelOfIndividualisationGeneral;
      state.levelOfIndividualisationEnergy   = action.payload.levelOfIndividualisationEnergy;
      state.levelOfIndividualisationMobility = action.payload.levelOfIndividualisationMobility;
      state.levelOfIndividualisationWater    = action.payload.levelOfIndividualisationWater;
      state.levelOfIndividualisationTotal    = action.payload.levelOfIndividualisationTotal;
      state.measureResults                   = action.payload.measureResults;
    },

    /** Resets result data and error, keeping weights, filters, and status intact. */
    clearResults(state) {
      state.levelOfIndividualisationGeneral  = 0;
      state.levelOfIndividualisationEnergy   = 0;
      state.levelOfIndividualisationMobility = 0;
      state.levelOfIndividualisationWater    = 0;
      state.levelOfIndividualisationTotal    = 0;
      state.measureResults                   = null;
      state.error                            = null;
    },

    /** Clears the current error message. */
    clearError(state) {
      state.error = null;
    },

    /** Updates the three ranking weights used to compute the composite score. */
    setRankingWeights(state, action: PayloadAction<{ time: number; cost: number; climate: number }>) {
      state.rankingWeights = action.payload;
    },

    /** Replaces all active filter constraints. */
    setFilters(state, action: PayloadAction<FilterState>) {
      state.filters = action.payload;
    },

    /** Resets all filter constraints to null (no filtering). */
    clearFilters(state) {
      state.filters = { maxInvestmentCost: null, maxOngoingCost: null, maxTime: null, minEmissionSavings: null };
    },

    /**
     * Marks a measure as implemented and removes it from the infeasible list if present.
     * Idempotent if the measure is already implemented.
     */
    markAsImplemented(state, action: PayloadAction<string>) {
      const id = action.payload;
      if (!state.measureStatus.implemented.includes(id)) {
        state.measureStatus.implemented.push(id);
      }
      state.measureStatus.infeasible = state.measureStatus.infeasible.filter((x) => x !== id);
    },

    /**
     * Marks a measure as infeasible and removes it from the implemented list if present.
     * Idempotent if the measure is already infeasible.
     * Note: hiding of transitively dependent measures is computed in `selectHiddenMeasures`.
     */
    markAsInfeasible(state, action: PayloadAction<string>) {
      const id = action.payload;
      if (!state.measureStatus.infeasible.includes(id)) {
        state.measureStatus.infeasible.push(id);
      }
      state.measureStatus.implemented = state.measureStatus.implemented.filter((x) => x !== id);
    },

    /** Removes a measure from both the implemented and infeasible lists. */
    unmarkMeasure(state, action: PayloadAction<string>) {
      const id = action.payload;
      state.measureStatus.implemented = state.measureStatus.implemented.filter((x) => x !== id);
      state.measureStatus.infeasible  = state.measureStatus.infeasible.filter((x) => x !== id);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(calculateResults.pending, (state) => {
        state.loading = true;
        state.error   = null;
      })
      .addCase(calculateResults.fulfilled, (state, action: PayloadAction<CalculateResultResponse>) => {
        state.loading                          = false;
        state.levelOfIndividualisationGeneral  = action.payload.levelOfIndividualisationGeneral;
        state.levelOfIndividualisationEnergy   = action.payload.levelOfIndividualisationEnergy;
        state.levelOfIndividualisationMobility = action.payload.levelOfIndividualisationMobility;
        state.levelOfIndividualisationWater    = action.payload.levelOfIndividualisationWater;
        state.levelOfIndividualisationTotal    = action.payload.levelOfIndividualisationTotal;
        state.measureResults                   = action.payload.measureResults;
        state.error                            = null;
      })
      .addCase(calculateResults.rejected, (state, action) => {
        state.loading = false;
        state.error   = action.payload as string;
      });
  },
});

export const {
  setResults, clearResults, clearError,
  setRankingWeights,
  setFilters, clearFilters,
  markAsImplemented, markAsInfeasible, unmarkMeasure,
} = resultSlice.actions;

// --- Basic selectors ---

/** Raw measure results array from the backend (null before first calculation). */
export const selectMeasureResults = (state: RootState) => state.results.measureResults;

/** Individualisation level object for all categories including the total. */
export const selectIndividualismLevels = (state: RootState) => ({
  general:  state.results.levelOfIndividualisationGeneral,
  energy:   state.results.levelOfIndividualisationEnergy,
  mobility: state.results.levelOfIndividualisationMobility,
  water:    state.results.levelOfIndividualisationWater,
  total:    state.results.levelOfIndividualisationTotal,
});

/** True while the async `calculateResults` thunk is in flight. */
export const selectResultsLoading = (state: RootState) => state.results.loading;

/** Error message string from the last failed calculation, or null. */
export const selectResultsError = (state: RootState) => state.results.error;

/** Current ranking weights (time / cost / climate) as set by the user. */
export const selectRankingWeights = (state: RootState) => state.results.rankingWeights;

/** Current filter constraints. */
export const selectFilters = (state: RootState) => state.results.filters;

/** Implemented and infeasible measure ID lists. */
export const selectMeasureStatus = (state: RootState) => state.results.measureStatus;

// --- Derived selectors ---

/**
 * Returns the set of measure IDs that should be hidden from the main list.
 *
 * Hidden = explicitly implemented OR infeasible, plus any measures that transitively
 * depend on an infeasible measure (resolved via DependencyGraphService).
 */
export const selectHiddenMeasures = (state: RootState): Set<string> => {
  const { implemented, infeasible } = state.results.measureStatus;
  const hiddenSet = new Set<string>([...implemented, ...infeasible]);

  try {
    const { dependencyGraphService } = require('../services/DependencyGraphService');
    if (dependencyGraphService?.isInitialized()) {
      infeasible.forEach((id: string) => {
        dependencyGraphService.getDependentMeasures(id).forEach((dep: string) => hiddenSet.add(dep));
      });
    }
  } catch {
    console.warn('DependencyGraphService not available');
  }

  return hiddenSet;
};

/**
 * Returns the set of measure IDs that benefit from at least one implemented measure
 * (green-border candidates), excluding already-implemented measures.
 */
export const selectSynergyMeasures = (state: RootState): Set<string> => {
  const { implemented } = state.results.measureStatus;
  if (implemented.length === 0) return new Set();

  try {
    const { dependencyGraphService } = require('../services/DependencyGraphService');
    if (dependencyGraphService?.isInitialized()) {
      return dependencyGraphService.getSynergyMeasures(implemented);
    }
  } catch {
    console.warn('DependencyGraphService not available');
  }
  return new Set();
};

/**
 * Returns the set of measure IDs negatively affected by at least one implemented measure
 * (red-border candidates), excluding already-implemented measures.
 */
export const selectConflictMeasures = (state: RootState): Set<string> => {
  const { implemented } = state.results.measureStatus;
  if (implemented.length === 0) return new Set();

  try {
    const { dependencyGraphService } = require('../services/DependencyGraphService');
    if (dependencyGraphService?.isInitialized()) {
      return dependencyGraphService.getConflictMeasures(implemented);
    }
  } catch {
    console.warn('DependencyGraphService not available');
  }
  return new Set();
};

/**
 * Selector factory: returns the direct prerequisite IDs for a specific measure.
 *
 * Usage in a component:
 * ```ts
 * const prerequisites = useSelector(selectPrerequisiteMeasures(measure.id));
 * ```
 */
export const selectPrerequisiteMeasures =
  (measureId: string) =>
  (_state: RootState): Set<string> => {
    try {
      const { dependencyGraphService } = require('../services/DependencyGraphService');
      if (dependencyGraphService?.isInitialized()) {
        return dependencyGraphService.getPrerequisiteMeasures(measureId);
      }
    } catch {
      console.warn('DependencyGraphService not available');
    }
    return new Set();
  };

/**
 * Returns all measures sorted by weighted composite score (descending).
 *
 * Each item enriches the backend `Result` with full `Measure` data and a `totalScore`.
 * Weights are normalised so their relative ratios are preserved regardless of magnitude.
 * Items for which no matching `Measure` is found in the store are silently dropped.
 */
export const selectRankedMeasures = (state: RootState) => {
  const results  = state.results.measureResults;
  const measures = state.measures.measures;
  const weights  = state.results.rankingWeights;

  if (!results || results.length === 0) return [];

  const totalWeight = weights.time + weights.cost + weights.climate;
  const w = {
    time:    weights.time    / totalWeight,
    cost:    weights.cost    / totalWeight,
    climate: weights.climate / totalWeight,
  };

  return results
    .map((result) => {
      const measure = measures.find((m) => m.id === result.measureId);
      if (!measure) {
        console.warn(`Measure with id ${result.measureId} not found`);
        return null;
      }

      const totalScore =
        result.timeScore    * w.time    +
        result.costScore    * w.cost    +
        result.climateScore * w.climate;

      return {
        measure,
        timeScore:              result.timeScore,
        costScore:              result.costScore,
        climateScore:           result.climateScore,
        timeScale:              result.timeScale,
        costScale:              result.costScale,
        climateScale:           result.climateScale,
        time:                   result.time,
        investmentCost:         result.investmentCost,
        ongoingCost:            result.ongoingCost,
        totalCost:              result.totalCost,
        onetimeEmissionSavings: result.onetimeEmissionSavings,
        ongoingEmissionSavings: result.ongoingEmissionSavings,
        totalScore,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.totalScore - a!.totalScore);
};

/**
 * Returns ranked measures annotated with a `filtered` flag indicating whether each
 * measure fails at least one active filter constraint.
 * Preserves the sort order from `selectRankedMeasures`.
 */
export const selectFilteredMeasures = (state: RootState) => {
  const rankedMeasures = selectRankedMeasures(state);
  const filters        = state.results.filters;

  return rankedMeasures.map((item: any) => {
    let passesFilter = true;

    if (filters.maxInvestmentCost  !== null && item.investmentCost         > filters.maxInvestmentCost)  passesFilter = false;
    if (filters.maxOngoingCost     !== null && item.ongoingCost            > filters.maxOngoingCost)     passesFilter = false;
    if (filters.maxTime            !== null && item.time                   > filters.maxTime)            passesFilter = false;
    if (filters.minEmissionSavings !== null && item.ongoingEmissionSavings < filters.minEmissionSavings) passesFilter = false;

    return { ...item, filtered: !passesFilter };
  });
};

/**
 * Returns the top N visible measures (neither filtered nor hidden).
 * If n ≤ 0 or omitted, all visible measures are returned.
 *
 * @param n Maximum number of measures to return.
 */
export const selectTopNMeasures = (n: number) => (state: RootState) => {
  const filteredMeasures = selectFilteredMeasures(state);
  const hiddenMeasures   = selectHiddenMeasures(state);

  const visible = filteredMeasures
    .filter((m: any) => !m.filtered)
    .filter((m: any) => !hiddenMeasures.has(m.measure.id));

  return n > 0 ? visible.slice(0, n) : visible;
};

/**
 * Returns all measures that are neither filtered out nor hidden.
 * This is the primary input for the List, Overview, and Graph views.
 */
export const selectVisibleMeasures = (state: RootState) => {
  const filteredMeasures = selectFilteredMeasures(state);
  const hiddenMeasures   = selectHiddenMeasures(state);

  return filteredMeasures
    .filter((m: any) => !m.filtered)
    .filter((m: any) => !hiddenMeasures.has(m.measure.id));
};

/**
 * Returns all measures that are either filtered out or hidden (implemented, infeasible,
 * or transitively infeasible). Used to populate the "hidden measures" section in the List view.
 */
export const selectFilteredOutMeasures = (state: RootState) => {
  const filteredMeasures = selectFilteredMeasures(state);
  const hiddenMeasures   = selectHiddenMeasures(state);

  return filteredMeasures.filter(
    (m: any) => m.filtered || hiddenMeasures.has(m.measure.id),
  );
};

export default resultSlice.reducer;