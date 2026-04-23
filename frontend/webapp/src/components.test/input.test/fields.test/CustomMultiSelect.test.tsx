/**
 * CustomMultiSelect.test.tsx
 *
 * Unit tests for the CustomMultiSelect component covering:
 *  - Renders with default placeholder text
 *  - Passes isMulti=true to React-Select
 *  - Applies custom green styles when hasSource=false/undefined
 *  - Applies prefilled grey styles when hasSource=true
 *  - Forwards all extra props to React-Select (value, onChange, options)
 *  - Custom noOptionsMessage renders "Keine Optionen verfügbar"
 *  - Custom placeholder renders "Optionen wählen..."
 */

import { render, screen } from '@testing-library/react';
import { CustomMultiSelect } from '../../../components/input/fields/CustomMultiSelect';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Capture the props passed to React-Select so we can assert on them
let capturedSelectProps: any = {};
jest.mock('react-select', () => ({
  __esModule: true,
  default: (props: any) => {
    capturedSelectProps = props;
    return (
      <div data-testid="react-select">
        <span data-testid="placeholder">{props.placeholder}</span>
        <span data-testid="no-options">{props.noOptionsMessage?.()}</span>
        {props.value?.map((v: any) => (
          <span key={v.value} data-testid={`selected-${v.value}`}>{v.label}</span>
        ))}
      </div>
    );
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OPTIONS = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CustomMultiSelect', () => {
  beforeEach(() => {
    capturedSelectProps = {};
  });

  // --- Basic rendering ------------------------------------------------------

  it('renders a react-select element', () => {
    render(<CustomMultiSelect options={OPTIONS} onChange={jest.fn()} />);
    expect(screen.getByTestId('react-select')).toBeInTheDocument();
  });

  it('renders default placeholder "Optionen wählen..."', () => {
    render(<CustomMultiSelect options={OPTIONS} onChange={jest.fn()} />);
    expect(screen.getByTestId('placeholder')).toHaveTextContent('Optionen wählen...');
  });

  it('renders noOptionsMessage "Keine Optionen verfügbar"', () => {
    render(<CustomMultiSelect options={OPTIONS} onChange={jest.fn()} />);
    expect(screen.getByTestId('no-options')).toHaveTextContent(
      'Keine Optionen verfügbar'
    );
  });

  // --- isMulti --------------------------------------------------------------

  it('always passes isMulti=true', () => {
    render(<CustomMultiSelect options={OPTIONS} onChange={jest.fn()} />);
    expect(capturedSelectProps.isMulti).toBe(true);
  });

  // --- Prop forwarding ------------------------------------------------------

  it('forwards options prop to React-Select', () => {
    render(<CustomMultiSelect options={OPTIONS} onChange={jest.fn()} />);
    expect(capturedSelectProps.options).toEqual(OPTIONS);
  });

  it('forwards onChange prop to React-Select', () => {
    const onChange = jest.fn();
    render(<CustomMultiSelect options={OPTIONS} onChange={onChange} />);
    expect(capturedSelectProps.onChange).toBe(onChange);
  });

  it('forwards value prop and renders selected items', () => {
    const value = [OPTIONS[0]];
    render(<CustomMultiSelect options={OPTIONS} value={value} onChange={jest.fn()} />);
    expect(screen.getByTestId('selected-a')).toHaveTextContent('Option A');
  });

  it('passes classNamePrefix="react-select" to React-Select', () => {
    render(<CustomMultiSelect options={OPTIONS} onChange={jest.fn()} />);
    expect(capturedSelectProps.classNamePrefix).toBe('react-select');
  });

  // --- Style switching ------------------------------------------------------

  it('uses customStyles (green palette) when hasSource is false', () => {
    render(<CustomMultiSelect options={OPTIONS} onChange={jest.fn()} hasSource={false} />);
    // The control style should contain green focus colour #67AE6E
    const controlStyle = capturedSelectProps.styles.control({}, { isFocused: true });
    expect(controlStyle.borderColor).toBe('#67AE6E');
  });

  it('uses customStyles when hasSource is undefined', () => {
    render(<CustomMultiSelect options={OPTIONS} onChange={jest.fn()} />);
    const controlStyle = capturedSelectProps.styles.control({}, { isFocused: true });
    expect(controlStyle.borderColor).toBe('#67AE6E');
  });

  it('uses prefilledStyles (grey palette) when hasSource is true', () => {
    render(<CustomMultiSelect options={OPTIONS} onChange={jest.fn()} hasSource={true} />);
    // The multiValue style should use grey background
    const multiValueStyle = capturedSelectProps.styles.multiValue({});
    expect(multiValueStyle.backgroundColor).toBe('#d1d5db');
  });

  it('prefilledStyles multiValueLabel uses grey colour', () => {
    render(<CustomMultiSelect options={OPTIONS} onChange={jest.fn()} hasSource={true} />);
    const labelStyle = capturedSelectProps.styles.multiValueLabel({});
    expect(labelStyle.color).toBe('#6b7280');
  });

  it('customStyles multiValue uses pale green background', () => {
    render(<CustomMultiSelect options={OPTIONS} onChange={jest.fn()} hasSource={false} />);
    const multiValueStyle = capturedSelectProps.styles.multiValue({});
    expect(multiValueStyle.backgroundColor).toBe('#E1EEBC');
  });

  it('customStyles option is green when selected', () => {
    render(<CustomMultiSelect options={OPTIONS} onChange={jest.fn()} hasSource={false} />);
    const optionStyle = capturedSelectProps.styles.option(
      {},
      { isSelected: true, isFocused: false }
    );
    expect(optionStyle.backgroundColor).toBe('#67AE6E');
    expect(optionStyle.color).toBe('white');
  });

  it('customStyles option is pale green when focused (not selected)', () => {
    render(<CustomMultiSelect options={OPTIONS} onChange={jest.fn()} hasSource={false} />);
    const optionStyle = capturedSelectProps.styles.option(
      {},
      { isSelected: false, isFocused: true }
    );
    expect(optionStyle.backgroundColor).toBe('#E1EEBC');
  });

  it('customStyles option is white when neither selected nor focused', () => {
    render(<CustomMultiSelect options={OPTIONS} onChange={jest.fn()} hasSource={false} />);
    const optionStyle = capturedSelectProps.styles.option(
      {},
      { isSelected: false, isFocused: false }
    );
    expect(optionStyle.backgroundColor).toBe('white');
  });

  it('prefilledStyles control has grey background', () => {
    render(<CustomMultiSelect options={OPTIONS} onChange={jest.fn()} hasSource={true} />);
    const controlStyle = capturedSelectProps.styles.control({}, { isFocused: false });
    expect(controlStyle.backgroundColor).toBe('#f3f4f6');
  });
});