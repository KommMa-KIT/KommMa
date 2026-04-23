/**
 * MultiSelectionInputField.test.tsx
 *
 * Tests for MultiSelectionInputField – multi-value selection, dispatch logic,
 * null handling, validation errors, and hasSource flag.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

// ─── Import ───────────────────────────────────────────────────────────────────

import MultiSelectionInputField from '../../../components/input/fields/MultiSelectionInputField';

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

// CustomMultiSelect mock – checkboxes for deterministic interaction
jest.mock('../../../components/input/fields/CustomMultiSelect', () => ({
  __esModule: true,
  default: ({ options, value, onChange, hasSource }: any) => (
    <div data-testid="custom-multi-select" data-has-source={String(!!hasSource)}>
      {options.map((o: any) => (
        <label key={o.value}>
          <input
            type="checkbox"
            data-testid={`checkbox-${o.value}`}
            checked={value.some((v: any) => v.value === o.value)}
            onChange={(e) => {
              const next = e.target.checked
                ? [...value, o]
                : value.filter((v: any) => v.value !== o.value);
              onChange(next);
            }}
          />
          {o.label}
        </label>
      ))}
      <button data-testid="clear-all" onClick={() => onChange([])}>
        Clear all
      </button>
    </div>
  ),
}));

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
  value: string[] | null = null,
  sources: Record<string, string> = {},
  validationErrors: Record<string, string> = {}
) {
  const store = makeStore(sources, validationErrors);
  return {
    store,
    ...render(
      <Provider store={store}>
        <MultiSelectionInputField field={baseField} value={value} />
      </Provider>
    ),
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseField = {
  id: 'multiField',
  label: 'Verkehrsmittel',
  type: 'multiSelection' as const,
  critical: false,
  description: '',
  selectable: ['Auto', 'Bus', 'Fahrrad'],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MultiSelectionInputField', () => {
  // --- Rendering ---

  it('renders the CustomMultiSelect wrapper', () => {
    renderField();
    expect(screen.getByTestId('custom-multi-select')).toBeDefined();
  });

  it('renders a checkbox for each selectable option', () => {
    renderField();
    expect(screen.getByTestId('checkbox-Auto')).toBeDefined();
    expect(screen.getByTestId('checkbox-Bus')).toBeDefined();
    expect(screen.getByTestId('checkbox-Fahrrad')).toBeDefined();
  });

  // --- Value display ---

  it('marks currently selected values as checked', () => {
    renderField(['Auto', 'Bus']);
    expect((screen.getByTestId('checkbox-Auto') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId('checkbox-Bus') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId('checkbox-Fahrrad') as HTMLInputElement).checked).toBe(false);
  });

  it('treats null value as no selection (all unchecked)', () => {
    renderField(null);
    expect((screen.getByTestId('checkbox-Auto') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByTestId('checkbox-Bus') as HTMLInputElement).checked).toBe(false);
  });

  it('treats empty array as no selection', () => {
    renderField([]);
    expect((screen.getByTestId('checkbox-Auto') as HTMLInputElement).checked).toBe(false);
  });

  // --- Dispatch: setInput ---

  it('dispatches string array when a checkbox is checked', () => {
    const store = makeStore();
    const dispatchSpy = jest.spyOn(store, 'dispatch');
    render(
      <Provider store={store}>
        <MultiSelectionInputField field={baseField} value={null} />
      </Provider>
    );
    fireEvent.click(screen.getByTestId('checkbox-Auto'));
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'community/setInput',
      payload: { id: 'multiField', value: ['Auto'], userInput: true },
    });
  });

  it('dispatches updated array when a second checkbox is checked', () => {
    const store = makeStore();
    const dispatchSpy = jest.spyOn(store, 'dispatch');
    render(
      <Provider store={store}>
        <MultiSelectionInputField field={baseField} value={['Auto']} />
      </Provider>
    );
    fireEvent.click(screen.getByTestId('checkbox-Bus'));
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'community/setInput',
      payload: { id: 'multiField', value: ['Auto', 'Bus'], userInput: true },
    });
  });

  it('dispatches null when the last selected item is removed', () => {
    const store = makeStore();
    const dispatchSpy = jest.spyOn(store, 'dispatch');
    render(
      <Provider store={store}>
        <MultiSelectionInputField field={baseField} value={['Auto']} />
      </Provider>
    );
    fireEvent.click(screen.getByTestId('clear-all'));
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'community/setInput',
      payload: { id: 'multiField', value: null, userInput: true },
    });
  });

  it('clears validation error when a selection is made', () => {
    const store = makeStore({}, { multiField: 'Fehler' });
    const dispatchSpy = jest.spyOn(store, 'dispatch');
    render(
      <Provider store={store}>
        <MultiSelectionInputField field={baseField} value={null} />
      </Provider>
    );
    fireEvent.click(screen.getByTestId('checkbox-Bus'));
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'ui/clearValidationError',
      payload: 'multiField',
    });
  });

  // --- Validation errors ---

  it('shows validation error message when present', () => {
    renderField(null, {}, { multiField: 'Bitte auswählen' });
    expect(screen.getByText('Bitte auswählen')).toBeDefined();
  });

  it('does not show error message when no error', () => {
    renderField();
    expect(screen.queryByText('Bitte auswählen')).toBeNull();
  });

  it('does not dispatch clearValidationError when no error is present', () => {
    const { store } = renderField(null, {}, {});
    const dispatchSpy = jest.spyOn(store, 'dispatch');
    fireEvent.click(screen.getByTestId('checkbox-Auto'));
    const clearCalls = dispatchSpy.mock.calls.filter(
      ([a]) => a.type === 'ui/clearValidationError'
    );
    expect(clearCalls.length).toBe(0);
  });

  // --- hasSource ---

  it('passes hasSource=true to CustomMultiSelect when field has a source', () => {
    renderField(null, { multiField: 'Quelle' });
    expect(
      screen.getByTestId('custom-multi-select').getAttribute('data-has-source')
    ).toBe('true');
  });

  it('passes hasSource=false to CustomMultiSelect when field has no source', () => {
    renderField();
    expect(
      screen.getByTestId('custom-multi-select').getAttribute('data-has-source')
    ).toBe('false');
  });
});