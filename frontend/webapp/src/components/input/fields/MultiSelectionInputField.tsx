/**
 * MultiSelectionInputField.tsx
 *
 * Redux-connected wrapper around CustomMultiSelect for multi-value selection
 * input fields. Converts the flat string array stored in Redux into the
 * { value, label } option format expected by React-Select, and maps selection
 * changes back to a string array (or null when nothing is selected) before
 * dispatching to the store. Clears any active validation error on change.
 */

import { useDispatch, useSelector } from 'react-redux';
import { InputFieldDefinition } from '../../../types/inputTypes';
import { setInput, selectFieldSource } from '../../../store/CommunitySlice';
import { selectValidationError, clearValidationError } from '../../../store/UISlice';
import CustomMultiSelect from './CustomMultiSelect';

// --- Types ---

interface MultiSelectionInputFieldProps {
  field: InputFieldDefinition;
  /** Currently selected values; null when the field has not yet been answered. */
  value: string[] | null;
}

// --- Component ---

/**
 * MultiSelectionInputField
 *
 * Sections:
 *  - Redux state (source, validation error)
 *  - Option derivations (full option list, currently selected subset)
 *  - handleChange — maps React-Select output back to Redux-compatible values
 *  - CustomMultiSelect with inline validation error message
 */
const MultiSelectionInputField = ({ field, value }: MultiSelectionInputFieldProps) => {
  const dispatch = useDispatch();

  /** Community/external source attached to this field, if any. */
  const source = useSelector(selectFieldSource(field.id));

  /** Active validation error message for this field, or undefined if none. */
  const validationError = useSelector(selectValidationError(field.id));

  /** True when an external source is providing this field's value. */
  const hasSource = !!source;

  /** Normalise null to an empty array so array methods can be applied safely. */
  const selectedValues = value || [];

  // --- Option derivations ---

  /** Full list of selectable options converted to React-Select { value, label } shape. */
  const options = field.selectable?.map(option => ({
    value: option,
    label: option,
  })) || [];

  /** Subset of options whose values are present in the current Redux selection. */
  const selectedOptions = options.filter(opt => selectedValues.includes(opt.value));

  // --- Handlers ---

  /**
   * Converts the React-Select selection back to a plain string array and
   * dispatches it to the store. Dispatches null instead of an empty array
   * when the user clears all selections, keeping unset fields consistent
   * with other field types. Also clears any outstanding validation error.
   */
  const handleChange = (selected: readonly { value: string; label: string }[]) => {
    const values = selected.map(opt => opt.value);
    dispatch(setInput({
      id: field.id,
      value: values.length > 0 ? values : null,
      userInput: true,
    }));

    if (validationError) {
      dispatch(clearValidationError(field.id));
    }
  };

  return (
    <div className="relative">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <CustomMultiSelect
            options={options}
            value={selectedOptions}
            onChange={handleChange}
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

export default MultiSelectionInputField;