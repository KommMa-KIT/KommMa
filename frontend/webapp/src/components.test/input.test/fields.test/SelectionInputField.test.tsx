/**
 * SelectionInputField.test.tsx
 *
 * Tests for SelectionInputField – value display, dispatch logic, placeholder
 * variants, validation errors, and hasSource flag.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../../../store/CommunitySlice', () => ({
  setInput: (payload: any) => ({ type: 'community/setInput', payload }),
  selectFieldSource: (fieldId: string) => (state: any) =>
    state.community.sources?.[fieldId] ?? null,
}));

jest.mock('../../../store/UISlice', () => ({
  selectValidationError: (fieldId: string) => (state: any) =>
    state.ui.validationErrors?.[fieldId] ?? undefined,
  clearValidationError: (fieldId: string) => ({
    type: 'ui/clearValidationError',
    payload: fieldId,
  }),
}));

// CustomSelect mock – minimal native <select> so we can interact with it
jest.mock('../../../components/input/fields/CustomSelect', () => ({
  __esModule: true,
  default: ({ options, value, onChange, placeholder, isClearable, hasSource }: any) => (
    <div data-testid="custom-select" data-has-source={String(!!hasSource)}>
      <select
        data-testid="select-input"
        value={value?.value ?? ''}
        onChange={(e) => {
          const opt = options.find((o: any) => o.value === e.target.value) ?? null;
          onChange(opt);
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o: any) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {isClearable && (
        <button data-testid="clear-btn" onClick={() => onChange(null)}>Clear</button>
      )}
    </div>
  ),
}));

// ─── Import ───────────────────────────────────────────────────────────────────

import SelectionInputField from '../../../components/input/fields/SelectionInputField';

// ─── Store Factory ────────────────────────────────────────────────────────────

function makeStore(sources: Record<string, string> = {}, validationErrors: Record<string, string> = {}) {
  return configureStore({
    reducer: {
      community: (state = { sources }) => state,
      ui: (state = { validationErrors }, action: any) => {
        if (action.type === 'ui/clearValidationError') {
          const { [action.payload]: _, ...rest } = state.validationErrors;
          return { ...state, validationErrors: rest };
        }
        return state;
      },
    },
  });
}

function renderField(
  fieldOverrides: Partial<typeof baseField> = {},
  value: string | null = null,
  sources: Record<string, string> = {},
  validationErrors: Record<string, string> = {}
) {
  const store = makeStore(sources, validationErrors);
  const field = { ...baseField, ...fieldOverrides };
  return {
    store,
    ...render(
      <Provider store={store}>
        <SelectionInputField field={field} value={value} />
      </Provider>
    ),
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseField = {
  id: 'field1',
  label: 'Test Field',
  type: 'selection' as const,
  critical: false,
  description: '',
  selectable: ['Option A', 'Option B', 'Option C'],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SelectionInputField', () => {
  // --- Rendering ---

  it('renders the CustomSelect wrapper', () => {
    renderField();
    expect(screen.getByTestId('custom-select')).toBeDefined();
  });

  it('renders all selectable options', () => {
    renderField();
    expect(screen.getByText('Option A')).toBeDefined();
    expect(screen.getByText('Option B')).toBeDefined();
    expect(screen.getByText('Option C')).toBeDefined();
  });

  it('shows the current value as selected', () => {
    renderField({}, 'Option B');
    expect((screen.getByTestId('select-input') as HTMLSelectElement).value).toBe('Option B');
  });

  it('shows empty selection when value is null', () => {
    renderField({}, null);
    expect((screen.getByTestId('select-input') as HTMLSelectElement).value).toBe('');
  });

  // --- Placeholder ---

  it('uses "Bitte wählen..." placeholder for critical fields', () => {
    renderField({ critical: true });
    expect(screen.getByText('Bitte wählen...')).toBeDefined();
  });

  it('uses "Optional" placeholder for non-critical fields', () => {
    renderField({ critical: false });
    expect(screen.getByText('Optional')).toBeDefined();
  });

  // --- Clear button ---

  it('renders clear button for non-critical fields', () => {
    renderField({ critical: false });
    expect(screen.getByTestId('clear-btn')).toBeDefined();
  });

  it('does not render clear button for critical fields', () => {
    renderField({ critical: true });
    expect(screen.queryByTestId('clear-btn')).toBeNull();
  });

  // --- Dispatch: setInput ---
  it('dispatches setInput with selected value on change', () => {
    const store = makeStore();
    const dispatchSpy = jest.spyOn(store, 'dispatch');
    render(
      <Provider store={store}>
        <SelectionInputField field={baseField} value={null} />
      </Provider>
    );
    fireEvent.change(screen.getByTestId('select-input'), { target: { value: 'Option C' } });
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'community/setInput',
      payload: { id: 'field1', value: 'Option C', userInput: true },
    });
  });

  it('dispatches null when clear button is clicked', () => {
    const store = makeStore();
    const dispatchSpy = jest.spyOn(store, 'dispatch');
    render(
      <Provider store={store}>
        <SelectionInputField field={{ ...baseField, critical: false }} value="Option A" />
      </Provider>
    );
    fireEvent.click(screen.getByTestId('clear-btn'));
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'community/setInput',
      payload: { id: 'field1', value: null, userInput: true },
    });
  });

  // --- Validation errors ---

  it('shows validation error message when present', () => {
    renderField({}, null, {}, { field1: 'Pflichtfeld' });
    expect(screen.getByText('Pflichtfeld')).toBeDefined();
  });

  it('does not show error message when no error', () => {
    renderField();
    expect(screen.queryByText('Pflichtfeld')).toBeNull();
  });

  it('clears validation error on change', () => {
    const store = makeStore({}, { field1: 'Pflichtfeld' });
    const dispatchSpy = jest.spyOn(store, 'dispatch');
    render(
      <Provider store={store}>
        <SelectionInputField field={baseField} value={null} />
      </Provider>
    );
    fireEvent.change(screen.getByTestId('select-input'), { target: { value: 'Option A' } });
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'ui/clearValidationError',
      payload: 'field1',
    });
  });

  it('does not dispatch clearValidationError when no error is present', () => {
    const { store } = renderField();
    const dispatchSpy = jest.spyOn(store, 'dispatch');
    fireEvent.change(screen.getByTestId('select-input'), { target: { value: 'Option A' } });
    const clearCalls = dispatchSpy.mock.calls.filter(
      ([a]) => a.type === 'ui/clearValidationError'
    );
    expect(clearCalls.length).toBe(0);
  });

  // --- hasSource ---

  it('passes hasSource=true to CustomSelect when field has a source', () => {
    renderField({}, 'Option A', { field1: 'Statistik' });
    expect(screen.getByTestId('custom-select').getAttribute('data-has-source')).toBe('true');
  });

  it('passes hasSource=false to CustomSelect when field has no source', () => {
    renderField();
    expect(screen.getByTestId('custom-select').getAttribute('data-has-source')).toBe('false');
  });
});