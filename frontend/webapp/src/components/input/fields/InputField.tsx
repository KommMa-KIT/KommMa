/**
 * InputField.tsx
 *
 * Abstract, dynamically-typed input field that serves as the single entry point
 * for all data-input field types (number, selection, multiSelection, bool).
 * Resolves the correct concrete input component at runtime based on field.type,
 * and handles surrounding concerns: alternating row backgrounds, sub-input
 * expand/collapse, source tooltips, prefill indicators, and validation errors.
 *
 * Supports two nesting levels:
 *  - Level 0: top-level field rendered directly inside a category section.
 *  - Level 1: sub-input rendered inside a parent field's expanded sub-list.
 */

import { useSelector, useDispatch } from 'react-redux';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { InputFieldDefinition } from '../../../types/inputTypes';
import { toggleSubInput, selectIsSubInputExpanded, selectValidationError } from '../../../store/UISlice';
import { selectFieldSource, selectIndividual, selectInputValue } from '../../../store/CommunitySlice';
import NumberInputField from './NumberInputField';
import SelectionInputField from './SelectionInputField';
import MultiSelectionInputField from './MultiSelectionInputField';
import BoolInputField from './BoolInputField';
import SourceTooltip from '../SourceTooltip';

// --- Types ---

interface InputFieldProps {
  field: InputFieldDefinition;
  /** Index of the parent category; used to derive the alternating row background. */
  categoryIndex: number;
  /**
   * Nesting depth of this field.
   * 0 = top-level field, 1 = sub-input rendered inside an expanded parent.
   * Defaults to 0.
   */
  level?: number;
}

// --- Component ---

/**
 * InputField
 *
 * Renders a single row in the data-input form. Layout (left → right):
 *  - Optional expand/collapse chevron (only when subinputs exist)
 *  - Field title with optional required-field asterisk
 *  - Concrete input control (resolved via renderInputField)
 *  - Prefill indicator and source tooltip when the value comes from an external source
 *  - Field description
 *
 * When expanded, sub-inputs are rendered recursively below the row, indented
 * with a left border to convey hierarchy.
 */
const InputField = ({ field, categoryIndex, level = 0 }: InputFieldProps) => {
  const dispatch = useDispatch();

  /** Current stored value for this field; type varies by field.type. */
  const value = useSelector(selectInputValue(field.id));

  /** Active validation error message for this field, or undefined if none. */
  const validationError = useSelector(selectValidationError(field.id));

  /** Community/external source attached to this field, if any. */
  const source = useSelector(selectFieldSource(field.id));

  /** Whether the sub-input list is currently expanded in the UI. */
  const isExpanded = useSelector(selectIsSubInputExpanded(field.id));

  /** Map of field IDs to whether the user has individually overridden them. */
  const individual = useSelector(selectIndividual);

  /** True when this field has at least one sub-input child. */
  const hasSubInputs = field.subinputs && field.subinputs.length > 0;

  /** True when the user has personally set this field, overriding any source value. */
  const isIndividual = individual[field.id] === true;

  const hasValidationError = !!validationError;

  /** True when an external source is providing this field's value. */
  const hasSource = !!source;

  // --- Derived styles ---

  /**
   * Returns the Tailwind background class for this row.
   * Validation errors take priority (red tint). Sub-inputs invert the
   * even/odd rhythm relative to their parent to stay visually distinct.
   */
  const getBackgroundColor = () => {
    const isEven = categoryIndex % 2 === 0;

    if (hasValidationError) {
      return isEven ? 'bg-red-50' : 'bg-red-100';
    }

    if (level === 0) {
      return isEven ? 'bg-white' : 'bg-gray-50';
    }

    // Level 1 (sub-inputs) — inverted pattern keeps hierarchy visually distinct.
    return isEven ? 'bg-gray-50' : 'bg-white';
  };

  const bgColor = getBackgroundColor();

  /** Deeper left padding for sub-input rows to communicate nesting. */
  const paddingLeft = level === 0 ? 'pl-6' : 'pl-12';

  // --- Dynamic field renderer ---

  /**
   * Resolves and returns the concrete input component for this field's type.
   * Falls back to a plain error message for any unrecognised type, so unknown
   * field types fail visibly rather than silently.
   */
  const renderInputField = () => {
    switch (field.type) {
      case 'number':
        return <NumberInputField field={field} value={value as number | null} />;

      case 'selection':
        return <SelectionInputField field={field} value={value as string | null} />;

      case 'multiSelection':
        return <MultiSelectionInputField field={field} value={value as string[] | null} />;

      case 'bool':
        return <BoolInputField field={field} value={value as boolean | null} />;

      default:
        /* Unrecognised type — renders a visible error rather than silently rendering nothing. */
        return (
          <div className="text-sm text-gray-500">
            Unbekannter Feldtyp: {field.type}
          </div>
        );
    }
  };

  return (
    <div>
      {/* Main row */}
      <div className={`${bgColor} transition-colors`}>
        <div className={`flex items-start gap-4 py-4 ${paddingLeft} pr-6`}>

          {/* Expand/collapse chevron — only rendered when sub-inputs exist */}
          {hasSubInputs && (
            <button
              onClick={() => dispatch(toggleSubInput(field.id))}
              className="flex-shrink-0 mt-2 p-1 hover:bg-gray-200 rounded transition-colors"
              aria-label={isExpanded ? 'Zuklappen' : 'Aufklappen'}
            >
              {isExpanded
                ? <ChevronDown className="h-5 w-5 text-gray-600" />
                : <ChevronRight className="h-5 w-5 text-gray-600" />
              }
            </button>
          )}

          {/* Field title (left column) */}
          <div className={`flex-1 ${!hasSubInputs ? 'ml-6' : ''}`}>
            <label className="block text-sm font-semibold text-gray-900 mb-1 text-left">
              {field.title}
              {/* Required-field asterisk — only shown for critical fields */}
              {field.critical && (
                <span className="ml-1 text-red-500" title="Pflichtfeld">*</span>
              )}
            </label>
          </div>

          {/* Concrete input control (centre column) */}
          <div className="flex-1 pt-2">
            <div className="flex items-center">
              <div className="flex-1">
                {renderInputField()}
                {/* Prefill indicator — shown when the value is sourced externally
                    and the user has not yet overridden it individually */}
                {hasSource && !isIndividual && (
                  <p className="mt-1 text-xs text-gray-500 italic">
                    Durchschnittswert (nicht individuell)
                  </p>
                )}
              </div>

              {/* Fixed-width slot reserving space for the source tooltip so the
                  input width remains stable whether or not a tooltip is present */}
              <div className="w-8 flex justify-center">
                {hasSource && <SourceTooltip source={source} />}
              </div>
            </div>
          </div>

          {/* Field description (right column) */}
          <div className="flex-1">
            <p className="text-sm text-gray-600 leading-relaxed text-left">
              {field.description}
            </p>
          </div>

        </div>
      </div>

      {/* Sub-inputs — rendered recursively when the parent row is expanded */}
      {hasSubInputs && isExpanded && (
        <div className="border-l-2 border-secondary ml-6">
          {field.subinputs.map((subField, subIndex) => (
            <InputField
              key={subField.id}
              field={subField}
              categoryIndex={subIndex}
              level={1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default InputField;