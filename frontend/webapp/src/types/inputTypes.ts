/**
 * inputTypes.ts
 *
 * Shared type definitions for the input page domain. Covers field definitions,
 * commune identity, prefill data, subsidies, and the serialisation formats used
 * for calculation requests, JSON exports, and import validation.
 *
 * Key distinctions:
 *  - CategoryType includes 'Start' and 'End' navigation steps; CategoryKey
 *    covers only the four data categories accepted by the backend.
 *  - InputValue is the union of all concrete field value types plus null,
 *    used uniformly across inputs, prefill data, exports, and API payloads.
 *  - individual (boolean per field) distinguishes user-entered values (true)
 *    from backend-sourced or average-derived values (false).
 */

// --- Field types ---

/** The four concrete input control types rendered by InputField. */
export type InputFieldType = 'number' | 'selection' | 'multiSelection' | 'bool';

/**
 * All valid input page steps, including the Start and End navigation steps
 * that bracket the four data categories.
 */
export type CategoryType = 'Start' | 'General' | 'Energy' | 'Mobility' | 'Water' | 'End';

/**
 * The four data-entry category keys recognised by the backend and used as
 * keys in CategorizedFields. Excludes 'Start' and 'End'.
 */
export type CategoryKey = 'General' | 'Energy' | 'Mobility' | 'Water';

/** The two unit options for a subsidy value. */
export type SubsidyUnit = 'euro' | 'percent';

// --- Field definitions ---

/**
 * Defines a single input field as returned by the backend parameters endpoint.
 * Fields may be nested — subinputs are child fields conditionally shown below
 * their parent when the parent has a relevant value.
 */
export interface InputFieldDefinition {
  id:          string;
  title:       string;
  type:        InputFieldType;
  /** Optional unit label displayed alongside number inputs (e.g. "kWh", "€"). */
  unit?:       string;
  description: string;
  /** When true, the field must be filled before the user can proceed to the next category. */
  critical:    boolean;
  /** Available option strings for selection and multiSelection fields. */
  selectable?: string[];
  /** Nested child fields shown conditionally beneath this field. */
  subinputs:   InputFieldDefinition[];
}

/**
 * The full set of input field definitions grouped by the four data categories.
 * Populated by CommunityService.getInputParameters after backend category name
 * translation.
 */
export interface CategorizedFields {
  General:  InputFieldDefinition[];
  Energy:   InputFieldDefinition[];
  Mobility: InputFieldDefinition[];
  Water:    InputFieldDefinition[];
}

// --- Value types ---

/**
 * Union of all concrete value types that an input field can hold, plus null
 * for unset fields. Used uniformly across the inputs map, prefill data,
 * exports, and API request payloads.
 */
export type InputValue = number | string | boolean | string[] | null;

// --- Subsidies ---

/** A single declared subsidy entry configured in the EndView step. */
export interface Subsidy {
  /** References a SubsidyCategory id. */
  id:    string;
  value: number;
  unit:  SubsidyUnit;
}

/** A selectable subsidy category returned by the backend subsidies endpoint. */
export interface SubsidyCategory {
  id:    string;
  title: string;
}

// --- Commune identity ---

/** Basic commune identification data returned by the commune lookup endpoints. */
export interface CommuneInfo {
  name:        string;
  /** 5-digit German postal code. */
  postal_code: string;
  /** 8-digit AGS (Amtlicher Gemeindeschlüssel) commune key. */
  key:         string;
}

// --- Prefill data ---

/**
 * A map of prefill values for input fields, keyed by field ID.
 * Returned by both the commune-specific prefill endpoint and the national
 * average endpoint, and also used as the shape of ImportValidationResponse.
 */
export interface PrefillData {
  [fieldId: string]: {
    value:      InputValue;
    /** Human-readable attribution for the data source (e.g. dataset name). */
    source:     string;
    /** ISO date string of the data's last known update. */
    date:       string;
    /**
     * True when the value is specific to this commune; false when it is
     * derived from national averages or a reference commune.
     */
    individual: boolean;
  };
}

// --- Reference communes ---

/**
 * Full data for a prototype reference commune, including all input field values.
 * Returned by the reference commune detail endpoint.
 */
export interface ReferenceCommune {
  id:     string;
  name:   string;
  inputs: Array<{
    id:    string;
    value: InputValue;
  }>;
}

/**
 * Lightweight preview of a reference commune for display on the start page.
 * Returned by the reference communes list endpoint.
 */
export interface ReferenceCommunePreview {
  id:          string;
  name:        string;
  /** Total population count, displayed formatted in the ReferenceCard. */
  population:  number;
  description: string;
}

// --- Serialisation ---

/**
 * The JSON export format produced by SaveService.downloadCurrent and parsed
 * by SaveService.parseImport. Commune identity fields are nullable to support
 * sessions where the user has not yet selected a commune.
 */
export interface InputExport {
  /** ISO timestamp of when the export was created. */
  timestamp:                string;
  communeKey:               string | null;
  communeName:              string | null;
  postalCode:               string | null;
  selectedReferenceCommune: string | null;
  /** Current value for each input field, keyed by field ID. */
  inputs:     { [fieldId: string]: InputValue };
  /** Per-field individualisation flags (see individual in CommunitySlice). */
  individual: { [fieldId: string]: boolean };
  /** Per-field source attribution strings. */
  sources:    { [fieldId: string]: string };
  subsidies:  Subsidy[];
}

// --- API payloads ---

/**
 * The request body sent to the calculation endpoint.
 * Each input entry carries its individualisation flag so the backend can
 * weight commune-specific values differently from average-derived values.
 */
export interface CalculationRequest {
  inputs: Array<{
    id:         string;
    value:      InputValue;
    individual: boolean;
  }>;
  subsidies: Subsidy[];
}

/**
 * The request body sent to the import validation endpoint.
 * Contains only the subset of imported fields that carry a backend source,
 * as only these need freshness checking against the current dataset.
 */
export interface ImportValidationRequest {
  /** AGS commune key used to look up current values on the backend. */
  community_key: string;
  inputs: Array<{
    id:     string;
    value:  InputValue;
    source: string;
  }>;
}

/**
 * The response from the import validation endpoint.
 * Returns updated values for any fields whose backend data has changed since
 * the export was created. Shares the same per-field shape as PrefillData.
 */
export interface ImportValidationResponse {
  [fieldId: string]: {
    value:      InputValue;
    source:     string;
    date:       string;
    individual: boolean;
  };
}