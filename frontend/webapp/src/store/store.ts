/**
 * store.ts
 *
 * Root Redux store configuration for the application. Combines the four
 * domain slices into a single store and exports the typed RootState and
 * AppDispatch utilities for use with useSelector and useDispatch throughout
 * the codebase.
 */

import { configureStore } from '@reduxjs/toolkit';
import measuresReducer  from './MeasuresSlice';
import resultReducer    from './ResultSlice';
import communityReducer from './CommunitySlice';
import uiReducer        from './UISlice';

// --- Store ---

/**
 * The application's single Redux store.
 *
 * Slice-to-key mapping:
 *  - results   → ResultSlice   (calculation results and ranking)
 *  - measures  → MeasuresSlice (measure catalogue and search filter)
 *  - community → CommunitySlice (commune identity, inputs, prefill data)
 *  - ui        → UISlice        (navigation state, validation errors, sub-input expansion)
 */
export const store = configureStore({
  reducer: {
    results:   resultReducer,
    measures:  measuresReducer,
    community: communityReducer,
    ui:        uiReducer,
  },
});

// --- Types ---

/** The shape of the entire Redux state tree, inferred from the store. */
export type RootState = ReturnType<typeof store.getState>;

/**
 * The store's dispatch type, including support for async thunks.
 * Use as the type argument to useDispatch: useDispatch<AppDispatch>().
 */
export type AppDispatch = typeof store.dispatch;

export default store;