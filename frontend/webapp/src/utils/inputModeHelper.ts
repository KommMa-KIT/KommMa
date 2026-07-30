/**
 * inputModeHelper.ts
 *
 * Pure utility functions for the beginner input mode. Beginner mode restricts
 * the input flow to mandatory (critical) fields: field trees are filtered down
 * to critical fields (keeping non-critical parents that contain critical
 * descendants), and data categories without any mandatory fields are removed
 * from the step sequence entirely.
 *
 * Used by MainView (field filtering), and by ProgressBar / NavigationButtons /
 * InputModeToggle (step sequence). All functions are stateless and
 * side-effect free.
 */

import {
  CategorizedFields,
  CategoryKey,
  CategoryType,
  InputFieldDefinition,
  InputMode,
} from '../types/inputTypes';
import { collectMandatoryFields } from './validationHelper';

// --- Constants ---

/** The full ordered input page step sequence used in full mode. */
export const ALL_CATEGORIES: CategoryType[] = ['Start', 'General', 'Energy', 'Mobility', 'Water', 'End'];

/** The four data categories bracketed by the Start and End steps. */
const DATA_CATEGORIES: CategoryKey[] = ['General', 'Energy', 'Mobility', 'Water'];

// --- Field filtering ---

/**
 * Recursively filters a field definition tree down to mandatory fields.
 * A field is kept when it is critical itself or when any of its descendants
 * is critical — non-critical parents of critical subinputs are retained so
 * the nested field remains reachable in the UI. Kept fields have their
 * subinputs filtered by the same rule.
 *
 * @param fields The field definitions to filter.
 * @returns A new array containing only mandatory fields (and their carriers).
 */
export const filterMandatoryFields = (
  fields: InputFieldDefinition[]
): InputFieldDefinition[] => {
  return fields
    .map((field) => {
      const filteredSubinputs = filterMandatoryFields(field.subinputs ?? []);
      if (field.critical || filteredSubinputs.length > 0) {
        return { ...field, subinputs: filteredSubinputs };
      }
      return null;
    })
    .filter((field): field is InputFieldDefinition => field !== null);
};

/**
 * Returns true when the given category fields contain at least one mandatory
 * field at any nesting depth.
 */
export const hasMandatoryFields = (fields: InputFieldDefinition[]): boolean =>
  collectMandatoryFields(fields).length > 0;

// --- Step sequence ---

/**
 * Returns the ordered input page step sequence for the given mode.
 * In full mode (or while field definitions are not yet available) the complete
 * sequence is returned. In beginner mode, data categories without any
 * mandatory fields are skipped; Start and End are always included.
 *
 * @param mode   The active input mode.
 * @param fields The categorised field definitions, or undefined while loading.
 */
export const getVisibleCategories = (
  mode: InputMode,
  fields?: Partial<CategorizedFields>
): CategoryType[] => {
  if (mode !== 'beginner' || !fields) {
    return ALL_CATEGORIES;
  }

  const visibleDataCategories = DATA_CATEGORIES.filter((category) =>
    hasMandatoryFields(fields[category] ?? [])
  );

  return ['Start', ...visibleDataCategories, 'End'];
};
