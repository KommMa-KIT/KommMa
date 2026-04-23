/**
 * SelectionInputField.tsx
 *
 * Redux-connected wrapper around CustomSelect for single-value selection input
 * fields. Converts the flat string stored in Redux into the { value, label }
 * option format expected by React-Select, and maps the selected option back to
 * a plain string (or null when cleared) before dispatching to the store.
 * Clears any active validation error on change.
 *
 * See MultiSelectionInputField.tsx for the multi-value equivalent.
 */

import { useDispatch, useSelector } from 'react-redux';
import { InputFieldDefinition } from '../../../types/inputTypes';
import { setInput, selectFieldSource } from '../../../store/CommunitySlice';
import { selectValidationError, clearValidationError } from '../../../store/UISlice';
import CustomSelect from './CustomSelect';

// --- Types ---

interface SelectionInputFieldProps {
  field: InputFieldDefinition;
  /** Currently selected value; null when the field has not yet been answered. */
  value: string | null;
}

// --- Component ---

/**
 * SelectionInputField
 *
 * Sections:
 *  - Redux state (source, validation error)
 *  - Option derivations (full option list, currently selected option object)
 *  - handleChange — maps React-Select output back to Redux-compatible value
 *  - CustomSelect with placeholder/clearable behaviour driven by field.critical,
 *    and an inline validation error message
 */
const SelectionInputField = ({ field, value }: SelectionInputFieldProps) => {
  const dispatch = useDispatch();

  /** Active validation error message for this field, or undefined if none. */
  const validationError = useSelector(selectValidationError(field.id));

  /** Community/external source attached to this field, if any. */
  const source = useSelector(selectFieldSource(field.id));

  /** True when an external source is providing this field's value. */
  const hasSource = !!source;

  // --- Option derivations ---

  /** Full list of selectable options converted to React-Select { value, label } shape. */
  const options = field.selectable?.map(option => ({
    value: option,
    label: option,
  })) || [];

  /**
   * The single option object whose value matches the current Redux state,
   * or null when no value is set (required by React-Select for controlled mode).
   */
  const selectedOption = options.find(opt => opt.value === value) || null;

  // --- Handlers ---

  /**
   * Converts the React-Select selection back to a plain string and dispatches
   * it to the store. Dispatches null when the user clears the field, keeping
   * unset fields consistent with other field types. Also clears any outstanding
   * validation error.
   */
  const handleChange = (option: { value: string; label: string } | null) => {
    dispatch(setInput({ id: field.id, value: option?.value || null, userInput: true }));

    if (validationError) {
      dispatch(clearValidationError(field.id));
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <CustomSelect
            options={options}
            value={selectedOption}
            onChange={handleChange}
            /**
             * Critical fields show a mandatory prompt and disallow clearing,
             * while optional fields display a softer placeholder and allow
             * the user to deselect their choice.
             */
            placeholder={field.critical ? 'Bitte wählen...' : 'Optional'}
            isClearable={!field.critical}
            hasSource={hasSource}
          />
        </div>
      </div>

      {/* Inline validation error — only rendered when a message is present */}
      {validationError && (
        <p className="mt-1 text-xs text-red-600">{validationError}</p>
      )}
    </div>
  );
};

export default SelectionInputField;