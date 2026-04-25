/**
 * MeasuresSlice.ts
 *
 * Redux slice managing the full measure catalogue and client-side search
 * filtering. Owns the async thunk that fetches all measures from the backend,
 * and maintains a filtered copy of the list that updates synchronously on
 * every search query change via MeasureService.searchMeasures.
 *
 * filteredMeasures is always derived from the full measures list — it is
 * reset to the full list on clearSearch and on a successful fetch, ensuring
 * the two stay consistent without requiring a separate derivation step.
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Measure, MeasuresState } from '../types/measureTypes';
import measureService from '../services/MeasureService';

// --- Initial state ---

const initialState: MeasuresState = {
  measures:         [],
  loading:          false,
  error:            null,
  searchQuery:      '',
  filteredMeasures: [],
};

// --- Async thunks ---

/**
 * Fetches the full measure catalogue from the backend via MeasureService.
 * On success, both measures and filteredMeasures are set to the returned list,
 * resetting any active search filter.
 */
export const fetchMeasures = createAsyncThunk(
  'measures/fetchMeasures',
  async (_, { rejectWithValue }) => {
    try {
      return await measureService.fetchMeasures();
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Error while fetching measures.'
      );
    }
  }
);

// --- Slice ---

const measuresSlice = createSlice({
  name: 'measures',
  initialState,
  reducers: {

    /**
     * Updates the search query and synchronously re-filters the measure list
     * via MeasureService.searchMeasures. Filtering is client-side so the
     * result updates on every keystroke without an additional API call.
     */
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
      state.filteredMeasures = measureService.searchMeasures(
        state.measures,
        action.payload
      );
    },

    /**
     * Clears the active search query and restores filteredMeasures to the
     * full measure list.
     */
    clearSearch: (state) => {
      state.searchQuery      = '';
      state.filteredMeasures = state.measures;
    },

    /** Clears the current error message without affecting any other state. */
    clearError: (state) => {
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    builder

      // --- fetchMeasures.pending ---
      .addCase(fetchMeasures.pending, (state) => {
        state.loading = true;
        state.error   = null;
      })

      // --- fetchMeasures.fulfilled ---
      // Both the full list and the filtered list are set to the returned data,
      // ensuring any previously active search filter is cleared on a fresh fetch.
      .addCase(fetchMeasures.fulfilled, (state, action: PayloadAction<Measure[]>) => {
        state.loading          = false;
        state.measures         = action.payload;
        state.filteredMeasures = action.payload;
        state.error            = null;
      })

      // --- fetchMeasures.rejected ---
      .addCase(fetchMeasures.rejected, (state, action) => {
        state.loading = false;
        state.error   = action.payload as string;
      });
  },
});

// --- Actions ---

export const {
  setSearchQuery,
  clearSearch,
  clearError,
} = measuresSlice.actions;

// --- Selectors ---

export const selectAllMeasures = (state: { measures: MeasuresState }) =>
  state.measures.measures;

export const selectFilteredMeasures = (state: { measures: MeasuresState }) =>
  state.measures.filteredMeasures;

export const selectMeasuresLoading = (state: { measures: MeasuresState }) =>
  state.measures.loading;

export const selectMeasuresError = (state: { measures: MeasuresState }) =>
  state.measures.error;

export const selectSearchQuery = (state: { measures: MeasuresState }) =>
  state.measures.searchQuery;

// --- Reducer ---

export default measuresSlice.reducer;