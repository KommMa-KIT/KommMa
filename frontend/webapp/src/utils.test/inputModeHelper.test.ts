/**
 * inputModeHelper.test.ts
 *
 * Tests for the beginner-mode utilities: field tree filtering, mandatory-field
 * detection, and the mode-dependent visible step sequence.
 */

import {
  ALL_CATEGORIES,
  filterMandatoryFields,
  getVisibleCategories,
  hasMandatoryFields,
} from '../utils/inputModeHelper';
import { CategorizedFields, InputFieldDefinition } from '../types/inputTypes';

// --- Fixtures ---

/** Builds a minimal field definition with sensible defaults. */
const makeField = (
  id: string,
  critical: boolean,
  subinputs: InputFieldDefinition[] = []
): InputFieldDefinition => ({
  id,
  title: id,
  type: 'number',
  description: '',
  critical,
  subinputs,
});

describe('filterMandatoryFields', () => {
  it('keeps critical fields and drops non-critical ones', () => {
    const fields = [makeField('a', true), makeField('b', false), makeField('c', true)];
    const result = filterMandatoryFields(fields);
    expect(result.map(f => f.id)).toEqual(['a', 'c']);
  });

  it('returns an empty array when no field is critical', () => {
    const fields = [makeField('a', false), makeField('b', false)];
    expect(filterMandatoryFields(fields)).toEqual([]);
  });

  it('keeps a non-critical parent whose subinput is critical', () => {
    const fields = [
      makeField('parent', false, [makeField('child-critical', true), makeField('child-optional', false)]),
    ];
    const result = filterMandatoryFields(fields);
    expect(result.map(f => f.id)).toEqual(['parent']);
    expect(result[0].subinputs.map(f => f.id)).toEqual(['child-critical']);
  });

  it('drops non-critical subinputs of a critical parent', () => {
    const fields = [
      makeField('parent', true, [makeField('child-optional', false)]),
    ];
    const result = filterMandatoryFields(fields);
    expect(result.map(f => f.id)).toEqual(['parent']);
    expect(result[0].subinputs).toEqual([]);
  });

  it('handles deep nesting (critical field at depth 2)', () => {
    const fields = [
      makeField('level0', false, [
        makeField('level1', false, [makeField('level2', true)]),
      ]),
    ];
    const result = filterMandatoryFields(fields);
    expect(result.map(f => f.id)).toEqual(['level0']);
    expect(result[0].subinputs[0].id).toBe('level1');
    expect(result[0].subinputs[0].subinputs[0].id).toBe('level2');
  });

  it('does not mutate the input field definitions', () => {
    const child = makeField('child', false);
    const parent = makeField('parent', true, [child]);
    filterMandatoryFields([parent]);
    expect(parent.subinputs).toHaveLength(1);
  });
});

describe('hasMandatoryFields', () => {
  it('returns true when a top-level field is critical', () => {
    expect(hasMandatoryFields([makeField('a', true)])).toBe(true);
  });

  it('returns true when only a nested subinput is critical', () => {
    expect(hasMandatoryFields([makeField('a', false, [makeField('b', true)])])).toBe(true);
  });

  it('returns false when no field is critical', () => {
    expect(hasMandatoryFields([makeField('a', false)])).toBe(false);
  });

  it('returns false for an empty field list', () => {
    expect(hasMandatoryFields([])).toBe(false);
  });
});

describe('getVisibleCategories', () => {
  const fieldsWithMandatory: CategorizedFields = {
    General:  [makeField('g1', true)],
    Energy:   [makeField('e1', false)],
    Mobility: [],
    Water:    [makeField('w1', false, [makeField('w1-sub', true)])],
  };

  it('returns the full sequence in full mode', () => {
    expect(getVisibleCategories('full', fieldsWithMandatory)).toEqual(ALL_CATEGORIES);
  });

  it('returns the full sequence while field definitions are unavailable', () => {
    expect(getVisibleCategories('beginner', undefined)).toEqual(ALL_CATEGORIES);
  });

  it('skips data categories without mandatory fields in beginner mode', () => {
    expect(getVisibleCategories('beginner', fieldsWithMandatory)).toEqual([
      'Start', 'General', 'Water', 'End',
    ]);
  });

  it('always keeps Start and End even when no category has mandatory fields', () => {
    const noMandatory: CategorizedFields = {
      General: [], Energy: [], Mobility: [], Water: [],
    };
    expect(getVisibleCategories('beginner', noMandatory)).toEqual(['Start', 'End']);
  });

  it('treats missing category entries as having no mandatory fields', () => {
    expect(getVisibleCategories('beginner', { General: [makeField('g1', true)] })).toEqual([
      'Start', 'General', 'End',
    ]);
  });
});
