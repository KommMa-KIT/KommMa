/**
 * ResultProtectedRoute.test.tsx
 *
 * Unit tests for the ResultProtectedRoute route guard.
 * Covers all redirect/render branches based on result and loading state.
 */

import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import type { ReactNode } from 'react';
import ResultProtectedRoute from '../routing/ResultProtectedRoute';

// Mock react-router-dom as a virtual module so Jest does not need to resolve it.
jest.mock(
  'react-router-dom',
  () => ({
    Navigate: ({ to }: { to: string }) => (
      <div data-testid="navigate" data-to={to} />
    ),
  }),
  { virtual: true }
);

type MeasureResult = { id: string };

type ResultsSliceState = {
  measureResults: MeasureResult[] | null;
  loading: boolean;
};

function makeStore(
  measureResults: MeasureResult[] | null = null,
  loading = false
) {
  const preloadedState: ResultsSliceState = { measureResults, loading };

  return configureStore({
    reducer: {
      results: (state = preloadedState) => state,
    },
  });
}

function renderRoute(
  measureResults: MeasureResult[] | null,
  loading: boolean,
  children: ReactNode = <div data-testid="result-children" />
) {
  const store = makeStore(measureResults, loading);

  return render(
    <Provider store={store}>
      <ResultProtectedRoute>{children}</ResultProtectedRoute>
    </Provider>
  );
}

describe('ResultProtectedRoute', () => {
  it('redirects to / when result is null and not loading', () => {
    renderRoute(null, false);

    expect(screen.getByTestId('navigate')).toBeDefined();
    expect(screen.getByTestId('navigate').getAttribute('data-to')).toBe('/');
    expect(screen.queryByTestId('result-children')).toBeNull();
  });

  it('renders children when result is null but loading is true', () => {
    renderRoute(null, true);

    expect(screen.getByTestId('result-children')).toBeDefined();
    expect(screen.queryByTestId('navigate')).toBeNull();
  });

  it('renders children when result is available and not loading', () => {
    renderRoute([{ id: 'M1' }], false);

    expect(screen.getByTestId('result-children')).toBeDefined();
    expect(screen.queryByTestId('navigate')).toBeNull();
  });

  it('renders children when result is available and loading is true', () => {
    renderRoute([{ id: 'M1' }], true);

    expect(screen.getByTestId('result-children')).toBeDefined();
    expect(screen.queryByTestId('navigate')).toBeNull();
  });

  it('renders multiple children correctly', () => {
    renderRoute(
      [{ id: 'M1' }],
      false,
      <>
        <div data-testid="child-a" />
        <div data-testid="child-b" />
      </>
    );

    expect(screen.getByTestId('child-a')).toBeDefined();
    expect(screen.getByTestId('child-b')).toBeDefined();
    expect(screen.queryByTestId('navigate')).toBeNull();
  });
});