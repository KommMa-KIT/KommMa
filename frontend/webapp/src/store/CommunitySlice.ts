/**
 * CommunitySlice.ts
 *
 * Redux slice managing all commune-related state: commune identity fields,
 * input values, individualisation flags, data sources, and subsidies. Also
 * owns the async thunks that fetch commune information, prefill data, average
 * data, and reference commune data from the backend via CommunityService.
 *
 * Key state design decisions:
 *  - inputs, individual, and sources are parallel maps keyed by field ID,
 *    keeping all three aspects of a field's value co-located in state.
 *  - individual[fieldId] === true means the user personally set this field,
 *    overriding any backend-sourced or average value.
 *  - Average data only fills fields that are not yet set, acting as a fallback
 *    layer beneath commune-specific prefill data.
 */

import {
  createSlice,
  createAsyncThunk,
  PayloadAction
} from '@reduxjs/toolkit';
import {
  InputValue,
  Subsidy,
  CommuneInfo,
  PrefillData,
  ReferenceCommune,
  InputExport,
} from '../types/inputTypes';
import { communityService } from '../services/CommunityService';

interface CommunityState {
  // Identification of a community.
  communeKey: string | null;
  communeName: string | null;
  postalCode: string | null;
  selectedReferenceCommune: string | null;
  
  // Values needed for the input fields.
  inputs: { [fieldId: string]: InputValue };
  // Level of individualism (true = fetched from API about this specific community, false = Taken from average)
  individual: { [fieldId: string]: boolean };
  sources: { [fieldId: string]: string };
  subsidies: Subsidy[];
  
  // Loading States
  loading: boolean;
  prefillLoading: boolean;
  error: string | null;
}

