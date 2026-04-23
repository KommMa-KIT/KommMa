/**
 * NumberInputField.test.tsx
 *
 * Tests for NumberInputField – value display, dispatch logic, validation
 * errors, source styling, and unit label.
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

// ─── Import ───────────────────────────────────────────────────────────────────

import NumberInputField from '../../../components/input/fields/NumberInputField';

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
  value: number | null = null,
  sources: Record<string, string> = {},
  validationErrors: Record<string, string> = {},
  store = makeStore(sources, validationErrors)
) {
  const field = { ...baseField, ...fieldOverrides };
  return {
    store,
    ...render(
      <Provider store={store}>
        <NumberInputField field={field} value={value} />
      </Provider>
    ),
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseField = {
  id: 'numField',
  label: 'Bevölkerung',
  type: 'number' as const,
  critical: false,
  description: 'Einwohnerzahl',
  unit: 'Einwohner',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('NumberInputField', () => {
  // --- Rendering ---

  it('renders a number input', () => {
    renderField();
    expect((screen.getByRole('spinbutton') as HTMLInputElement).type).toBe('number');
  });

  it('renders an empty string when value is null', () => {
    renderField({}, null);
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('');
  });

  it('renders the numeric value as string', () => {
    renderField({}, 42);
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('42');
  });

  it('renders a floating point value correctly', () => {
    renderField({}, 3.14);
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('3.14');
  });

  // --- Unit label ---

  it('renders the unit label when field has a unit', () => {
    renderField({ unit: 'Einwohner' });
    expect(screen.getByText('Einwohner')).toBeDefined();
  });

  it('does not render a unit label when unit is undefined', () => {
    renderField({ unit: undefined });
    expect(screen.queryByText('Einwohner')).toBeNull();
  });

  // --- Dispatch ---

  it('dispatches null when input is cleared', () => {
    const store = makeStore();
    const dispatchSpy = jest.spyOn(store, 'dispatch');
    renderField({}, 42, {}, {}, store);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } });
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'community/setInput',
      payload: { id: 'numField', value: null, userInput: true },
    });
  });

  it('dispatches parsed float for a valid integer input', () => {
    const store = makeStore();
    const dispatchSpy = jest.spyOn(store, 'dispatch');
    renderField({}, null, {}, {}, store);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '100' } });
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'community/setInput',
      payload: { id: 'numField', value: 100, userInput: true },
    });
  });

  it('dispatches parsed float for a decimal input', () => {
    const store = makeStore();
    const dispatchSpy = jest.spyOn(store, 'dispatch');
    renderField({}, null, {}, {}, store);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2.5' } });
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'community/setInput',
      payload: { id: 'numField', value: 2.5, userInput: true },
    });
  });

  it('does not dispatch for non-numeric input', () => {
    const { store } = renderField();
    const dispatchSpy = jest.spyOn(store, 'dispatch');
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: 'abc' } });
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  // --- Validation errors ---

  it('shows validation error message when present', () => {
    renderField({}, null, {}, { numField: 'Bitte ausfüllen' });
    expect(screen.getByText('Bitte ausfüllen')).toBeDefined();
  });

  it('applies red border class when validation error exists', () => {
    renderField({}, null, {}, { numField: 'Fehler' });
    expect(screen.getByRole('spinbutton').className).toContain('border-red-500');
  });

  it('does not apply red border class when no error', () => {
    renderField();
    expect(screen.getByRole('spinbutton').className).not.toContain('border-red-500');
  });

  it('clears validation error on valid change', () => {
    const store = makeStore({}, { numField: 'Fehler' });
    const dispatchSpy = jest.spyOn(store, 'dispatch');
    renderField({}, null, {}, { numField: 'Fehler' }, store);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '50' } });
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'ui/clearValidationError',
      payload: 'numField',
    });
  });

  it('does not dispatch clearValidationError when no error is present', () => {
    const { store } = renderField({}, null, {}, {});
    const dispatchSpy = jest.spyOn(store, 'dispatch');
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '50' } });
    const clearCalls = dispatchSpy.mock.calls.filter(
      ([a]) => a.type === 'ui/clearValidationError'
    );
    expect(clearCalls.length).toBe(0);
  });

  // --- Source styling ---

  it('applies muted bg-gray-100 when field has a source', () => {
    renderField({}, null, { numField: 'Statistik' });
    expect(screen.getByRole('spinbutton').className).toContain('bg-gray-100');
  });

  it('applies bg-white when field has no source', () => {
    renderField();
    expect(screen.getByRole('spinbutton').className).toContain('bg-white');
  });
});