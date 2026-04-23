/**
 * ResultProtectedRoute.tsx
 *
 * A route guard that prevents direct navigation to the result page before a
 * calculation result is available. Redirects to the home page when no result
 * exists and no calculation is currently in progress. While a calculation is
 * loading, the children are rendered so the result page can display its own
 * loading state rather than flickering back to the home page mid-calculation.
 */

import { Navigate } from 'react-router-dom';
import { ResultState } from '@/store/ResultSlice';
import { ReactNode } from 'react';
import { useSelector } from 'react-redux';

// --- Types ---

type Props = {
  /** The result page component tree to render when access is permitted. */
  children: ReactNode;
};

// --- Component ---

/**
 * ResultProtectedRoute
 *
 * Reads measureResults and loading from the Redux results slice to determine
 * whether the result page may be accessed:
 *  - result === null && !loading → redirect to "/" (no result, not calculating).
 *  - result === null && loading  → render children (calculation in progress).
 *  - result !== null             → render children (result available).
 */
export default function ResultProtectedRoute({ children }: Props) {
  /** The current calculation result; null when no calculation has completed. */
  const result = useSelector((state: { results: ResultState }) => state.results.measureResults);

  /** True while a calculation is in progress; prevents premature redirect. */
  const loading = useSelector((state: { results: ResultState }) => state.results.loading);

  /**
   * Redirect to home only when both conditions are met: no result exists AND
   * no calculation is running. Checking loading prevents a race condition where
   * the page would redirect immediately after navigation triggers the calculation
   * but before measureResults has been populated.
   */
  if (result === null && !loading) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}