const initialState: CommunityState = {
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

// Async Thunks

// Load basic information on a community using its key (Amtlicher Gemeindeschlüssel).
export const fetchCommuneByKey = createAsyncThunk(
  'community/fetchByKey',
  async (key: string, { rejectWithValue }) => {
    try {
      return await communityService.getCommuneInfoByKey(key);
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Fehler');
    }
  }
);

// Load basic information on a community using its postal code (Postleitzahl).
export const fetchCommuneByCode = createAsyncThunk(
  'community/fetchByCode',
  async (code: string, { rejectWithValue }) => {
    try {
      return await communityService.getCommuneInfoByCode(code);
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Fehler');
    }
  }
);

// Load all prefill data on a given community from the backend.
export const fetchPrefillData = createAsyncThunk(
  'community/fetchPrefill',
  async (key: string, { rejectWithValue }) => {
    try {
      return await communityService.getPrefillData(key);
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Fehler');
    }
  }
);

// Load average values.
export const fetchAverageData = createAsyncThunk(
  'community/fetchAverage',
  async (_, { rejectWithValue }) => {
    try {
      return await communityService.getAverageData();
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Fehler');
    }
  }
);

// Fetch basic information about all reference communes from the backend.
export const fetchReferenceCommune = createAsyncThunk(
  'community/fetchReference',
  async (id: string, { rejectWithValue }) => {
    try {
      return await communityService.getReferenceCommune(id);
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Fehler');
    }
  }
);

// Slice
const communitySlice = createSlice({
  name: 'community',
  initialState,
  reducers: {
    // Set a single input fields value.
    setInput: (state, action: PayloadAction<{ id: string; value: InputValue, userInput: boolean }>) => {
      const { id, value, userInput } = action.payload;
      state.inputs[id] = value;
      if (userInput) {
        state.individual[id] = true;
        state.sources[id] = '';
      }
    },

    resetInputs: (state) => {
      state.inputs = {};
      state.individual = {};
      state.sources = {};
    },

    // Manually set the key of a community.
    setCommuneKey: (state, action: PayloadAction<string>) => {
      state.communeKey = action.payload;
    },

    // Manually set the name of a community here.
    setCommuneName: (state, action: PayloadAction<string>) => {
      state.communeName = action.payload;
    },

    // Manually set the postal code of a community here.
    setPostalCode: (state, action: PayloadAction<string>) => {
      state.postalCode = action.payload;
    },

    // Select a reference community.
    setReferenceCommune: (state, action: PayloadAction<string | null>) => {
      state.selectedReferenceCommune = action.payload;
    },

    // Add a single subsidy category.
    addSubsidy: (state, action: PayloadAction<Subsidy>) => {
      state.subsidies.push(action.payload);
    },

    // Update a single subsidy category at the given index.
    updateSubsidy: (state, action: PayloadAction<{ index: number; subsidy: Subsidy }>) => {
      const { index, subsidy } = action.payload;
      if (state.subsidies[index]) {
        state.subsidies[index] = subsidy;
      }
    },

    // Remove a set subsidy category.
    removeSubsidy: (state, action: PayloadAction<number>) => {
      state.subsidies.splice(action.payload, 1);
    },

    // Import stored data. (Note: Validation of import does not happen here!)
    importData: (state, action: PayloadAction<InputExport>) => {
      const data = action.payload;
      state.communeKey = data.communeKey;
      state.communeName = data.communeName;
      state.postalCode = data.postalCode;
      state.selectedReferenceCommune = data.selectedReferenceCommune;
      state.inputs = data.inputs;
      state.sources = data.sources;
      state.individual = data.individual;
      state.subsidies = data.subsidies;
    },
    
    // Reset
    reset: () => initialState,

    // Clear Error
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch Community by Key
    builder
      .addCase(fetchCommuneByKey.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCommuneByKey.fulfilled, (state, action: PayloadAction<CommuneInfo>) => {
        state.loading = false;
        state.communeKey = action.payload.key;
        state.communeName = action.payload.name;
        state.postalCode = action.payload.postal_code;
      })
      .addCase(fetchCommuneByKey.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Fetch Community by Code
    builder
      .addCase(fetchCommuneByCode.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCommuneByCode.fulfilled, (state, action: PayloadAction<CommuneInfo>) => {
        state.loading = false;
        // The values of the input fields should only change, if they have not been written by the user.
        if (!state.communeKey) {
          state.communeKey = action.payload.key;
        }
        if (!state.communeName) {
          state.communeName = action.payload.name;
        }
        if (!state.postalCode) {
          state.postalCode = action.payload.postal_code;
        }
      })
      .addCase(fetchCommuneByCode.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Fetch prefill data
    builder
      .addCase(fetchPrefillData.pending, (state) => {
        state.prefillLoading = true;
      })
      .addCase(fetchPrefillData.fulfilled, (state, action: PayloadAction<PrefillData>) => {
        state.prefillLoading = false;
        // Fill input fields
        Object.entries(action.payload).forEach(([fieldId, data]) => {
          state.inputs[fieldId] = data.value;
          state.individual[fieldId] = data.individual;
          state.sources[fieldId] = data.source;
        });
      })
      .addCase(fetchPrefillData.rejected, (state) => {
        state.prefillLoading = false;
      });

    // Fetch Average Data
    builder
      .addCase(fetchAverageData.fulfilled, (state, action: PayloadAction<PrefillData>) => {
        // Only fill input fields, which are not yet set
        Object.entries(action.payload).forEach(([fieldId, data]) => {
          if (state.inputs[fieldId] === undefined || state.inputs[fieldId] === null) {
            state.inputs[fieldId] = data.value;
            state.individual[fieldId] = false; // Average => NOT individual
            state.sources[fieldId] = data.source || 'Durchschnittswerte';
          }
        });
      });

    // Fetch reference commune data
    builder
      .addCase(fetchReferenceCommune.fulfilled, (state, action: PayloadAction<ReferenceCommune>) => {
        state.selectedReferenceCommune = action.payload.id;

        // Prefill all fields
        action.payload.inputs.forEach(({ id, value }) => {
          state.inputs[id] = value;
          state.individual[id] = false; // Reference commune => NOT individual
          state.sources[id] = `Referenzkommune: ${action.payload.name}`; // Source always becomes the reference commune
        });
      });
  },
});

// Actions
export const {
  setInput,
  resetInputs,
  setCommuneKey,
  setCommuneName,
  setPostalCode,
  setReferenceCommune,
  addSubsidy,
  updateSubsidy,
  removeSubsidy,
  importData,
  reset,
  clearError,
} = communitySlice.actions;

// Selectors
export const selectCommuneKey = (state: { community: CommunityState }) =>
  state.community.communeKey;

export const selectCommuneName = (state: { community: CommunityState }) =>
  state.community.communeName;

export const selectPostalCode = (state: { community: CommunityState }) =>
  state.community.postalCode;

export const selectReferenceCommune = (state: { community: CommunityState }) =>
  state.community.selectedReferenceCommune;

export const selectInputValue = (fieldId: string) => (state: { community: CommunityState }) =>
  state.community.inputs[fieldId];

export const selectAllInputs = (state: { community: CommunityState }) =>
  state.community.inputs;

export const selectIndividual = (state: { community: CommunityState }) =>
  state.community.individual;

export const selectFieldSource = (fieldId: string) => (state: { community: CommunityState }) =>
  state.community.sources[fieldId];

export const selectSubsidies = (state: { community: CommunityState }) =>
  state.community.subsidies;

export const selectLoading = (state: { community: CommunityState }) =>
  state.community.loading;

export const selectPrefillLoading = (state: { community: CommunityState }) =>
  state.community.prefillLoading;

export const selectError = (state: { community: CommunityState }) =>
  state.community.error;

// Export Reducer
export default communitySlice.reducer;