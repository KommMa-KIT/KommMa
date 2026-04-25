/**
 * validationHelper.ts
 *
 * Pure utility functions for input field validation. Used by NavigationButtons
 * to gate category advancement, and by MainView to identify and scroll to the
 * first invalid field. All functions are stateless and side-effect free.
 */

import { InputFieldDefinition, InputValue } from '../types/inputTypes';

// --- Utilities ---

/**
 * Returns true when a value is considered "filled" for validation purposes.
 * Each InputValue variant has its own filled condition:
 *  - null / undefined → false
 *  - string           → true when non-empty after trimming
 *  - number           → true when not NaN (zero is a valid filled value)
 *  - boolean          → always true (both true and false are deliberate choices)
 *  - string[]         → true when at least one item is selected
 *
 * @param value The current input field value to evaluate.
 */
export const isValueFilled = (value: InputValue): boolean => {
  if (value === null || value === undefined) return false;

  if (typeof value === 'string')  return value.trim() !== '';
  if (typeof value === 'number')  return !isNaN(value);
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value))       return value.length > 0;

  return false;
};

/**
 * Recursively collects the IDs of all critical (mandatory) fields in a field
 * definition tree, including nested subinput fields at any depth.
 *
 * @param fields The top-level field definitions for a category.
 * @returns A flat array of field IDs where critical === true.
 */
export const collectMandatoryFields = (fields: InputFieldDefinition[]): string[] => {
  const mandatoryIds: string[] = [];

  const traverse = (field: InputFieldDefinition) => {
    if (field.critical) {
      mandatoryIds.push(field.id);
    }
    /** Recurse into subinputs regardless of parent value — all critical
     *  descendant fields are collected even if the parent is currently empty. */
    if (field.subinputs?.length > 0) {
      field.subinputs.forEach(traverse);
    }
  };

  fields.forEach(traverse);
  return mandatoryIds;
};

/**
 * Validates all mandatory fields in a category against the current input values.
 * Collects critical field IDs via collectMandatoryFields, then returns those
 * whose current value does not satisfy isValueFilled.
 *
 * The returned array is used by NavigationButtons to block advancement and by
 * MainView to dispatch validation errors and scroll to the first offending field.
 *
 * @param fields The top-level field definitions for the category being validated.
 * @param inputs The current input values map from the Redux store.
 * @returns An array of field IDs that are critical but currently unfilled.
 */
export const validateCategory = (
  fields: InputFieldDefinition[],
  inputs: { [fieldId: string]: InputValue }
): string[] => {
  const mandatoryFields = collectMandatoryFields(fields);

  return mandatoryFields.filter(fieldId => !isValueFilled(inputs[fieldId]));
};