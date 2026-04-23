/**
 * NavigationButtons.tsx
 *
 * Sticky bottom bar containing the Back, Next, and Calculate buttons for the
 * multi-step input page. Manages forward/backward navigation across the fixed
 * category sequence (Start → General → Energy → Mobility → Water → End),
 * validates the current category before allowing forward navigation, and
 * triggers the full calculation once the user reaches the final page.
 *
 * Field definitions are loaded once on mount and reused for all per-category
 * and pre-calculation validation passes.
 */

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronLeft, ChevronRight, Calculator } from 'lucide-react';
import Button from '../Button';
import {
  nextCategory,
  prevCategory,
  selectCurrentCategory,
  setValidationError,
  clearAllValidationErrors,
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

// --- Component ---

/**
 * NavigationButtons
 *
 * Sections:
 *  - Redux state and derived navigation flags
 *  - Start-page validity check
 *  - Field-definition loading via useEffect
 *  - Validation-error clear effect on category change
 *  - validateCurrentCategory — validates the active category and dispatches errors
 *  - handleBack, handleNext, handleCalculate — navigation and calculation handlers
 *  - getCategoryLabel — pure category → localised string helper
 *  - Sticky bar render: Back button, page indicator, Next/Calculate button
 */
const NavigationButtons = () => {
  const dispatch = useDispatch<AppDispatch>();

  /** The currently active category step. */
  const currentCategory = useSelector(selectCurrentCategory);

  /** The selected commune key; null when no commune has been chosen. */
  const communeKey = useSelector(selectCommuneKey);

  /** The selected reference commune; null or 'none' when unset. */
  const referenceCommune = useSelector((state: any) => state.community.selectedReferenceCommune);

  /** All current input values keyed by field ID. */
  const inputs = useSelector(selectAllInputs);

  const navigate = useNavigate();

  /**
   * Field definitions for all categories, keyed by category name.
   * Populated once on mount; used for both per-step and pre-calculation validation.
   */
  const [categoryFields, setCategoryFields] = useState<any>({});

  /** True while the field-definition fetch is in progress; blocks validation during load. */
  const [fieldsLoading, setFieldsLoading] = useState(true);

  // --- Navigation state ---

  /** Ordered sequence of all category steps in the input flow. */
  const categories: CategoryType[] = ['Start', 'General', 'Energy', 'Mobility', 'Water', 'End'];

  const currentIndex = categories.indexOf(currentCategory);

  const isFirstPage = currentIndex === 0;
  const isLastPage  = currentIndex === categories.length - 1;

  /**
   * The Start page is considered valid when either a direct commune key is set
   * or a reference commune (other than the placeholder 'none') has been selected.
   */
  const isStartValid = communeKey !== null || (referenceCommune !== null && referenceCommune !== 'none');

  // --- Data loading ---

  /**
   * Fetches all input field definitions on mount. Stored in component state
   * rather than Redux because this data is only needed for navigation-time
   * validation and does not need to be shared across the tree.
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
   * Clears all active validation errors whenever the user navigates to a new
   * category, preventing stale error states from a previous step from bleeding
   * into the newly displayed fields.
   */
  useEffect(() => {
    dispatch(clearAllValidationErrors());
  }, [currentCategory, dispatch]);

  // --- Validation logic ---

  /**
   * Validates all required fields in the current category.
   * Start and End categories have no mandatory fields and always pass.
   * For all other categories, invalid field IDs are collected and dispatched
   * as individual validation errors so the UI can highlight each one.
   *
   * @returns True when the category is valid and navigation may proceed.
   */
  const validateCurrentCategory = (): boolean => {
    if (currentCategory === 'Start' || currentCategory === 'End') {
      return true;
    }

    const fields = categoryFields[currentCategory] || [];
    const invalidFields = validateCategory(fields, inputs);

    if (invalidFields.length > 0) {
      invalidFields.forEach(fieldId => {
        dispatch(setValidationError({
          fieldId,
          error: 'Dieses Pflichtfeld muss ausgefüllt werden',
        }));
      });
      return false;
    }

    dispatch(clearAllValidationErrors());
    return true;
  };

  // --- Handlers ---

  /**
   * Navigates to the previous category and scrolls to the top.
   * Clears validation errors so the previous step renders without stale highlights.
   */
  const handleBack = () => {
    if (!isFirstPage) {
      dispatch(clearAllValidationErrors());
      dispatch(prevCategory());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  /**
   * Validates the current category and, if valid, advances to the next one.
   * On the Start page, also enforces that a commune selection has been made
   * before allowing the user to proceed.
   * Scrolls to the top on both success and validation failure (to reveal the
   * error banner rendered by MainView near the top of the page).
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

      dispatch(nextCategory());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  /**
   * Runs a full validation pass across all four data categories before
   * dispatching the calculation. Alerts the user and aborts if any category
   * still has unfilled required fields. On success, navigates to the result
   * page immediately and awaits the async calculation in the background.
   */
  const handleCalculate = async () => {
    if (!fieldsLoading) {
      const categoriesToValidate: ('General' | 'Energy' | 'Mobility' | 'Water')[] =
        ['General', 'Energy', 'Mobility', 'Water'];

      for (const cat of categoriesToValidate) {
        const fields = categoryFields[cat] || [];
        const invalidFields = validateCategory(fields, inputs);

        if (invalidFields.length > 0) {
          alert(`Bitte füllen Sie alle Pflichtfelder in der Kategorie "${getCategoryLabel(cat)}" aus.`);
          return;
        }
      }
    }

    try {
      navigate('/result');
      await dispatch(calculateResults()).unwrap();
    } catch (error) {
      console.error('Calculation failed:', error);
    }
  };

  // --- Helpers ---

  /** Returns the localised display label for a given category key. */
  const getCategoryLabel = (category: string): string => {
    switch (category) {
      case 'General':  return 'Allgemeine Angaben';
      case 'Energy':   return 'Energie';
      case 'Mobility': return 'Mobilität';
      case 'Water':    return 'Wasser';
      default:         return category;
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
              {currentCategory === 'End'      && 'Fördermittel & Abschluss'}
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
              disabled={(currentCategory === 'Start' && !isStartValid) || fieldsLoading}
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