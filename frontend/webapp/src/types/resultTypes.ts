/**
 * resultTypes.ts
 *
 * Type definitions for the results calculation API response.
 */

/**
 * Full response from the /api/results/calculate endpoint.
 * Contains individualisation levels for each input category and an array of scored measure results.
 */
export interface CalculateResultResponse {
  levelOfIndividualisationGeneral:  number;
  levelOfIndividualisationEnergy:   number;
  levelOfIndividualisationMobility: number;
  levelOfIndividualisationWater:    number;
  levelOfIndividualisationTotal:    number;
  measureResults: Result[];
}

/**
 * Scored and scaled result for a single measure as returned by the backend.
 *
 * *Score fields* (timeScore, costScore, climateScore) are normalised values used for ranking.
 * *Scale fields* (timeScale, costScale, climateScale) are discrete 0–5 icon-scale values for display.
 * *Absolute fields* (time, investmentCost, ongoingCost, totalCost, *EmissionSavings) carry real-world units.
 */
export interface Result {
  measureId:              string;
  timeScore:              number;
  costScore:              number;
  climateScore:           number;
  /** Discrete 0–5 display scale for implementation time. */
  timeScale:              number;
  /** Discrete 0–4 display scale for investment cost (plus 1 savings indicator). */
  costScale:              number;
  /** Discrete 0–5 display scale for climate impact. */
  climateScale:           number;
  /** Implementation time in months. */
  time:                   number;
  /** One-time investment cost in EUR. */
  investmentCost:         number;
  /** Annual ongoing cost in EUR (negative = annual savings). */
  ongoingCost:            number;
  /** Total lifetime cost in EUR. */
  totalCost:              number;
  /** One-time CO₂ emission savings in kg. */
  onetimeEmissionSavings: number;
  /** Annual CO₂ emission savings in kg/year. */
  ongoingEmissionSavings: number;
}
