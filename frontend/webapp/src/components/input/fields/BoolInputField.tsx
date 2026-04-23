/**
 * BoolInputField.tsx
 *
 * A binary toggle input rendered as two mutually exclusive buttons ("Ja" / "Nein").
 * Dispatches the selected boolean value to the Redux store and clears any existing
 * validation error on change. Visually adapts when the field value originates from
 * a community source rather than direct user input (muted style, reduced opacity).
 */

import { useDispatch, useSelector } from 'react-redux';
import { Check, X } from 'lucide-react';
import { InputFieldDefinition } from '../../../types/inputTypes';
import { setInput, selectIndividual, selectFieldSource } from '../../../store/CommunitySlice';
import { selectValidationError, clearValidationError } from '../../../store/UISlice';

// --- Types ---

interface BoolInputFieldProps {
  field: InputFieldDefinition;
  /** Currently stored answer; null when the field has not yet been answered. */
  value: boolean | null;
}

// --- Helpers ---

/**
 * Builds the Tailwind class string for a Yes/No toggle button.
 *
 * The active state differs depending on whether the value was set by the user
 * directly (vivid colour fill) or pre-filled from a community source (muted grey
 * fill so the external origin is visually distinct).
 *
 * @param isSelected    Whether this button represents the current value.
 * @param hasSource     Whether the field value originates from a community source.
 * @param isIndividual  Whether the user has personally overridden the source value.
 * @param hasError      Whether a validation error is currently attached to the field.
 * @param activeColor   Tailwind colour token used for the selected border/background
 *                      (e.g. `'green'` for Ja, `'red'` for Nein).
 */
const buildButtonClass = (
  isSelected: boolean,
  hasSource: boolean,
  isIndividual: boolean,
  hasError: boolean,
  activeColor: 'green' | 'red',
): string => {
  /** Selected appearance: grey fill when sourced externally, vivid fill when user-set. */
  const selectedStyle = isSelected
    ? hasSource
      ? `border-${activeColor}-500 bg-gray-200 text-black`
      : `border-${activeColor}-500 bg-${activeColor}-500 text-white`
    : `border-gray-300 bg-white text-gray-700 hover:border-${activeColor}-300`;

  /** Dim the button when a source provides the value but the user hasn't overridden it. */
  const opacityStyle = hasSource && !isIndividual ? 'opacity-70' : '';

  /** Override border colour on validation failure. */
  const errorStyle = hasError ? 'border-red-500' : '';

  return `
    flex-1 px-4 py-2 rounded-lg border-2 font-medium transition-all
    flex items-center justify-center gap-2
    ${selectedStyle} ${opacityStyle} ${errorStyle}
  `;
};

// --- Component ---

/**
 * BoolInputField
 *
 * Renders a pair of styled toggle buttons for boolean data entry.
 * Sections:
 *  - Redux state derivations (source, individualisation flag, validation error)
 *  - handleToggle — dispatches the new value and clears any validation error
 *  - Button pair (Ja / Nein) with dynamic styling via buildButtonClass
 *  - Inline validation error message
 */
const BoolInputField = ({ field, value }: BoolInputFieldProps) => {
  const dispatch = useDispatch();

  /** Map of field IDs to whether the user has individually set them. */
  const individual = useSelector(selectIndividual);

  /** Active validation error message for this field, or undefined if none. */
  const validationError = useSelector(selectValidationError(field.id));

  /** Community/external source attached to this field, if any. */
  const source = useSelector(selectFieldSource(field.id));

  /** True when an external source is providing this field's value. */
  const hasSource = !!source;

  /** True when the user has personally set this field, overriding any source. */
  const isIndividual = individual[field.id] === true;

  // --- Handlers ---

  /**
   * Dispatches the toggled boolean value to the store.
   * Also clears any outstanding validation error so the UI resets immediately.
   */
  const handleToggle = (newValue: boolean) => {
    dispatch(setInput({ id: field.id, value: newValue, userInput: true }));

    if (validationError) {
      dispatch(clearValidationError(field.id));
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-3">

        {/* Ja (Yes) button */}
        <button
          type="button"
          onClick={() => handleToggle(true)}
          className={buildButtonClass(value === true, hasSource, isIndividual, !!validationError, 'green')}
        >
          <Check className="h-4 w-4" />
          <span>Ja</span>
        </button>

        {/* Nein (No) button */}
        <button
          type="button"
          onClick={() => handleToggle(false)}
          className={buildButtonClass(value === false, hasSource, isIndividual, !!validationError, 'red')}
        >
          <X className="h-4 w-4" />
          <span>Nein</span>
        </button>

      </div>

      {/* Inline validation error — only rendered when a message is present */}
      {validationError && (
        <p className="mt-1 text-xs text-red-600">{validationError}</p>
      )}
    </div>
  );
};

export default BoolInputField;