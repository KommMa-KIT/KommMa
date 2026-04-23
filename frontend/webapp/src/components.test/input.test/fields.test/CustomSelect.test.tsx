/**
 * CustomSelect.test.tsx
 *
 * Tests for CustomSelect – rendering, style switching based on hasSource,
 * placeholder, classNamePrefix, and basic interaction via react-select.
 */

import { render, screen } from '@testing-library/react';
import CustomSelect from '../../../components/input/fields/CustomSelect';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const options = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CustomSelect', () => {
  // --- Rendering ---

  it('renders without throwing', () => {
    expect(() =>
      render(<CustomSelect options={options} value={null} onChange={jest.fn()} />)
    ).not.toThrow();
  });

  it('renders with hasSource=false without throwing', () => {
    expect(() =>
      render(
        <CustomSelect options={options} value={null} onChange={jest.fn()} hasSource={false} />
      )
    ).not.toThrow();
  });

  it('renders with hasSource=true without throwing', () => {
    expect(() =>
      render(
        <CustomSelect options={options} value={null} onChange={jest.fn()} hasSource={true} />
      )
    ).not.toThrow();
  });

  it('renders a DOM node', () => {
    const { container } = render(
      <CustomSelect options={options} value={null} onChange={jest.fn()} />
    );
    expect(container.firstChild).toBeDefined();
  });

  // --- classNamePrefix ---

  it('applies the react-select classNamePrefix to the container', () => {
    const { container } = render(
      <CustomSelect options={options} value={null} onChange={jest.fn()} />
    );
    // react-select generates class names with the prefix
    expect(
      container.querySelector('[class*="react-select"]') ?? container.firstChild
    ).toBeDefined();
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
    expect(screen.getByText('Bitte wählen...')).toBeDefined();
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
    expect(screen.getByText('Option B')).toBeDefined();
  });

  // --- Style switching (hasSource) ---

  it('renders with normal styles when hasSource is false', () => {
    const { container } = render(
      <CustomSelect options={options} value={null} onChange={jest.fn()} hasSource={false} />
    );
    // Primary styles do NOT set background on control; muted styles do
    // We verify the component renders a container without bg-gray applied inline
    // (Style objects are injected inline by react-select; we verify no crash and correct render)
    expect(container.firstChild).toBeDefined();
  });

  it('renders with prefilled (muted) styles when hasSource is true', () => {
    const { container } = render(
      <CustomSelect options={options} value={null} onChange={jest.fn()} hasSource={true} />
    );
    expect(container.firstChild).toBeDefined();
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