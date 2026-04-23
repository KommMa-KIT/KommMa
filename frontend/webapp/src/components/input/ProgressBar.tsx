/**
 * InputProgressBar.tsx
 *
 * A sticky progress bar rendered above the input page, showing all category
 * steps as clickable circles connected by a line. Each step is independently
 * assessed for accessibility (can the user jump to it?) and completion (have
 * all its required fields been filled?). Inaccessible steps are locked behind
 * the completion of all preceding categories, preventing the user from skipping
 * ahead with unfilled mandatory fields.
 */

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { CategoryType } from '../../types/inputTypes';
import { setCurrentCategory, selectCurrentCategory, clearAllValidationErrors, selectVisitedCategories } from '../../store/UISlice';
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

/** Ordered list of all input page steps. Order determines accessibility gating. */
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
 *  - isCategoryAccessible — gates navigation behind sequential completion
 *  - isCategoryCompleted — combines Start completion and validity for the checkmark
 *  - handleCategoryClick — dispatches navigation when the step is accessible
 *  - getCurrentIndex — returns the index of the active category
 *  - Render: circle row (with connector lines) and label row
 */
const InputProgressBar = () => {
  const dispatch = useDispatch();

  /** The currently active category step. */
  const currentCategory = useSelector(selectCurrentCategory);

  /** Categories which have been accessed at least once. */
  const visitedCategories = useSelector(selectVisitedCategories);

  /** The selected commune key; null when no commune has been chosen yet. */
  const communeKey = useSelector(selectCommuneKey);

  const referenceCommune = useSelector(selectReferenceCommune);

  /** All current input values keyed by field ID. */
  const inputs = useSelector(selectAllInputs);

  /**
   * Field definitions for all categories, keyed by category name.
   * Loaded once on mount and used to validate each step's completion state.
   */
  const [categoryFields, setCategoryFields] = useState<any>({});

  /** True while the field-definition fetch is in progress; suppresses validation until ready. */
  const [fieldsLoading, setFieldsLoading] = useState(true);

  // --- Data loading ---

  /**
   * Fetches all input field definitions on mount. The definitions are used
   * to evaluate each category's completion state on every render, so they
   * must be available before the progress bar can reflect accurate state.
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
   * All other accessibility and completion checks depend on this flag.
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
   * category. Start is always accessible. All other categories require Start
   * to be completed first, and then require every preceding category to be
   * valid — enforcing sequential completion without allowing gaps.
   */
  const isCategoryAccessible = (categoryId: CategoryType): boolean => {
    if (categoryId === 'Start') return true;
    if (!isStartCompleted)      return false;

    const targetIndex = categories.findIndex(cat => cat.id === categoryId);

    for (let i = 0; i < targetIndex; i++) {
      if (!isCategoryValid(categories[i].id)) {
        return false;
      }
    }

    return true;
  };

  /**
   * Returns true when the category should display a green checkmark.
   * No category is marked completed until Start itself is completed,
   * preventing misleading green states on an otherwise blank form.
   */
  const isCategoryCompleted = (categoryId: CategoryType): boolean => {
    if (!isStartCompleted) return false;
    if (!visitedCategories.includes(categoryId)) return false;
    return isCategoryValid(categoryId);
  };

  // --- Handlers ---

  /**
   * Navigates to the clicked category when it is accessible.
   * Clears all validation errors first so the newly displayed step
   * renders without stale highlights from the previous step.
   */
  const handleCategoryClick = (categoryId: CategoryType) => {
    if (isCategoryAccessible(categoryId)) {
      dispatch(clearAllValidationErrors());
      dispatch(setCurrentCategory(categoryId));
    }
  };

  /** Returns the index of the currently active category within the ordered list. */
  const getCurrentIndex = () => {
    return categories.findIndex(cat => cat.id === currentCategory);
  };

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm sticky top-20 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">

        {/* Circle row — one button per step, connected by progress lines */}
        <div className="flex items-center justify-between mb-2">
          {categories.map((category, index) => {
            const isActive     = category.id === currentCategory;
            const isAccessible = isCategoryAccessible(category.id);
            const isCompleted  = isCategoryCompleted(category.id);

            /** True when this step precedes the active step in the sequence. */
            const isPast = index < getCurrentIndex();

            return (
              <div key={category.id} className="flex items-center flex-1">

                {/* Step circle — icon varies by state: check, lock, or step number */}
                <button
                  onClick={() => handleCategoryClick(category.id)}
                  disabled={!isAccessible}
                  className={`
                    relative flex items-center justify-center w-10 h-10 rounded-full
                    border-2 transition-all duration-200
                    ${isActive
                      ? 'border-secondary bg-secondary text-black shadow-lg scale-110'
                      : isCompleted || isPast
                        ? 'border-green-700 bg-green-700 text-white'
                        : isAccessible
                          ? 'border-gray-300 bg-white text-gray-600 hover:border-secondary hover:text-secondary cursor-pointer'
                          : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                    }
                  `}
                  title={category.label}
                >
                  {isCompleted || isPast ? (
                    <Check className="h-5 w-5" />
                  ) : !isAccessible ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </button>

                {/* Connector line — green when the step is past or completed, grey otherwise.
                    Not rendered after the final step. */}
                {index < categories.length - 1 && (
                  <div className="flex-1 h-0.5 mx-2">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isPast || isCompleted ? 'bg-green-700' : 'bg-gray-300'
                      }`}
                    />
                  </div>
                )}

              </div>
            );
          })}
        </div>

        {/* Label row — mirrors the circle row, highlighting the active step */}
        <div className="flex items-center justify-between">
          {categories.map((category, index) => {
            const isActive = category.id === currentCategory;

            return (
              <div
                key={`label-${category.id}`}
                className="flex items-center flex-1"
              >
                <div className="text-center" style={{ width: '40px' }}>
                  <span
                    className={`text-xs font-medium transition-colors ${
                      isActive ? 'text-secondary' : 'text-gray-600'
                    }`}
                  >
                    {category.label}
                  </span>
                </div>

                {/* Spacer — aligns labels with their corresponding circles */}
                {index < categories.length - 1 && (
                  <div className="flex-1 mx-2" />
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