/**
 * NumberInputField.tsx
 *
 * Redux-connected numeric input field. Accepts floating-point values and
 * dispatches them to the store on every valid keystroke. Empty input is
 * treated as null (unset) rather than zero, keeping unset fields consistent
 * with other field types. Non-numeric input is silently ignored.
 * Renders in a muted style when the value originates from an external source,
 * and displays an inline validation error when one is present.
 */

import { useDispatch, useSelector } from 'react-redux';
import { InputFieldDefinition } from '../../../types/inputTypes';
import { setInput, selectFieldSource } from '../../../store/CommunitySlice';
import { selectValidationError, clearValidationError } from '../../../store/UISlice';

// --- Types ---

interface NumberInputFieldProps {
  field: InputFieldDefinition;
  /** Currently stored numeric value; null when the field has not yet been answered. */
  value: number | null;
}

// --- Component ---

/**
 * NumberInputField
 *
 * Sections:
 *  - Redux state (source, validation error)
 *  - handleChange — parses raw string input and dispatches to the store
 *  - Styled <input type="number"> with optional unit label and validation error
 */
const NumberInputField = ({ field, value }: NumberInputFieldProps) => {
  const dispatch = useDispatch();

  /** Active validation error message for this field, or undefined if none. */
  const validationError = useSelector(selectValidationError(field.id));

  /** Community/external source attached to this field, if any. */
  const source = useSelector(selectFieldSource(field.id));

  /** True when an external source is providing this field's value. */
  const hasSource = !!source;

  // --- Handlers ---

  /**
   * Parses the raw input string and dispatches the result to the store.
   *
   * Three cases are handled:
   *  1. Empty string  → dispatches null so the field is treated as unset.
   *  2. Valid number  → dispatches the parsed float and clears any validation error.
   *  3. Non-numeric   → silently ignored; the store value remains unchanged.
   */
  const handleChange = (newValue: string) => {
    if (newValue === '') {
      dispatch(setInput({ id: field.id, value: null, userInput: true }));
      return;
    }

    const numValue = parseFloat(newValue);
    if (!isNaN(numValue)) {
      dispatch(setInput({ id: field.id, value: numValue, userInput: true }));

      if (validationError) {
        dispatch(clearValidationError(field.id));
      }
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <input
          type="number"
          /** Null is mapped to an empty string so the input renders as blank rather than "0". */
          value={value ?? ''}
          onChange={(e) => handleChange(e.target.value)}
          className={`
            flex-1 px-3 py-2 border rounded-lg
            focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent
            ${hasSource
              ? 'bg-gray-100 text-gray-600 border-gray-300'
              : 'bg-white border-gray-300'
            }
            ${validationError ? 'border-red-500' : ''}
          `}
        />

        {/* Unit label — only rendered when the field definition includes a unit */}
        {field.unit && (
          <span className="text-sm text-gray-600 whitespace-nowrap">
            {field.unit}
          </span>
        )}
      </div>

      {/* Inline validation error — only rendered when a message is present */}
      {validationError && (
        <p className="mt-1 text-xs text-red-600">{validationError}</p>
      )}
    </div>
  );
};

export default NumberInputField;