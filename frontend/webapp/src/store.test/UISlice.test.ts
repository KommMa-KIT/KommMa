/**
 * UISlice.additional.test.ts
 *
 * Additional tests to reach ~100% coverage for UISlice.
 * Covers: visitedCategories tracking, boundary navigation, resetVisitedCategories,
 * selectVisitedCategories selector, and all uncovered branches.
 */

import reducer, {
  UIState,
  setCurrentCategory,
  nextCategory,
  prevCategory,
  toggleSubInput,
  setSubInputExpanded,
  setValidationError,
  clearValidationError,
  resetVisitedCategories,
  reset,
  selectCurrentCategory,
  selectVisitedCategories,
  selectIsSubInputExpanded,
  selectValidationErrors,
  selectValidationError,
  selectHasValidationErrors,
} from '../store/UISlice';

describe('uiSlice – additional coverage', () => {
  const fullInitialState: UIState = {
    currentCategory: 'Start',
    visitedCategories: ['Start'],
    expandedSubInputs: {},
    validationErrors: {},
  };

  // Helper to produce a state with a given category and visited list
  const stateWith = (
    currentCategory: UIState['currentCategory'],
    visitedCategories: UIState['currentCategory'][] = ['Start'],
    extras: Partial<UIState> = {}
  ): UIState => ({
    ...fullInitialState,
    currentCategory,
    visitedCategories,
    ...extras,
  });

  // ─── visitedCategories tracking ──────────────────────────────────────────

  describe('visitedCategories tracking', () => {
    it('Start is in visitedCategories from initial state', () => {
      expect(fullInitialState.visitedCategories).toContain('Start');
    });

    it('setCurrentCategory adds new category to visitedCategories', () => {
      const next = reducer(fullInitialState, setCurrentCategory('General'));
      expect(next.visitedCategories).toContain('General');
      expect(next.visitedCategories).toContain('Start');
    });

    it('setCurrentCategory does NOT duplicate already-visited categories', () => {
      const state = stateWith('General', ['Start', 'General']);
      const next = reducer(state, setCurrentCategory('General'));
      const occurrences = next.visitedCategories.filter((c) => c === 'General').length;
      expect(occurrences).toBe(1);
    });

    it('nextCategory adds the new category to visitedCategories when not yet visited', () => {
      const next = reducer(fullInitialState, nextCategory());
      expect(next.currentCategory).toBe('General');
      expect(next.visitedCategories).toContain('General');
    });

    it('nextCategory does NOT duplicate an already-visited category', () => {
      const state = stateWith('Start', ['Start', 'General']);
      const next = reducer(state, nextCategory());
      const occurrences = next.visitedCategories.filter((c) => c === 'General').length;
      expect(occurrences).toBe(1);
    });

    it('prevCategory does NOT add categories to visitedCategories', () => {
      const state = stateWith('Energy', ['Start', 'General', 'Energy']);
      const next = reducer(state, prevCategory());
      // Going back should not push 'General' again
      const occurrences = next.visitedCategories.filter((c) => c === 'General').length;
      expect(occurrences).toBe(1);
    });
  });

  // ─── resetVisitedCategories ───────────────────────────────────────────────

  describe('resetVisitedCategories', () => {
    it('resets visitedCategories to only ["Start"]', () => {
      const state = stateWith('Water', ['Start', 'General', 'Energy', 'Mobility', 'Water']);
      const next = reducer(state, resetVisitedCategories());
      expect(next.visitedCategories).toEqual(['Start']);
    });

    it('does not change currentCategory when resetting visited categories', () => {
      const state = stateWith('Energy', ['Start', 'General', 'Energy']);
      const next = reducer(state, resetVisitedCategories());
      expect(next.currentCategory).toBe('Energy');
    });
  });

  // ─── nextCategory – boundary ──────────────────────────────────────────────

  describe('nextCategory boundary', () => {
    it('does not advance past the last category (End)', () => {
      const state = stateWith('End', ['Start', 'General', 'Energy', 'Mobility', 'Water', 'End']);
      const next = reducer(state, nextCategory());
      expect(next.currentCategory).toBe('End');
    });

    it('moves through every category in sequence', () => {
      const sequence: UIState['currentCategory'][] = ['Start', 'General', 'Energy', 'Mobility', 'Water', 'End'];
      let state = fullInitialState;
      for (let i = 1; i < sequence.length; i++) {
        state = reducer(state, nextCategory());
        expect(state.currentCategory).toBe(sequence[i]);
      }
    });
  });

  // ─── prevCategory – boundary ──────────────────────────────────────────────

  describe('prevCategory boundary', () => {
    it('does not go before the first category (Start)', () => {
      const next = reducer(fullInitialState, prevCategory());
      expect(next.currentCategory).toBe('Start');
    });

    it('moves through every category in reverse', () => {
      const sequence: UIState['currentCategory'][] = ['End', 'Water', 'Mobility', 'Energy', 'General', 'Start'];
      let state = stateWith('End', ['Start', 'General', 'Energy', 'Mobility', 'Water', 'End']);
      for (let i = 1; i < sequence.length; i++) {
        state = reducer(state, prevCategory());
        expect(state.currentCategory).toBe(sequence[i]);
      }
    });
  });

  // ─── toggleSubInput ───────────────────────────────────────────────────────

  describe('toggleSubInput', () => {
    it('starts as false (undefined → toggled to true)', () => {
      const next = reducer(fullInitialState, toggleSubInput('newParent'));
      expect(next.expandedSubInputs['newParent']).toBe(true);
    });

    it('can toggle multiple different parents independently', () => {
      let state = reducer(fullInitialState, toggleSubInput('p1'));
      state = reducer(state, toggleSubInput('p2'));
      expect(state.expandedSubInputs['p1']).toBe(true);
      expect(state.expandedSubInputs['p2']).toBe(true);
      state = reducer(state, toggleSubInput('p1'));
      expect(state.expandedSubInputs['p1']).toBe(false);
      expect(state.expandedSubInputs['p2']).toBe(true);
    });
  });

  // ─── setSubInputExpanded ──────────────────────────────────────────────────

  describe('setSubInputExpanded', () => {
    it('sets to false explicitly', () => {
      const state: UIState = { ...fullInitialState, expandedSubInputs: { p1: true } };
      const next = reducer(state, setSubInputExpanded({ parentId: 'p1', expanded: false }));
      expect(next.expandedSubInputs['p1']).toBe(false);
    });

    it('creates entry for a new parentId', () => {
      const next = reducer(fullInitialState, setSubInputExpanded({ parentId: 'brand-new', expanded: true }));
      expect(next.expandedSubInputs['brand-new']).toBe(true);
    });
  });

  // ─── setValidationError ───────────────────────────────────────────────────

  describe('setValidationError', () => {
    it('can overwrite an existing error', () => {
      const state: UIState = { ...fullInitialState, validationErrors: { f1: 'Old error' } };
      const next = reducer(state, setValidationError({ fieldId: 'f1', error: 'New error' }));
      expect(next.validationErrors['f1']).toBe('New error');
    });

    it('can set errors on multiple fields', () => {
      let state = reducer(fullInitialState, setValidationError({ fieldId: 'a', error: 'Err A' }));
      state = reducer(state, setValidationError({ fieldId: 'b', error: 'Err B' }));
      expect(state.validationErrors['a']).toBe('Err A');
      expect(state.validationErrors['b']).toBe('Err B');
    });
  });

  // ─── clearValidationError ────────────────────────────────────────────────

  describe('clearValidationError', () => {
    it('is a no-op when the fieldId does not exist', () => {
      const next = reducer(fullInitialState, clearValidationError('nonexistent'));
      expect(next.validationErrors).toEqual({});
    });

    it('only removes the targeted field, leaving others intact', () => {
      const state: UIState = { ...fullInitialState, validationErrors: { f1: 'E1', f2: 'E2' } };
      const next = reducer(state, clearValidationError('f1'));
      expect(next.validationErrors['f1']).toBeUndefined();
      expect(next.validationErrors['f2']).toBe('E2');
    });
  });

  // ─── reset ────────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('clears visitedCategories back to ["Start"]', () => {
      const state = stateWith('Water', ['Start', 'General', 'Energy', 'Mobility', 'Water'], {
        expandedSubInputs: { p1: true },
        validationErrors: { f1: 'Err' },
      });
      const next = reducer(state, reset());
      expect(next.visitedCategories).toEqual(['Start']);
    });

    it('clears expandedSubInputs and validationErrors', () => {
      const state: UIState = {
        currentCategory: 'Energy',
        visitedCategories: ['Start', 'General', 'Energy'],
        expandedSubInputs: { p1: true },
        validationErrors: { f1: 'Err' },
      };
      const next = reducer(state, reset());
      expect(next.expandedSubInputs).toEqual({});
      expect(next.validationErrors).toEqual({});
    });
  });

  // ─── Selectors ─────────────────────────────────────────────────────────────

  describe('selectVisitedCategories', () => {
    it('returns the visited categories array', () => {
      const visited: UIState['currentCategory'][] = ['Start', 'General', 'Energy'];
      const state = { ui: { ...fullInitialState, visitedCategories: visited } };
      expect(selectVisitedCategories(state)).toEqual(visited);
    });

    it('returns default ["Start"] for fresh state', () => {
      const state = { ui: fullInitialState };
      expect(selectVisitedCategories(state)).toEqual(['Start']);
    });
  });

  describe('selectCurrentCategory', () => {
    it('returns End when set to End', () => {
      const state = { ui: stateWith('End') };
      expect(selectCurrentCategory(state)).toBe('End');
    });
  });

  describe('selectIsSubInputExpanded', () => {
    it('returns false for unknown parentId', () => {
      const state = { ui: fullInitialState };
      expect(selectIsSubInputExpanded('unknown')(state)).toBe(false);
    });

    it('returns true when explicitly set to true', () => {
      const state = { ui: { ...fullInitialState, expandedSubInputs: { p1: true } } };
      expect(selectIsSubInputExpanded('p1')(state)).toBe(true);
    });
  });

  describe('selectHasValidationErrors', () => {
    it('returns false when validationErrors is empty', () => {
      const state = { ui: fullInitialState };
      expect(selectHasValidationErrors(state)).toBe(false);
    });

    it('returns true when at least one error is present', () => {
      const state = { ui: { ...fullInitialState, validationErrors: { f1: 'e' } } };
      expect(selectHasValidationErrors(state)).toBe(true);
    });
  });

  describe('selectValidationErrors', () => {
    it('returns empty object initially', () => {
      expect(selectValidationErrors({ ui: fullInitialState })).toEqual({});
    });
  });

  describe('selectValidationError', () => {
    it('returns undefined for missing field', () => {
      expect(selectValidationError('missing')({ ui: fullInitialState })).toBeUndefined();
    });
  });
});