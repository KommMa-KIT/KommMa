/**
 * UISlice.ts
 *
 * Redux slice managing transient UI state that does not belong to any data
 * domain slice. Owns three concerns:
 *  - currentCategory: the active step in the multi-step input page, advanced
 *    and retreated by nextCategory / prevCategory or jumped directly via
 *    setCurrentCategory.
 *  - expandedSubInputs: a map tracking which sub-input rows are expanded,
 *    keyed by parent field ID.
 *  - validationErrors: a map of per-field error messages set during navigation
 *    validation and cleared on field change or category transition.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CategoryType } from '../types/inputTypes';

// --- State ---

interface UIState {
  /** The currently active input page step. */
  currentCategory: CategoryType;

  // Categories which have been accessed at least once
  visitedCategories: CategoryType[];
  
  // Stores which subinput fields are expanded
  expandedSubInputs: { [parentId: string]: boolean };
  /** Active validation error messages, keyed by field ID. */
  validationErrors: { [fieldId: string]: string };
}

const initialState: UIState = {
  currentCategory: 'Start',
  visitedCategories: ['Start'],
  expandedSubInputs: {},
  validationErrors:  {},
};

// --- Ordered category sequence ---

/**
 * The canonical ordered list of input page steps. Defined once here and
 * referenced by nextCategory and prevCategory to avoid duplicating the
 * sequence in multiple reducers.
 */
const CATEGORIES: CategoryType[] = ['Start', 'General', 'Energy', 'Mobility', 'Water', 'End'];

// --- Slice ---

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {

    /** Jumps directly to the specified category step. */
    setCurrentCategory: (state, action: PayloadAction<CategoryType>) => {
      state.currentCategory = action.payload;
      if (!state.visitedCategories.includes(action.payload)) {
        state.visitedCategories.push(action.payload);
      }
    },

    /**
     * Advances to the next category in the sequence.
     * Dispatched by the Next button in NavigationButtons. No-ops when already
     * on the final step.
     */
    nextCategory: (state) => {
      const categories: CategoryType[] = ['Start', 'General', 'Energy', 'Mobility', 'Water', 'End'];
      const currentIndex = categories.indexOf(state.currentCategory);
      if (currentIndex < categories.length - 1) {
        state.currentCategory = categories[currentIndex + 1];
        const next = categories[currentIndex +1];
        if (!state.visitedCategories.includes(next)) {
          state.visitedCategories.push(next);
        }
      }
    },

    resetVisitedCategories: (state) => {
      state.visitedCategories = ['Start'];
    },

    // Called, when the "previous"-Button is clicked during input.
    prevCategory: (state) => {
      const currentIndex = CATEGORIES.indexOf(state.currentCategory);
      if (currentIndex > 0) {
        state.currentCategory = CATEGORIES[currentIndex - 1];
      }
    },

    /**
     * Toggles the expanded state of a sub-input row.
     * Undefined entries are treated as false by the selector, so the first
     * toggle on any parent ID correctly expands it.
     */
    toggleSubInput: (state, action: PayloadAction<string>) => {
      const parentId = action.payload;
      state.expandedSubInputs[parentId] = !state.expandedSubInputs[parentId];
    },

    /** Explicitly sets the expanded state of a sub-input row. */
    setSubInputExpanded: (state, action: PayloadAction<{ parentId: string; expanded: boolean }>) => {
      const { parentId, expanded } = action.payload;
      state.expandedSubInputs[parentId] = expanded;
    },

    /** Sets a validation error message for a specific field. */
    setValidationError: (state, action: PayloadAction<{ fieldId: string; error: string }>) => {
      const { fieldId, error } = action.payload;
      state.validationErrors[fieldId] = error;
    },

    /**
     * Removes the validation error for a specific field.
     * Dispatched by individual input components when the user corrects a field,
     * so the error indicator clears immediately on change.
     */
    clearValidationError: (state, action: PayloadAction<string>) => {
      delete state.validationErrors[action.payload];
    },

    /**
     * Clears all active validation errors at once.
     * Dispatched on category navigation so stale errors from one step do not
     * bleed into the next.
     */
    clearAllValidationErrors: (state) => {
      state.validationErrors = {};
    },

    /** Resets the entire UI slice to its initial state. */
    reset: () => initialState,
  },
});

// --- Actions ---

export const {
  setCurrentCategory,
  nextCategory,
  prevCategory,
  toggleSubInput,
  setSubInputExpanded,
  setValidationError,
  clearValidationError,
  clearAllValidationErrors,
  resetVisitedCategories,
  reset,
} = uiSlice.actions;

// --- Selectors ---

export const selectCurrentCategory = (state: { ui: UIState }) =>
  state.ui.currentCategory;

export const selectVisitedCategories = (state: { ui: UIState }) =>
  state.ui.visitedCategories;

export const selectIsSubInputExpanded = (parentId: string) => (state: { ui: UIState }) =>
  state.ui.expandedSubInputs[parentId] || false;

/** Returns the full map of all active validation errors. */
export const selectValidationErrors = (state: { ui: UIState }) =>
  state.ui.validationErrors;

/** Returns the validation error message for a specific field, or undefined if none. */
export const selectValidationError = (fieldId: string) => (state: { ui: UIState }) =>
  state.ui.validationErrors[fieldId];

/** Returns true when at least one validation error is active. */
export const selectHasValidationErrors = (state: { ui: UIState }) =>
  Object.keys(state.ui.validationErrors).length > 0;

// --- Reducer ---

export default uiSlice.reducer;