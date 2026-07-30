/**
 * NavigationButtons.tsx
 *
 * Sticky bottom bar containing the Back, Next, and Calculate buttons for the
 * multi-step input page. Back and Next move sequentially through the fixed
 * category order (Start → General → Energy → Mobility → Water → End); the
 * InputProgressBar circles allow jumping directly to any category instead.
 * Start is the only step that blocks forward navigation on its own — a
 * commune must be selected before Next is enabled there. The four data
 * categories (General, Energy, Mobility, Water) have no such per-step gate:
 * their required fields are only validated once, together, when the user
 * clicks "Berechnung starten".
 *
 * When that validation finds missing required fields, the calculation does
 * not start. Instead, calculationAttempted is set in the store, which
 * InputProgressBar reads to outline incomplete categories in red. This
 * component complements that by re-validating whichever category is
 * currently visible whenever calculationAttempted is true — on first failure
 * and on every subsequent category change — so the missing fields on the
 * active page are marked red for the user to fix.
 *
 * Field definitions are loaded once on mount and reused for both the
 * pre-calculation validation pass and the per-view re-validation above.
 */

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronLeft, ChevronRight, Calculator } from 'lucide-react';
import Button from '../Button';
import {
  nextCategory,
  prevCategory,
  selectCurrentCategory,
  selectInputMode,
  setValidationError,
  clearAllValidationErrors,
  setCalculationAttempted,
  selectCalculationAttempted,
} from '../../store/UISlice';
import {
  selectCommuneKey,
  selectAllInputs,
} from '../../store/CommunitySlice';
import { CategoryType } from '../../types/inputTypes';
import { calculateResults } from '../../store/ResultSlice';
import { useNavigate } from 'react-router-dom';
import type { AppDispatch } from '../../store/store';
import communityService from '../../services/CommunityService';
import { validateCategory } from '../../utils/validationHelper';
import { getVisibleCategories } from '../../utils/inputModeHelper';

// --- Component ---

/**
 * NavigationButtons
 *
 * Sections:
 *  - Redux state and derived navigation flags
 *  - Start-page validity check
 *  - Field-definition loading via useEffect
 *  - Per-view validation effect — validates the active category's fields
 *    whenever it is shown, but only once a calculation attempt has failed
 *  - handleBack, handleNext, handleCalculate — navigation and calculation handlers
 *  - getCategoryLabel — pure category → localised string helper
 *  - Sticky bar render: Back button, page indicator, Next/Calculate button
 */
