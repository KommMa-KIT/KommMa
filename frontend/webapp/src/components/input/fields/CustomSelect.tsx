/**
 * CustomSelect.tsx
 *
 * A styled wrapper around React-Select's single-select component, themed to match
 * the application's green colour palette via a custom StylesConfig. Renders in a
 * muted "prefilled" style when the field value originates from an external source
 * (hasSource), signalling to the user that the selection was not self-entered.
 *
 * See CustomMultiSelect.tsx for the multi-select equivalent.
 */

import Select, { StylesConfig, Props as SelectProps } from 'react-select';

// --- Types ---

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps extends Omit<SelectProps<Option, false>, 'styles'> {
  /**
   * When true, renders the control and selected value in a muted grey palette to
   * indicate that the value was pre-filled from a community or external source.
   */
  hasSource?: boolean;
}

// --- Styles ---

/**
 * Primary style set — used for user-entered selections.
 * Accent colour: #67AE6E (mid-green); highlight: #E1EEBC (pale green).
 *
 * Note: multiValue, multiValueLabel, and multiValueRemove are included for
 * completeness but are effectively unused given this component is single-select only.
 */
const customStyles: StylesConfig<Option, false> = {
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

  /** Dropdown list items; selected item uses the full green fill. */
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

  /** Pill container — inherited from multi-select blueprint, unused in practice. */
  multiValue: (base) => ({
    ...base,
    backgroundColor: '#E1EEBC',
    borderRadius: '0.375rem',
  }),

  /** Text portion of a selected tag — inherited, unused in practice. */
  multiValueLabel: (base) => ({
    ...base,
    color: '#328E6E',
    fontWeight: '500',
  }),

  /** Remove (×) button on a tag — inherited, unused in practice. */
  multiValueRemove: (base) => ({
    ...base,
    color: '#328E6E',
    '&:hover': {
      backgroundColor: '#90C67C',
      color: 'white',
    },
  }),
};

/**
 * Prefilled style set — applied when hasSource is true.
 * Inherits all customStyles overrides but replaces the selected-value text colour
 * and control background with neutrals to communicate external authorship.
 */
const prefilledStyles: StylesConfig<Option, false> = {
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

  /** Subdued text colour for the displayed single value when pre-filled. */
  singleValue: (base) => ({
    ...base,
    color: '#6b7280',
  }),
};

// --- Component ---

/**
 * CustomSelect
 *
 * Thin wrapper that forwards all standard React-Select props while injecting
 * the appropriate StylesConfig. Fixed to single-select (isMulti is false by default).
 */
export const CustomSelect = ({ hasSource, ...props }: CustomSelectProps) => {
  /** Switch to the muted palette whenever the field has an external source. */
  const shouldUsePrefillStyle = hasSource;

  return (
    <Select
      {...props}
      styles={shouldUsePrefillStyle ? prefilledStyles : customStyles}
      classNamePrefix="react-select"
    />
  );
};

export default CustomSelect;