/**
 * ProgressBar.tsx
 *
 * A sticky progress bar rendered above the input page, showing all category
 * steps as circle-and-label columns connected by a line. Start is the only
 * step that gates access to the rest: once a commune has been selected,
 * every remaining category (General, Energy, Mobility, Water, End) is freely
 * accessible and can be visited in any order.
 *
 * Each step circle reflects three independent pieces of state: whether it is
 * the currently active step (black border, stronger shadow, larger scale),
 * whether all of its required fields are filled and it has been visited
 * (green, with a checkmark), and — once a calculation attempt has failed due
 * to missing required fields — whether it is still incomplete (red border).
 * The connector line between two steps turns green once every category up to
 * that point has all required fields filled, regardless of whether the user
 * has actually visited those categories yet — it tracks fill state, not
 * navigation history.
 */

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { CategoryType } from '../../types/inputTypes';
import { setCurrentCategory, selectCurrentCategory, clearAllValidationErrors, selectVisitedCategories, selectCalculationAttempted } from '../../store/UISlice';
import { selectCommuneKey, selectAllInputs, selectReferenceCommune } from '../../store/CommunitySlice';
import { Check, Lock } from 'lucide-react';
import communityService from '../../services/CommunityService';
import { validateCategory } from '../../utils/validationHelper';

// --- Types ---

interface CategoryConfig {
  id: CategoryType;
  /** Localised display label shown beneath the step circle. */
  label: string;
}

// --- Constants ---

/** Ordered list of all input page steps, used for display order only — not for access gating. */
const categories: CategoryConfig[] = [
  { id: 'Start',    label: 'Start'       },
  { id: 'General',  label: 'Allgemeines' },
  { id: 'Energy',   label: 'Energie'     },
  { id: 'Mobility', label: 'Mobilität'   },
  { id: 'Water',    label: 'Wasser'      },
  { id: 'End',      label: 'Ende'        },
];

// --- Component ---

/**
 * InputProgressBar
 *
 * Sections:
 *  - Redux state and field-definition loading
 *  - isCategoryValid — checks whether all required fields in a category are filled
 *  - isCategoryAccessible — only Start gates access; everything else is always reachable
 *  - isCategoryCompleted — visited + valid, drives the green checkmark
 *  - hasError — drives the red border once a calculation attempt has failed
 *  - isSequenceCompleteUpTo — cumulative fill-state check for the connector line color
 *  - handleCategoryClick — dispatches navigation when the step is accessible
 *  - Render: one row of circle+label columns joined by connector lines
 */
