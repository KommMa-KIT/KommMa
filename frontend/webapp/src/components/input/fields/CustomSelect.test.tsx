/**
 * CustomSelect.test.tsx
 *
 * Tests for CustomSelect – rendering, style switching based on hasSource,
 * placeholder, classNamePrefix, and basic interaction via react-select.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import CustomSelect from './CustomSelect';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const options = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CustomSelect', () => {
  // --- Rendering ---

  it('renders an enabled combobox by default', () => {
    render(<CustomSelect options={options} value={null} onChange={jest.fn()} />);
    expect(screen.getByRole('combobox')).toBeEnabled();
  });

  it('forwards disabled state for user-entered fields', () => {
    render(<CustomSelect options={options} value={null} onChange={jest.fn()} hasSource={false} isDisabled />);
    expect(screen.getByRole('combobox', { hidden: true })).toBeDisabled();
  });

  it('keeps externally sourced selections editable', () => {
    render(<CustomSelect options={options} value={options[0]} onChange={jest.fn()} hasSource />);
    expect(screen.getByRole('combobox')).toBeEnabled();
    expect(screen.getByText('Option A')).toBeInTheDocument();
  });

  it('renders a DOM node', () => {
    const { container } = render(
      <CustomSelect options={options} value={null} onChange={jest.fn()} />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  // --- classNamePrefix ---

  it('applies the react-select classNamePrefix to the container', () => {
    const { container } = render(
      <CustomSelect options={options} value={null} onChange={jest.fn()} />
    );
    // react-select generates class names with the prefix
    expect(
      container.querySelector('.react-select__control')
    ).toBeInTheDocument();
  });

  // --- Placeholder ---

  it('shows the default placeholder when no value is selected', () => {
    render(
      <CustomSelect
        options={options}
        value={null}
        onChange={jest.fn()}
        placeholder="Bitte wählen..."
      />
    );
    expect(screen.getByText('Bitte wählen...')).toBeInTheDocument();
  });

  // --- Current value display ---

  it('displays the currently selected option label', () => {
    render(
      <CustomSelect
        options={options}
        value={{ value: 'b', label: 'Option B' }}
        onChange={jest.fn()}
      />
    );
    expect(screen.getByText('Option B')).toBeInTheDocument();
  });

  // --- Style switching (hasSource) ---

  it('renders with normal styles when hasSource is false', () => {
    const { container } = render(
      <CustomSelect options={options} value={null} onChange={jest.fn()} hasSource={false} />
    );
    expect(container.querySelector('.react-select__control')).toHaveStyle({
      backgroundColor: 'rgb(255, 255, 255)', borderColor: '#d1d5db',
    });
  });

  it('renders with prefilled (muted) styles when hasSource is true', () => {
    const { container } = render(
      <CustomSelect options={options} value={null} onChange={jest.fn()} hasSource={true} />
    );
    expect(container.querySelector('.react-select__control')).toHaveStyle({ backgroundColor: '#f3f4f6' });
  });

  it('forwards a selected option to onChange', () => {
    const onChange = jest.fn();
    render(<CustomSelect options={options} value={null} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    fireEvent.click(screen.getByText('Option B'));
    expect(onChange).toHaveBeenCalledWith(options[1], expect.objectContaining({ action: 'select-option' }));
  });

  // --- isMulti fixed to false ---

  it('is always a single-select (not multi)', () => {
    const { container } = render(
      <CustomSelect options={options} value={null} onChange={jest.fn()} />
    );
    // react-select single-select does not render multi-value chips by default
    expect(container.querySelector('.react-select__multi-value')).toBeNull();
  });
});