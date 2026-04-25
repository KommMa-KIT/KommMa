/**
 * measureTypes.ts
 *
 * Shared type definitions for the measure catalogue domain. Covers the
 * Measure entity, the MeasuresSlice state shape, and API response/error types.
 */

// --- Measure types ---

/**
 * The three levels of public acceptance for a measure.
 *
 * NOTE: Values are in German ('hoch', 'mittel', 'niedrig') as returned by the
 * backend. This differs from the English-first convention used elsewhere in the
 * codebase — consider aligning with the backend team if normalisation is
 * possible. Display strings are mapped via getPopularityLabel in
 * PopularityStyling.ts; styles are mapped via getPopularityStyle.
 */
export type PopularityLevel = 'hoch' | 'mittel' | 'niedrig';

/**
 * A single climate protection measure as returned by the backend measures
 * endpoint and stored in the MeasuresSlice.
 */
export interface Measure {
  id:                 string;
  title:              string;
  /** Public acceptance level; drives badge colour and label in MeasureCard and MeasurePopup. */
  popularity:         PopularityLevel;
  /** Free-text explanation of the popularity rating. */
  popularityComment:  string;
  shortDescription:   string;
  description:        string;
  /** IDs of input fields whose values are relevant to this measure's scoring. */
  relevantParameters: string[];
  /** URLs or references to additional reading material. */
  furtherInfo:        string[];
  imageURL:           string;
}

// --- Slice state ---

/**
 * The state shape owned by MeasuresSlice.
 * filteredMeasures is always a subset (or the full set) of measures,
 * derived synchronously on every searchQuery change.
 */
export interface MeasuresState {
  measures:         Measure[];
  loading:          boolean;
  /** Error message from a failed fetch; null when healthy. */
  error:            string | null;
  searchQuery:      string;
  filteredMeasures: Measure[];
}

// --- API types ---

/** Expected response shape from the backend measures list endpoint. */
export interface MeasureAPIResponse {
  measures: Measure[];
}

/** Standardised error shape returned by the backend on failed requests. */
export interface APIError {
  message: string;
  /** Optional machine-readable error code for programmatic error handling. */
  code?:   string;
}