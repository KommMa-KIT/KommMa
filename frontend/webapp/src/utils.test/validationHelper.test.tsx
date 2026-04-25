import {
  isValueFilled,
  collectMandatoryFields,
  validateCategory,
} from '../utils/validationHelper';
import { InputFieldDefinition, InputValue } from '../types/inputTypes';

const makeField = (
  overrides: Partial<InputFieldDefinition>
): InputFieldDefinition =>
  ({
    id: 'default-id',
    critical: false,
    subinputs: [],
    ...overrides,
  }) as InputFieldDefinition;

describe('validationHelper', () => {
  describe('isValueFilled', () => {
    it('returns false for null', () => {
      expect(isValueFilled(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isValueFilled(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isValueFilled('')).toBe(false);
    });

    it('returns false for whitespace-only string', () => {
      expect(isValueFilled('   ')).toBe(false);
    });

    it('returns true for non-empty string', () => {
      expect(isValueFilled('hello')).toBe(true);
    });

    it('returns true for trimmed non-empty string', () => {
      expect(isValueFilled('  hello  ')).toBe(true);
    });

    it('returns true for valid numbers', () => {
      expect(isValueFilled(0)).toBe(true);
      expect(isValueFilled(42)).toBe(true);
      expect(isValueFilled(-5)).toBe(true);
    });

    it('returns false for NaN', () => {
      expect(isValueFilled(NaN)).toBe(false);
    });

    it('returns true for boolean true', () => {
      expect(isValueFilled(true)).toBe(true);
    });

    it('returns true for boolean false', () => {
      expect(isValueFilled(false)).toBe(true);
    });

    it('returns false for empty array', () => {
      expect(isValueFilled([])).toBe(false);
    });

    it('returns true for non-empty array', () => {
      expect(isValueFilled(['x'])).toBe(true);
    });

    it('returns false for unsupported object values', () => {
      expect(isValueFilled({} as InputValue)).toBe(false);
    });
  });

  describe('collectMandatoryFields', () => {
    it('returns empty array for empty input', () => {
      expect(collectMandatoryFields([])).toEqual([]);
    });

    it('collects top-level critical fields', () => {
      const fields: InputFieldDefinition[] = [
        makeField({ id: 'a', critical: true }),
        makeField({ id: 'b', critical: false }),
        makeField({ id: 'c', critical: true }),
      ];

      expect(collectMandatoryFields(fields)).toEqual(['a', 'c']);
    });

    it('collects critical subinputs recursively', () => {
      const fields: InputFieldDefinition[] = [
        makeField({
          id: 'parent',
          critical: false,
          subinputs: [
            makeField({ id: 'child1', critical: true }),
            makeField({
              id: 'child2',
              critical: false,
              subinputs: [
                makeField({ id: 'grandchild1', critical: true }),
                makeField({ id: 'grandchild2', critical: false }),
              ],
            }),
          ],
        }),
      ];

      expect(collectMandatoryFields(fields)).toEqual([
        'child1',
        'grandchild1',
      ]);
    });

    it('includes parent and child when both are critical', () => {
      const fields: InputFieldDefinition[] = [
        makeField({
          id: 'parent',
          critical: true,
          subinputs: [makeField({ id: 'child', critical: true })],
        }),
      ];

      expect(collectMandatoryFields(fields)).toEqual(['parent', 'child']);
    });

    it('handles undefined subinputs', () => {
      const fields: InputFieldDefinition[] = [
        makeField({ id: 'a', critical: true, subinputs: undefined }),
      ];

      expect(collectMandatoryFields(fields)).toEqual(['a']);
    });
  });

  describe('validateCategory', () => {
    it('returns empty array when all critical fields are filled', () => {
      const fields: InputFieldDefinition[] = [
        makeField({ id: 'name', critical: true }),
        makeField({ id: 'age', critical: true }),
        makeField({ id: 'newsletter', critical: true }),
        makeField({ id: 'optional', critical: false }),
      ];

      const inputs: { [fieldId: string]: InputValue } = {
        name: 'Jonas',
        age: 21,
        newsletter: false,
        optional: '',
      };

      expect(validateCategory(fields, inputs)).toEqual([]);
    });

    it('returns all invalid critical fields', () => {
      const fields: InputFieldDefinition[] = [
        makeField({ id: 'name', critical: true }),
        makeField({ id: 'age', critical: true }),
        makeField({ id: 'tags', critical: true }),
      ];

      const inputs: { [fieldId: string]: InputValue } = {
        name: '   ',
        age: NaN,
        tags: [],
      };

      expect(validateCategory(fields, inputs)).toEqual(['name', 'age', 'tags']);
    });

    it('ignores optional fields', () => {
      const fields: InputFieldDefinition[] = [
        makeField({ id: 'required', critical: true }),
        makeField({ id: 'optional', critical: false }),
      ];

      const inputs: { [fieldId: string]: InputValue } = {
        required: 'filled',
        optional: '',
      };

      expect(validateCategory(fields, inputs)).toEqual([]);
    });

    it('validates nested critical fields', () => {
      const fields: InputFieldDefinition[] = [
        makeField({
          id: 'parent',
          critical: false,
          subinputs: [
            makeField({ id: 'child1', critical: true }),
            makeField({
              id: 'child2',
              critical: false,
              subinputs: [makeField({ id: 'grandchild', critical: true })],
            }),
          ],
        }),
      ];

      const inputs: { [fieldId: string]: InputValue } = {
        child1: 'value',
        grandchild: '',
      };

      expect(validateCategory(fields, inputs)).toEqual(['grandchild']);
    });

    it('treats missing critical input as invalid', () => {
      const fields: InputFieldDefinition[] = [
        makeField({ id: 'missing', critical: true }),
      ];

      expect(validateCategory(fields, {})).toEqual(['missing']);
    });
  });
});