const NavigationButtons = () => {
  const dispatch = useDispatch<AppDispatch>();

  /** The currently active category step. */
  const currentCategory = useSelector(selectCurrentCategory);

  /** True once a calculation attempt has failed due to missing required fields. */
  const calculationAttempted = useSelector(selectCalculationAttempted);

  /** The selected commune key; null when no commune has been chosen. */
  const communeKey = useSelector(selectCommuneKey);

  /** The selected reference commune; null or 'none' when unset. */
  const referenceCommune = useSelector((state: any) => state.community.selectedReferenceCommune);

  /** All current input values keyed by field ID. */
  const inputs = useSelector(selectAllInputs);

  /** The active input mode; beginner mode skips categories without mandatory fields. */
  const inputMode = useSelector(selectInputMode);

  const navigate = useNavigate();

  /**
   * Field definitions for all categories, keyed by category name.
   * Populated once on mount; used for both the pre-calculation validation
   * pass and the per-view re-validation while calculationAttempted is true.
   */
  const [categoryFields, setCategoryFields] = useState<any>({});

  /** True while the field-definition fetch is in progress; blocks validation until ready. */
  const [fieldsLoading, setFieldsLoading] = useState(true);

  // --- Navigation state ---

  /**
   * Ordered sequence of the category steps visible in the active mode.
   * In beginner mode, data categories without mandatory fields are skipped;
   * the full sequence is used while field definitions are still loading.
   */
  const categories: CategoryType[] = getVisibleCategories(
    inputMode,
    fieldsLoading ? undefined : categoryFields
  );

  const currentIndex = categories.indexOf(currentCategory);

  const isFirstPage = currentIndex === 0;
  const isLastPage  = currentIndex === categories.length - 1;

  /**
   * The Start page is considered valid when either a direct commune key is set
   * or a reference commune (other than the placeholder 'none') has been selected.
   * This is the only per-step check that blocks forward navigation — every
   * other category can be entered, left, and skipped freely regardless of its
   * fill state.
   */
  const isStartValid = communeKey !== null || (referenceCommune !== null && referenceCommune !== 'none');

  // --- Data loading ---

  /**
   * Fetches all input field definitions on mount. Stored in component state
   * rather than Redux because this data is only needed for validation and
   * does not need to be shared across the tree.
   */
  useEffect(() => {
    const loadFields = async () => {
      try {
        setFieldsLoading(true);
        const allFields = await communityService.getInputParameters();
        setCategoryFields(allFields);
      } catch (err) {
        console.error('Error loading field definitions:', err);
      } finally {
        setFieldsLoading(false);
      }
    };
    loadFields();
  }, []);

  // --- Validation effects ---

  /**
   * Clears any existing field errors whenever the active category changes,
   * then, if a calculation attempt has already failed once, immediately
   * re-validates the newly active category and marks its missing required
   * fields red. Also re-runs when calculationAttempted itself turns true, so
   * the category the user is already viewing gets marked as soon as
   * "Berechnung starten" fails, without needing to navigate away and back.
   */
  useEffect(() => {
    dispatch(clearAllValidationErrors());

    if (fieldsLoading || !calculationAttempted) return;
    if (!DATA_CATEGORIES.includes(currentCategory)) return;

    const fields = categoryFields[currentCategory] || [];
    const invalidFields = validateCategory(fields, inputs);

    invalidFields.forEach(fieldId => {
      dispatch(setValidationError({
        fieldId,
        error: 'Dieses Pflichtfeld muss ausgefüllt werden',
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCategory, calculationAttempted, fieldsLoading, dispatch]);

  // --- Handlers ---

  /**
   * Navigates to the previous category and scrolls to the top.
   */
  const handleBack = () => {
    if (!isFirstPage) {
      dispatch(clearAllValidationErrors());
      dispatch(prevCategory(categories));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  /**
   * Advances to the next category. The only gate is on the Start page, which
   * requires a commune selection before the user can move on. Every other
   * category advances unconditionally; required-field validation for the
   * data categories happens once, in handleCalculate.
   */
  const handleNext = () => {
    if (!isLastPage) {
      if (currentCategory === 'Start' && !isStartValid) {
        alert('Bitte wählen Sie zunächst eine Kommune aus.');
        return;
      }

      if (!fieldsLoading && !validateCurrentCategory()) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      dispatch(nextCategory(categories));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  /**
   * Runs a single, full validation pass across all four data categories
   * before dispatching the calculation.
   *
   * If any category still has missing required fields, the calculation is
   * not started; calculationAttempted is set to true instead, which drives
   * the red outline on InputProgressBar and, via the effect above, marks the
   * missing fields on the currently visible category.
   *
   * If validation passes, calculationAttempted is cleared, the user is
   * navigated to the result page immediately, and the calculation runs
   * asynchronously in the background.
   */
  const handleCalculate = async () => {
    if (!fieldsLoading) {
      const hasIncompleteCategory = DATA_CATEGORIES.some(cat => {
        const fields = categoryFields[cat] || [];
        return validateCategory(fields, inputs).length > 0;
      });

      if (hasIncompleteCategory) {
        dispatch(setCalculationAttempted(true));
        return;
      }
    }

    dispatch(setCalculationAttempted(false));

    try {
      navigate('/result');
      await dispatch(calculateResults()).unwrap();
    } catch (error) {
      console.error('Calculation failed:', error);
    }
  };

  return (
    <div className="sticky bottom-0 bg-white border-t border-gray-200 shadow-lg z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">

          {/* Back button */}
          <Button
            onClick={handleBack}
            disabled={isFirstPage}
            variant="outline"
            size="lg"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Zurück</span>
          </Button>

          {/* Category indicator — page number and current step label */}
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Seite {currentIndex + 1} von {categories.length}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {currentCategory === 'Start'    && 'Gemeinde auswählen'}
              {currentCategory === 'General'  && 'Allgemeine Angaben'}
              {currentCategory === 'Energy'   && 'Energie'}
              {currentCategory === 'Mobility' && 'Mobilität'}
              {currentCategory === 'Water'    && 'Wasser'}
              {currentCategory === 'End'      && (inputMode === 'beginner' ? 'Abschluss' : 'Fördermittel & Abschluss')}
            </p>
          </div>

          {/* Next / Calculate button — swaps to Calculate on the final page */}
          {isLastPage ? (
            <Button
              onClick={handleCalculate}
              variant="default"
              size="lg"
              className="bg-green-600 hover:bg-green-700 shadow-md"
              disabled={fieldsLoading}
            >
              <Calculator className="h-4 w-4" />
              <span>Berechnung starten</span>
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={currentCategory === 'Start' && !isStartValid}
              variant="default"
              size="lg"
            >
              <span>Weiter</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

        </div>
      </div>
    </div>
  );
};

export default NavigationButtons;