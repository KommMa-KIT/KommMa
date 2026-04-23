/**
 * InputPage.test.tsx
 *
 * Tests for InputPage – verifies that the correct view component is rendered
 * for each category value and that the persistent layout elements are always
 * present.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../../src/store/UISlice', () => ({
  selectCurrentCategory: (state: any) => state.ui.currentCategory,
}));

jest.mock('../../src/components/input/ProgressBar', () => ({
  __esModule: true,
  default: () => <div data-testid="progress-bar" />,
}));

jest.mock('../../src/components/input/StartView', () => ({
  __esModule: true,
  default: () => <div data-testid="start-view" />,
}));

jest.mock('../../src/components/input/MainView', () => ({
  __esModule: true,
  default: ({ category }: { category: string }) => (
    <div data-testid={`category-view-${category}`} />
  ),
}));

jest.mock('../../src/components/input/EndView', () => ({
  __esModule: true,
  default: () => <div data-testid="end-view" />,
}));

jest.mock('../../src/components/input/NavigationButtons', () => ({
  __esModule: true,
  default: () => <div data-testid="navigation-buttons" />,
}));

jest.mock('../../src/components/input/ExportButton', () => ({
  __esModule: true,
  default: () => <div data-testid="export-button" />,
}));

// ─── Store Factory ────────────────────────────────────────────────────────────

function makeStore(currentCategory: string) {
  return configureStore({
    reducer: {
      ui: (state = { currentCategory }) => state,
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

import InputPage from '../../src/pages/InputPage';

function renderInputPage(category: string) {
  const store = makeStore(category);
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <InputPage />
      </MemoryRouter>
    </Provider>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('InputPage', () => {
  it('always renders ProgressBar, ExportButton and NavigationButtons', () => {
    renderInputPage('Start');
    expect(screen.getByTestId('progress-bar')).toBeDefined();
    expect(screen.getByTestId('export-button')).toBeDefined();
    expect(screen.getByTestId('navigation-buttons')).toBeDefined();
  });

  it('renders StartView for category "Start"', () => {
    renderInputPage('Start');
    expect(screen.getByTestId('start-view')).toBeDefined();
  });

  it('renders InputCategoryView with General for category "General"', () => {
    renderInputPage('General');
    expect(screen.getByTestId('category-view-General')).toBeDefined();
  });

  it('renders InputCategoryView with Energy for category "Energy"', () => {
    renderInputPage('Energy');
    expect(screen.getByTestId('category-view-Energy')).toBeDefined();
  });

  it('renders InputCategoryView with Mobility for category "Mobility"', () => {
    renderInputPage('Mobility');
    expect(screen.getByTestId('category-view-Mobility')).toBeDefined();
  });

  it('renders InputCategoryView with Water for category "Water"', () => {
    renderInputPage('Water');
    expect(screen.getByTestId('category-view-Water')).toBeDefined();
  });

  it('renders EndView for category "End"', () => {
    renderInputPage('End');
    expect(screen.getByTestId('end-view')).toBeDefined();
  });

  it('renders error message for unknown category', () => {
    renderInputPage('Unknown');
    expect(screen.getByText(/Unbekannte Kategorie: Unknown/)).toBeDefined();
  });

  it('only renders one view at a time', () => {
    renderInputPage('General');
    expect(screen.queryByTestId('start-view')).toBeNull();
    expect(screen.queryByTestId('end-view')).toBeNull();
    expect(screen.getByTestId('category-view-General')).toBeDefined();
  });
});