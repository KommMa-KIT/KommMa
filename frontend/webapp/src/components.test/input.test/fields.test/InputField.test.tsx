/**
 * InputField.test.tsx
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import InputField from '../../../components/input/fields/InputField';
import { InputFieldDefinition } from '../../../types/inputTypes';

// ---------------------------------------------------------------------------
// Mock functions — declared before jest.mock factories reference them
// ---------------------------------------------------------------------------

const mockToggleSubInput           = jest.fn((id: string) => ({ type: 'ui/toggleSubInput', payload: id }));
const mockSelectIsSubInputExpanded = jest.fn(() => () => false);
const mockSelectValidationError    = jest.fn(() => () => undefined);
const mockSelectFieldSource        = jest.fn(() => () => null);
const mockSelectIndividual         = jest.fn(() => ({}));
const mockSelectInputValue         = jest.fn(() => () => null);

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../../components/input/fields/NumberInputField',
  () => ({ field }: any) => <div data-testid={`number-${field.id}`} />);

jest.mock('../../../components/input/fields/SelectionInputField',
  () => ({ field }: any) => <div data-testid={`selection-${field.id}`} />);

jest.mock('../../../components/input/fields/MultiSelectionInputField',
  () => ({ field }: any) => <div data-testid={`multi-${field.id}`} />);

jest.mock('../../../components/input/fields/BoolInputField',
  () => ({ field }: any) => <div data-testid={`bool-${field.id}`} />);

jest.mock('../../../components/input/SourceTooltip',
  () => ({ source }: any) => <div data-testid="source-tooltip">{source?.name}</div>);

jest.mock('../../../store/UISlice', () => ({
  toggleSubInput:           (...args: any[]) => mockToggleSubInput(...args),
  selectIsSubInputExpanded: (...args: any[]) => mockSelectIsSubInputExpanded(...args),
  selectValidationError:    (...args: any[]) => mockSelectValidationError(...args),
}));

jest.mock('../../../store/CommunitySlice', () => ({
  selectFieldSource: (...args: any[]) => mockSelectFieldSource(...args),
  selectIndividual:  (...args: any[]) => mockSelectIndividual(...args),
  selectInputValue:  (...args: any[]) => mockSelectInputValue(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildStore() {
  return configureStore({ reducer: { ui: () => ({}), community: () => ({}) } });
}

const baseField = (overrides: Partial<InputFieldDefinition> = {}): InputFieldDefinition => ({
  id: 'f1',
  title: 'Test Field',
  type: 'number',
  critical: false,
  description: 'Desc text',
  relevantParameters: [],
  subinputs: [],
  ...overrides,
});

interface RenderOpts {
  field?: InputFieldDefinition;
  categoryIndex?: number;
  level?: number;
  isExpanded?: boolean;
  validationError?: string;
  source?: any;
  individual?: Record<string, boolean>;
}

function renderInputField({
  field = baseField(),
  categoryIndex = 0,
  level = 0,
  isExpanded = false,
  validationError,
  source = null,
  individual = {},
}: RenderOpts = {}) {
  mockSelectIsSubInputExpanded.mockReturnValue(() => isExpanded);
  mockSelectValidationError.mockReturnValue(() => validationError);
  mockSelectFieldSource.mockReturnValue(() => source);
  mockSelectIndividual.mockReturnValue(individual);
  mockSelectInputValue.mockReturnValue(() => null);

  const store = buildStore();
  return render(
    <Provider store={store}>
      <InputField field={field} categoryIndex={categoryIndex} level={level} />
    </Provider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InputField', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockToggleSubInput.mockReturnValue({ type: 'ui/toggleSubInput', payload: '' });
  });

  // --- Field type dispatch --------------------------------------------------

  it('renders NumberInputField for type "number"', () => {
    renderInputField({ field: baseField({ type: 'number' }) });
    expect(screen.getByTestId('number-f1')).toBeInTheDocument();
  });

  it('renders SelectionInputField for type "selection"', () => {
    renderInputField({ field: baseField({ type: 'selection' }) });
    expect(screen.getByTestId('selection-f1')).toBeInTheDocument();
  });

  it('renders MultiSelectionInputField for type "multiSelection"', () => {
    renderInputField({ field: baseField({ type: 'multiSelection' }) });
    expect(screen.getByTestId('multi-f1')).toBeInTheDocument();
  });

  it('renders BoolInputField for type "bool"', () => {
    renderInputField({ field: baseField({ type: 'bool' }) });
    expect(screen.getByTestId('bool-f1')).toBeInTheDocument();
  });

  it('renders error message for unknown type', () => {
    renderInputField({ field: baseField({ type: 'unknown' as any }) });
    expect(screen.getByText(/Unbekannter Feldtyp: unknown/)).toBeInTheDocument();
  });

  // --- Title & description --------------------------------------------------

  it('renders the field title', () => {
    renderInputField();
    expect(screen.getByText('Test Field')).toBeInTheDocument();
  });

  it('renders the field description', () => {
    renderInputField();
    expect(screen.getByText('Desc text')).toBeInTheDocument();
  });

  // --- Critical asterisk ----------------------------------------------------

  it('does NOT render asterisk for non-critical field', () => {
    renderInputField({ field: baseField({ critical: false }) });
    expect(screen.queryByTitle('Pflichtfeld')).not.toBeInTheDocument();
  });

  it('renders asterisk for critical field', () => {
    renderInputField({ field: baseField({ critical: true }) });
    expect(screen.getByTitle('Pflichtfeld')).toBeInTheDocument();
  });

  // --- Expand / collapse ----------------------------------------------------

  it('does NOT render chevron when subinputs is empty', () => {
    renderInputField({ field: baseField({ subinputs: [] }) });
    expect(screen.queryByRole('button', { name: /klappen/ })).not.toBeInTheDocument();
  });

  it('renders chevron button when subinputs exist', () => {
    const sub = baseField({ id: 'sub1', title: 'Sub Field' });
    renderInputField({ field: baseField({ subinputs: [sub] }) });
    expect(screen.getByRole('button', { name: /klappen/ })).toBeInTheDocument();
  });

  it('dispatches toggleSubInput when chevron clicked', () => {
    const sub = baseField({ id: 'sub1', title: 'Sub Field' });
    renderInputField({ field: baseField({ subinputs: [sub] }) });
    fireEvent.click(screen.getByRole('button', { name: /klappen/ }));
    expect(mockToggleSubInput).toHaveBeenCalledWith('f1');
  });

  it('renders sub-inputs when expanded', () => {
    const sub = baseField({ id: 'sub1', title: 'Sub Field', type: 'number' });
    renderInputField({
      field: baseField({ subinputs: [sub] }),
      isExpanded: true,
    });
    expect(screen.getByTestId('number-sub1')).toBeInTheDocument();
  });

  it('does NOT render sub-inputs when collapsed', () => {
    const sub = baseField({ id: 'sub1', title: 'Sub Field', type: 'number' });
    renderInputField({
      field: baseField({ subinputs: [sub] }),
      isExpanded: false,
    });
    expect(screen.queryByTestId('number-sub1')).not.toBeInTheDocument();
  });

  // --- Background colours ---------------------------------------------------

  it('uses white background for even category at level 0', () => {
    const { container } = renderInputField({ categoryIndex: 0, level: 0 });
    expect(container.querySelector('.bg-white')).not.toBeNull();
  });

  it('uses gray-50 background for odd category at level 0', () => {
    const { container } = renderInputField({ categoryIndex: 1, level: 0 });
    expect(container.querySelector('.bg-gray-50')).not.toBeNull();
  });

  it('uses red-50 background for even category with validation error', () => {
    const { container } = renderInputField({
      categoryIndex: 0,
      validationError: 'required',
    });
    expect(container.querySelector('.bg-red-50')).not.toBeNull();
  });

  it('uses red-100 background for odd category with validation error', () => {
    const { container } = renderInputField({
      categoryIndex: 1,
      validationError: 'required',
    });
    expect(container.querySelector('.bg-red-100')).not.toBeNull();
  });

  // --- Prefill indicator ----------------------------------------------------

  it('shows prefill indicator when source exists and user has NOT set field', () => {
    renderInputField({
      source: { name: 'Statistik' },
      individual: {},
    });
    expect(screen.getByText('Durchschnittswert (nicht individuell)')).toBeInTheDocument();
  });

  it('does NOT show prefill indicator when user has individually set the field', () => {
    renderInputField({
      source: { name: 'Statistik' },
      individual: { f1: true },
    });
    expect(
      screen.queryByText('Durchschnittswert (nicht individuell)')
    ).not.toBeInTheDocument();
  });

  it('does NOT show prefill indicator when no source', () => {
    renderInputField({ source: null });
    expect(
      screen.queryByText('Durchschnittswert (nicht individuell)')
    ).not.toBeInTheDocument();
  });

  // --- Source tooltip -------------------------------------------------------

  it('renders SourceTooltip when source exists', () => {
    renderInputField({ source: { name: 'Statistikamt' } });
    expect(screen.getByTestId('source-tooltip')).toBeInTheDocument();
  });

  it('does NOT render SourceTooltip when no source', () => {
    renderInputField({ source: null });
    expect(screen.queryByTestId('source-tooltip')).not.toBeInTheDocument();
  });

  // --- Padding for level 1 --------------------------------------------------

  it('applies deeper left padding at level 1', () => {
    const { container } = renderInputField({ level: 1 });
    expect(container.querySelector('.pl-12')).not.toBeNull();
  });

  it('applies default left padding at level 0', () => {
    const { container } = renderInputField({ level: 0 });
    expect(container.querySelector('.pl-6')).not.toBeNull();
  });
});