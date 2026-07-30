/**
 * InputModeToggle.tsx
 *
 * A compact control on the input page for switching between beginner mode
 * (only mandatory fields, categories without them are skipped) and the full
 * input. Entered values live in the Redux store keyed by field ID, so nothing
 * is lost when switching in either direction.
 *
 * Whenever the current category is not part of the active mode's step sequence
 * (e.g. after switching to beginner mode while on a category without mandatory
 * fields), the user is forwarded to the next visible step so they are never
 * stranded on an unreachable page.
 */

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ListFilter, LayoutList } from 'lucide-react';
import {
  selectCurrentCategory,
  selectInputMode,
  setCurrentCategory,
  setInputMode,
} from '../../store/UISlice';
import { CategorizedFields, InputMode } from '../../types/inputTypes';
import communityService from '../../services/CommunityService';
import { ALL_CATEGORIES, getVisibleCategories } from '../../utils/inputModeHelper';

// --- Component ---

/**
 * InputModeToggle
 *
 * Sections:
 *  - Field-definition loading via useEffect (needed to compute the beginner
 *    step sequence)
 *  - Stranded-category correction effect
 *  - Render: current-mode label and the opposite-mode switch button
 */
const InputModeToggle = () => {
  const dispatch = useDispatch();

  /** The active input mode. */
  const inputMode = useSelector(selectInputMode);

  /** The currently active category step. */
  const currentCategory = useSelector(selectCurrentCategory);

  /**
   * Field definitions for all categories, used to determine which steps remain
   * visible after switching to beginner mode.
   */
  const [categoryFields, setCategoryFields] = useState<CategorizedFields>();

  // --- Data loading ---

  /** Fetches all input field definitions on mount. */
  useEffect(() => {
    const loadFields = async () => {
      try {
        const allFields = await communityService.getInputParameters();
        setCategoryFields(allFields);
      } catch (err) {
        console.error('Error loading field definitions:', err);
      }
    };
    loadFields();
  }, []);

  // --- Stranded-category correction ---

  /**
   * Forwards the user to the next visible step whenever the current category
   * is not part of the active mode's step sequence (a category without
   * mandatory fields while in beginner mode). Running as an effect covers
   * both toggle clicks and entering the input page with a stale category.
   */
  useEffect(() => {
    if (!categoryFields) return;

    const visibleCategories = getVisibleCategories(inputMode, categoryFields);
    if (!visibleCategories.includes(currentCategory)) {
      const currentIndex = ALL_CATEGORIES.indexOf(currentCategory);
      const nextVisible =
        ALL_CATEGORIES.slice(currentIndex + 1).find(cat => visibleCategories.includes(cat)) ?? 'End';
      dispatch(setCurrentCategory(nextVisible));
    }
  }, [inputMode, currentCategory, categoryFields, dispatch]);

  // --- Handlers ---

  /** Switches to the given mode; the effect above corrects the step if needed. */
  const handleSwitch = (mode: InputMode) => {
    dispatch(setInputMode(mode));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 flex items-center justify-end gap-2 text-sm">
      {inputMode === 'beginner' ? (
        <>
          <span className="text-gray-500">
            Einsteiger-Modus aktiv — es werden nur Pflichtfelder abgefragt.
          </span>
          <button
            type="button"
            onClick={() => handleSwitch('full')}
            className="inline-flex items-center gap-1 font-medium text-green-800 hover:text-green-900 underline underline-offset-2"
          >
            <LayoutList className="h-4 w-4" />
            Alle Eingabefelder anzeigen
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => handleSwitch('beginner')}
          className="inline-flex items-center gap-1 font-medium text-gray-600 hover:text-green-800 underline underline-offset-2"
        >
          <ListFilter className="h-4 w-4" />
          Nur Pflichtfelder anzeigen (Einsteiger-Modus)
        </button>
      )}
    </div>
  );
};

export default InputModeToggle;
