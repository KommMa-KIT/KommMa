/**
 * CustomMultiSelect.tsx
 *
 * A styled wrapper around React-Select's multi-select component, themed to match
 * the application's green colour palette via a custom StylesConfig. Renders in a
 * muted "prefilled" style when the field value originates from an external source
 * (hasSource), signalling to the user that the selection was not self-entered.
 */

import Select, { StylesConfig, Props as SelectProps } from 'react-select';

// --- Types ---

interface Option {
  value: string;
  label: string;
}

interface CustomMultiSelectProps extends Omit<SelectProps<Option, true>, 'styles' | 'isMulti'> {
  /**
   * When true, renders the control and selected tags in a muted grey palette to
   * indicate that the value was pre-filled from a community or external source.
   */
  hasSource?: boolean;
}

// --- Styles ---

/**
 * Primary style set — used for user-entered selections.
 * Accent colour: #67AE6E (mid-green); highlight: #E1EEBC (pale green).
 */
const customStyles: StylesConfig<Option, true> = {
  /** Outer input container; green focus ring replaces the default blue. */
  control: (base, state) => ({
    ...base,
    minHeight: '42px',
    borderColor: state.isFocused ? '#67AE6E' : '#d1d5db',
    borderRadius: '0.5rem',
    boxShadow: state.isFocused ? '0 0 0 2px #67AE6E' : 'none',
    '&:hover': {
      borderColor: '#67AE6E',
    },
  }),

  /** Dropdown list items; selected items use the full green fill. */
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? '#67AE6E'
      : state.isFocused
      ? '#E1EEBC'
      : 'white',
    color: state.isSelected ? 'white' : '#1f2937',
    cursor: 'pointer',
    '&:active': {
      backgroundColor: '#328E6E',
    },
  }),

  /** Pill container for each selected tag. */
  multiValue: (base) => ({
    ...base,
    backgroundColor: '#E1EEBC',
    borderRadius: '0.375rem',
    padding: '2px 4px',
  }),

  /** Text portion of a selected tag. */
  multiValueLabel: (base) => ({
    ...base,
    color: '#328E6E',
    fontWeight: '500',
    fontSize: '0.875rem',
  }),

  /** Remove (×) button on each selected tag. */
  multiValueRemove: (base) => ({
    ...base,
    color: '#328E6E',
    borderRadius: '0 0.375rem 0.375rem 0',
    '&:hover': {
      backgroundColor: '#90C67C',
      color: 'white',
    },
  }),
};

/**
 * Prefilled style set — applied when hasSource is true.
 * Inherits all customStyles overrides but replaces greens with neutral greys to
 * communicate that the current value was set externally, not by the user.
 */
const prefilledStyles: StylesConfig<Option, true> = {
  ...customStyles,

  /** Grey background on the control signals an externally provided value. */
  control: (base, state) => ({
    ...base,
    minHeight: '42px',
    backgroundColor: '#f3f4f6',
    borderColor: state.isFocused ? '#67AE6E' : '#d1d5db',
    borderRadius: '0.5rem',
    boxShadow: state.isFocused ? '0 0 0 2px #67AE6E' : 'none',
  }),

  /** Muted grey pill instead of pale green for pre-filled tags. */
  multiValue: (base) => ({
    ...base,
    backgroundColor: '#d1d5db',
    borderRadius: '0.375rem',
    padding: '2px 4px',
  }),

  /** Subdued label colour matching the grey pill. */
  multiValueLabel: (base) => ({
    ...base,
    color: '#6b7280',
    fontWeight: '500',
    fontSize: '0.875rem',
  }),
};

// --- Component ---

/**
 * CustomMultiSelect
 *
 * Thin wrapper that forwards all standard React-Select props while injecting
 * the appropriate StylesConfig. Fixes isMulti to true — this component is
 * intentionally multi-select only.
 */
export const CustomMultiSelect = ({ hasSource, ...props }: CustomMultiSelectProps) => {
  /** Switch to the muted palette whenever the field has an external source. */
  const shouldUsePrefillStyle = hasSource;

  return (
    <Select
      {...props}
      isMulti
      styles={shouldUsePrefillStyle ? prefilledStyles : customStyles}
      classNamePrefix="react-select"
      placeholder="Optionen wählen..."
      noOptionsMessage={() => 'Keine Optionen verfügbar'}
    />
  );
};

export default CustomMultiSelect;