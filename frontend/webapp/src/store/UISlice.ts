/**
 * UISlice.ts
 *
 * Redux slice managing transient UI state that does not belong to any data
 * domain slice. Owns four concerns:
 *  - currentCategory: the active step in the multi-step input page, advanced
 *    and retreated by nextCategory / prevCategory or jumped directly via
 *    setCurrentCategory.
 *  - inputMode: whether the input page runs in beginner mode (only mandatory
 *    fields, categories without them are skipped) or full mode.
 *  - expandedSubInputs: a map tracking which sub-input rows are expanded,
 *    keyed by parent field ID.
 *  - validationErrors: a map of per-field error messages, set when a category
 *    is (re-)validated and cleared on field change or category transition.
 *  - calculationAttempted: whether the user has tried to trigger the final
 *    calculation while required fields were still missing. Required-field
 *    validation is not enforced per step, only once at that point, so this
 *    flag is what tells the input page's progress indicator and per-category
 *    views to start surfacing which categories and fields are still
 *    incomplete.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CategoryType, InputMode } from '../types/inputTypes';

// --- State ---

export interface UIState {
  /** The currently active input page step. */
  currentCategory: CategoryType;

  /** The active input mode; 'beginner' restricts the flow to mandatory fields. */
  inputMode: InputMode;

  // Categories which have been accessed at least once
  visitedCategories: CategoryType[];

  // Stores which subinput fields are expanded
  expandedSubInputs: { [parentId: string]: boolean };
  /** Active validation error messages, keyed by field ID. */
  validationErrors: { [fieldId: string]: string };

  /**
   * True once the user has attempted the final calculation with one or more
   * required fields still unfilled. Drives the red-outline / red-field
   * indicators across the input page until the missing data is filled in.
   */
  calculationAttempted: boolean;
}

const initialState: UIState = {
  currentCategory: 'Start',
  inputMode: 'full',
  visitedCategories: ['Start'],
  expandedSubInputs: {},
  validationErrors:  {},
  calculationAttempted: false,
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

    /** Switches between beginner (mandatory fields only) and full input mode. */
    setInputMode: (state, action: PayloadAction<InputMode>) => {
      state.inputMode = action.payload;
    },

    /**
     * Advances to the next category in the sequence.
     * Dispatched by the Next button in NavigationButtons. No-ops when already
     * on the final step. An optional payload provides the active (possibly
     * beginner-mode-filtered) step sequence; defaults to the full sequence.
     */
    nextCategory: (state, action: PayloadAction<CategoryType[] | undefined>) => {
      const categories = action.payload ?? CATEGORIES;
      const currentIndex = categories.indexOf(state.currentCategory);
      if (currentIndex >= 0 && currentIndex < categories.length - 1) {
        const next = categories[currentIndex + 1];
        state.currentCategory = next;
        if (!state.visitedCategories.includes(next)) {
          state.visitedCategories.push(next);
        }
      }
    },

    resetVisitedCategories: (state) => {
      state.visitedCategories = ['Start'];
    },

    /**
     * Called, when the "previous"-Button is clicked during input.
     * Accepts the same optional sequence payload as nextCategory.
     */
    prevCategory: (state, action: PayloadAction<CategoryType[] | undefined>) => {
      const categories = action.payload ?? CATEGORIES;
      const currentIndex = categories.indexOf(state.currentCategory);
      if (currentIndex > 0) {
        state.currentCategory = categories[currentIndex - 1];
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

    /**
     * Sets whether a calculation attempt has failed due to missing required
     * fields. Dispatched by NavigationButtons: true when "Berechnung starten"
     * is clicked with incomplete categories, false once the calculation
     * actually proceeds. Read by the progress bar and category views to
     * decide whether to surface incomplete-category and missing-field
     * indicators.
     */
    setCalculationAttempted: (state, action: PayloadAction<boolean>) => {
      state.calculationAttempted = action.payload;
    },

    /** Resets the entire UI slice to its initial state. */
    reset: () => initialState,
  },
});

// --- Actions ---

export const {
  setCurrentCategory,
  setInputMode,
  nextCategory,
  prevCategory,
  toggleSubInput,
  setSubInputExpanded,
  setValidationError,
  clearValidationError,
  clearAllValidationErrors,
  resetVisitedCategories,
  setCalculationAttempted,
  reset,
} = uiSlice.actions;

// --- Selectors ---

export const selectCurrentCategory = (state: { ui: UIState }) =>
  state.ui.currentCategory;

/** Returns the active input mode ('beginner' or 'full'). */
export const selectInputMode = (state: { ui: UIState }) =>
  state.ui.inputMode;

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

/** Returns true once a calculation attempt has failed due to missing required fields. */
export const selectCalculationAttempted = (state: { ui: UIState }) =>
  state.ui.calculationAttempted;

// --- Reducer ---

export default uiSlice.reducer;