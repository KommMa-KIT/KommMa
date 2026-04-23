/**
 * BoolInputField.test.tsx
 *
 * Unit tests for the BoolInputField component covering:
 *  - Renders Ja and Nein buttons
 *  - handleToggle dispatches setInput(true) and setInput(false)
 *  - handleToggle dispatches clearValidationError when an error exists
 *  - Active button styling (user-set value)
 *  - Source styling (externally prefilled, no user override)
 *  - Validation error message rendered
 *  - Error border class applied on both buttons when error exists
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import BoolInputField from '../../../components/input/fields/BoolInputField';
import { configureStore } from '@reduxjs/toolkit';
import { InputFieldDefinition } from '../../../types/inputTypes';

// ---------------------------------------------------------------------------
// Action creator mocks
// ---------------------------------------------------------------------------

const mockSetInput = jest.fn();
const mockClearValidationError = jest.fn();
const mockSelectIndividual = jest.fn();
const mockSelectFieldSource = jest.fn();

jest.mock('../../../store/CommunitySlice', () => ({
  setInput: (payload: any) => {
    mockSetInput(payload);                          // ← call the spy
    return { type: 'mock/setInput', payload };
  },
  selectIndividual: (...args: any[]) => mockSelectIndividual(...args),
  selectFieldSource: (id: string) => mockSelectFieldSource(id),
}));

jest.mock('../../../store/UISlice', () => ({
  clearValidationError: (id: string) => {
    mockClearValidationError(id);                   // ← call the spy
    return { type: 'mock/clearValidationError', payload: id };
  },
  selectValidationError: (id: string) => mockSelectValidationError(id),
}));

// ---------------------------------------------------------------------------
// Selector mocks
// ---------------------------------------------------------------------------

// remove duplicates, just assign
mockSelectIndividual.mockReset();
mockSelectFieldSource.mockReset();
const mockSelectValidationError = jest.fn();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIELD: InputFieldDefinition = {
  id: 'solar_roof',
  title: 'Solardach vorhanden?',
  type: 'bool',
  critical: false,
  description: '',
  subinputs: [],
};

function buildStore() {
  return configureStore({
    reducer: {
      community: () => ({}),
      ui: () => ({}),
    },
  });
}

interface RenderOptions {
  value?: boolean | null;
  validationError?: string;
  source?: any;
  individual?: Record<string, boolean>;
}

function renderField({
  value = null,
  validationError,
  source = null,
  individual = {},
}: RenderOptions = {}) {

  mockSelectValidationError.mockReturnValue(() => validationError);
  mockSelectFieldSource.mockReturnValue(() => source);
  mockSelectIndividual.mockReturnValue(individual);

  const store = buildStore();

  return render(
    <Provider store={store}>
      <BoolInputField field={FIELD} value={value} />
    </Provider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BoolInputField', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  it('renders the Ja button', () => {
    renderField();
    expect(screen.getByRole('button', { name: /Ja/i })).toBeInTheDocument();
  });

  it('renders the Nein button', () => {
    renderField();
    expect(screen.getByRole('button', { name: /Nein/i })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // handleToggle
  // -------------------------------------------------------------------------

  it('dispatches setInput({id, value: true, userInput: true}) on Ja click', () => {
    renderField({ value: null });

    fireEvent.click(screen.getByRole('button', { name: /Ja/i }));

    expect(mockSetInput).toHaveBeenCalledWith({
      id: 'solar_roof',
      value: true,
      userInput: true,
    });
  });

  it('dispatches setInput({id, value: false, userInput: true}) on Nein click', () => {
    renderField({ value: null });

    fireEvent.click(screen.getByRole('button', { name: /Nein/i }));

    expect(mockSetInput).toHaveBeenCalledWith({
      id: 'solar_roof',
      value: false,
      userInput: true,
    });
  });

  it('does NOT dispatch clearValidationError when no error exists', () => {
    renderField({ value: null, validationError: undefined });

    fireEvent.click(screen.getByRole('button', { name: /Ja/i }));

    expect(mockClearValidationError).not.toHaveBeenCalled();
  });

  it('dispatches clearValidationError when an error is present on Ja click', () => {
    renderField({ value: null, validationError: 'Bitte ausfüllen' });

    fireEvent.click(screen.getByRole('button', { name: /Ja/i }));

    expect(mockClearValidationError).toHaveBeenCalledWith('solar_roof');
  });

  it('dispatches clearValidationError when an error is present on Nein click', () => {
    renderField({ value: null, validationError: 'Pflichtfeld' });

    fireEvent.click(screen.getByRole('button', { name: /Nein/i }));

    expect(mockClearValidationError).toHaveBeenCalledWith('solar_roof');
  });

  // -------------------------------------------------------------------------
  // Active button styling
  // -------------------------------------------------------------------------

  it('Ja button has green active class when value=true and no source', () => {
    renderField({ value: true, source: null });

    const jaBtn = screen.getByRole('button', { name: /Ja/i });

    expect(jaBtn.className).toContain('bg-green-500');
  });

  it('Nein button has red active class when value=false and no source', () => {
    renderField({ value: false, source: null });

    const neinBtn = screen.getByRole('button', { name: /Nein/i });

    expect(neinBtn.className).toContain('bg-red-500');
  });

  // -------------------------------------------------------------------------
  // Source styling
  // -------------------------------------------------------------------------

  it('Ja button has gray-200 bg when value=true and source exists', () => {
    renderField({ value: true, source: { name: 'Statistik' } });

    const jaBtn = screen.getByRole('button', { name: /Ja/i });

    expect(jaBtn.className).toContain('bg-gray-200');
  });

  it('buttons have reduced opacity when source exists and not individual', () => {
    renderField({
      value: true,
      source: { name: 'Statistik' },
      individual: {},
    });

    const jaBtn = screen.getByRole('button', { name: /Ja/i });

    expect(jaBtn.className).toContain('opacity-70');
  });

  it('buttons do NOT have opacity-70 when user has individually set the field', () => {
    renderField({
      value: true,
      source: { name: 'Statistik' },
      individual: { solar_roof: true },
    });

    const jaBtn = screen.getByRole('button', { name: /Ja/i });

    expect(jaBtn.className).not.toContain('opacity-70');
  });

  // -------------------------------------------------------------------------
  // Validation error
  // -------------------------------------------------------------------------

  it('renders validation error message', () => {
    renderField({
      value: null,
      validationError: 'Dieses Feld muss ausgefüllt werden',
    });

    expect(
      screen.getByText('Dieses Feld muss ausgefüllt werden')
    ).toBeInTheDocument();
  });

  it('does NOT render error paragraph when no validation error', () => {
    renderField({ value: null });

    expect(screen.queryByText(/Pflicht/i)).not.toBeInTheDocument();
  });

  it('buttons have border-red-500 class when validation error exists', () => {
    renderField({ value: null, validationError: 'required' });

    const jaBtn = screen.getByRole('button', { name: /Ja/i });
    const neinBtn = screen.getByRole('button', { name: /Nein/i });

    expect(jaBtn.className).toContain('border-red-500');
    expect(neinBtn.className).toContain('border-red-500');
  });

});