const InputProgressBar = () => {
  const dispatch = useDispatch();

  /** The currently active category step. */
  const currentCategory = useSelector(selectCurrentCategory);

  /** Categories which have been accessed at least once. */
  const visitedCategories = useSelector(selectVisitedCategories);

  /** True once a calculation attempt has failed due to missing required fields. */
  const calculationAttempted = useSelector(selectCalculationAttempted);

  /** The selected commune key; null when no commune has been chosen yet. */
  const communeKey = useSelector(selectCommuneKey);

  const referenceCommune = useSelector(selectReferenceCommune);

  /** All current input values keyed by field ID. */
  const inputs = useSelector(selectAllInputs);

  /**
   * Field definitions for all categories, keyed by category name.
   * Loaded once on mount and used to derive each step's fill state for
   * both the checkmark and the red-outline display.
   */
  const [categoryFields, setCategoryFields] = useState<any>({});

  /** True while the field-definition fetch is in progress; suppresses state display until ready. */
  const [fieldsLoading, setFieldsLoading] = useState(true);

  // --- Data loading ---

  /**
   * Fetches all input field definitions on mount. The definitions are used
   * to evaluate each category's fill state on every render, so they must be
   * available before the progress bar can reflect accurate state.
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

  // --- Step state helpers ---

  /**
   * Start is considered complete once a commune key has been selected.
   * This is the only condition that gates access to the rest of the flow.
   */
  const isStartCompleted = communeKey !== null || referenceCommune !== null;

  /**
   * Returns true when all required fields in the given category are filled.
   * Start delegates to isStartCompleted; End is always considered valid since
   * it contains no mandatory fields. Returns false while field definitions
   * are still loading to prevent false positives.
   */
  const isCategoryValid = (categoryId: CategoryType): boolean => {
    if (categoryId === 'Start') return isStartCompleted;
    if (categoryId === 'End')   return true;

    if (fieldsLoading || !categoryFields[categoryId]) return false;

    const fields = categoryFields[categoryId] || [];
    const invalidFields = validateCategory(fields, inputs);
    return invalidFields.length === 0;
  };

  /**
   * Returns true when the user is permitted to navigate directly to the given
   * category. Start is always accessible. Every other category only requires
   * Start to be completed — order among General/Energy/Mobility/Water/End is
   * free, and any of them may be visited, left, and revisited in any sequence.
   */
  const isCategoryAccessible = (categoryId: CategoryType): boolean => {
    if (categoryId === 'Start') return true;
    return isStartCompleted;
  };

  /**
   * Returns true when the category should display a green checkmark: Start
   * must be completed, the category must have been visited at least once,
   * and all of its required fields must currently be filled.
   */
  const isCategoryCompleted = (categoryId: CategoryType): boolean => {
    if (!isStartCompleted) return false;
    if (!visitedCategories.includes(categoryId)) return false;
    return isCategoryValid(categoryId);
  };

  /**
   * Returns true when the category should be outlined in red: a calculation
   * attempt has failed due to missing required fields, and this category is
   * one of the ones still incomplete. Start/End are always valid, so this
   * never fires for them.
   */
  const hasError = (categoryId: CategoryType): boolean => {
    if (!calculationAttempted) return false;
    return !isCategoryValid(categoryId);
  };

  /**
   * Returns true only when every category up to and including the given
   * index currently has all of its required fields filled. Used to color
   * the connector line segment after that step. Deliberately based on fill
   * state alone (isCategoryValid), not on whether those categories have
   * actually been visited — so filling in a later category first still
   * counts toward the line turning green once everything before it is done.
   */
  const isSequenceCompleteUpTo = (index: number): boolean => {
    return categories.slice(0, index + 1).every(cat => isCategoryValid(cat.id));
  };

  // --- Handlers ---

  /**
   * Navigates to the clicked category when it is accessible.
   * Clears all validation errors first so the newly displayed step renders
   * without stale highlights from a previous category or calculation attempt.
   */
  const handleCategoryClick = (categoryId: CategoryType) => {
    if (isCategoryAccessible(categoryId)) {
      dispatch(clearAllValidationErrors());
      dispatch(setCurrentCategory(categoryId));
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm sticky top-20 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">

        {/* One row containing a circle+label column per step, with a connector
            line as a sibling between each pair of columns. Circle and label
            live in the same flex column (items-center), so the label is
            always exactly centered under its circle — this isn't recomputed
            from a separate, parallel row anymore. */}
        <div className="flex items-start justify-between">
          {categories.map((category, index) => {
            const isActive     = category.id === currentCategory;
            const isAccessible = isCategoryAccessible(category.id);
            const isCompleted  = isCategoryCompleted(category.id);
            const isInvalid    = hasError(category.id);

            return (
              <div key={category.id} className="flex items-start flex-1">

                {/* Step column — circle on top, label centered directly beneath it */}
                <div className="flex flex-col items-center" style={{ width: '48px' }}>

                  {/* Step circle — icon varies by state: check, lock, or step number.
                      Border color reflects state directly (no separate outer ring):
                      black for the active step, red once it's flagged incomplete
                      after a failed calculation attempt, green when complete, grey
                      otherwise. The active step additionally gets a stronger shadow
                      and a larger scale so it stands out beyond just its border. */}
                  <button
                    onClick={() => handleCategoryClick(category.id)}
                    disabled={!isAccessible}
                    className={`
                      relative flex items-center justify-center w-10 h-10 rounded-full
                      border-2 transition-all duration-200
                      ${isActive
                        ? 'border-black bg-secondary text-black shadow-xl scale-110'
                        : isInvalid
                          ? 'border-red-500 bg-white text-gray-600 hover:border-red-600 cursor-pointer'
                          : isCompleted
                            ? 'border-green-700 bg-green-700 text-white'
                            : isAccessible
                              ? 'border-gray-300 bg-white text-gray-600 hover:border-secondary hover:text-secondary cursor-pointer'
                              : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                      }
                    `}
                    title={category.label}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : !isAccessible ? (
                      <Lock className="h-4 w-4" />
                    ) : (
                      <span className="text-sm font-semibold">{index + 1}</span>
                    )}
                  </button>

                  {/* Label — sits in the same column as the circle above it, so it's
                      centered by construction rather than by matching widths across rows. */}
                  <span
                    className={`mt-2 text-xs font-medium text-center transition-colors ${
                      isActive ? 'text-secondary' : 'text-gray-600'
                    }`}
                  >
                    {category.label}
                  </span>
                </div>

                {/* Connector line — green once every category up to this point has all
                    required fields filled, grey otherwise. Vertically aligned with the
                    circles' center (mt-5), independent of the label beneath it. Not
                    rendered after the final step. */}
                {index < categories.length - 1 && (
                  <div className="flex-1 h-0.5 mx-2 mt-5">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isSequenceCompleteUpTo(index) ? 'bg-green-700' : 'bg-gray-300'
                      }`}
                    />
                  </div>
                )}

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};

export default InputProgressBar;