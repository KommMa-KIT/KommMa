/**
 * StartView.tsx
 *
 * The first step of the input page, where the user identifies their commune to
 * enable the prefill feature. Supports three lookup methods — AGS key, name
 * (with debounced autocomplete), and postal code — each of which triggers a
 * full prefill and average-data fetch on successful resolution. Optionally, the
 * user may select a prototype reference commune instead, which overwrites all
 * prefilled values with the reference commune's data.
 */

import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Search, MapPin, Hash, Building2 } from 'lucide-react';
import {
  setCommuneKey,
  setCommuneName,
  setPostalCode,
  fetchCommuneByKey,
  fetchCommuneByCode,
  fetchPrefillData,
  fetchAverageData,
  fetchReferenceCommune,
  selectCommuneKey,
  selectCommuneName,
  selectPostalCode,
  selectLoading,
  selectError,
  resetInputs,
} from '../../store/CommunitySlice';
import { AppDispatch } from '../../store/store';
import communityService from '../../services/CommunityService';
import { resetVisitedCategories } from '../../store/UISlice';

// --- Hooks ---

/**
 * useDebounce
 *
 * Returns a debounced copy of `value` that only updates after `delay`
 * milliseconds have elapsed since the last change. Used to throttle the
 * commune name search so the API is not called on every keystroke.
 *
 * @param value The value to debounce.
 * @param delay Milliseconds of inactivity to wait before propagating the new value.
 * @returns The debounced version of the provided value.
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// --- Component ---

/**
 * StartView
 *
 * Sections:
 *  - Redux state and local mirror state for each input field
 *  - Name suggestion state (list, visibility flag, searching flag)
 *  - Reference commune state and async loader
 *  - suppressNameSearchRef — prevents autocomplete from firing after
 *    programmatic name updates (key/postal-code lookups, suggestion selection)
 *  - Three sync-to-Redux effects (communeKey, communeName, postalCode)
 *  - Debounced name-search effect
 *  - Four async handlers: handleKeyChange, handleCodeChange,
 *    handleNameChange, handleSelectSuggestion
 *  - handleReferenceChange — swaps prefill data for a reference commune
 *  - Four input card sections: AGS, Name (with autocomplete), PLZ, Reference commune
 *  - Loading spinner overlay
 */
const StartView = () => {
  const dispatch = useDispatch<AppDispatch>();

  // --- Redux state ---

  const communeKey  = useSelector(selectCommuneKey);
  const communeName = useSelector(selectCommuneName);
  const postalCode  = useSelector(selectPostalCode);

  /** True while any async fetch (prefill, average data, lookup) is in progress. */
  const loading = useSelector(selectLoading);

  /** Error message from the last failed Redux thunk, or null when healthy. */
  const error = useSelector(selectError);

  // --- Local input state ---
  // Each field is mirrored locally so the input remains responsive while
  // Redux dispatches are async. The three sync effects below keep them aligned.

  const [localKey,  setLocalKey]  = useState(communeKey  || '');
  const [localName, setLocalName] = useState(communeName || '');
  const [localCode, setLocalCode] = useState(postalCode  || '');

  /** Currently selected reference commune ID; 'none' when no reference is active. */
  const [selectedReference, setSelectedReference] = useState<string>('none');

  // --- Name autocomplete state ---

  /** Commune suggestions returned by the name search API. */
  const [nameSuggestions, setNameSuggestions] = useState<Array<{
    key: string;
    name: string;
    postal_code: string;
  }>>([]);

  /** Controls dropdown visibility; closed on blur with a short delay to allow clicks. */
  const [showSuggestions, setShowSuggestions] = useState(false);

  /** True while an autocomplete search request is in flight. */
  const [isSearching, setIsSearching] = useState(false);

  // --- Reference commune state ---

  /** List of available prototype reference communes loaded from the backend. */
  const [referenceCommunes, setReferenceCommunes] = useState<Array<{
    id: string;
    name: string;
    population: number;
    description: string;
  }>>([]);

  // --- Refs ---

  const debouncedName = useDebounce(localName, 300);

  /**
   * When set to true, the next debouncedName change will skip the autocomplete
   * search and reset this flag. Used to suppress the dropdown after the name
   * field is updated programmatically (e.g. after a key/postal-code lookup or
   * suggestion selection), preventing an unwanted search on a value we just set.
   */
  const suppressNameSearchRef = useRef(false);

  /**
   * Tracks the previous value of debouncedName so the search effect can
   * distinguish a real user-driven change from the initial mount run.
   * Initialized to the current debouncedName so that on mount (and on
   * re-mount after navigation) prev === current and no search is triggered.
   */
  const prevDebouncedNameRef = useRef(debouncedName);

  // --- Effects ---

  /** Loads the list of prototype reference communes once on mount. */
  useEffect(() => {
    const loadReferenceCommunes = async () => {
      try {
        const communes = await communityService.getReferenceCommunesList();
        setReferenceCommunes(communes);
      } catch (err) {
        console.error('Error while loading reference communes:', err);
      }
    };
    loadReferenceCommunes();
  }, []);

  /**
   * Keeps local input state in sync with the Redux store.
   * Runs whenever the Redux values change (e.g. after a successful lookup
   * dispatched by one of the async handlers).
   */
  useEffect(() => {
    if (communeName) setLocalName(communeName);
    if (communeKey)  setLocalKey(communeKey);
    if (postalCode)  setLocalCode(postalCode);
  }, [communeKey, communeName, postalCode]);

  /**
   * Fires a commune name search whenever the debounced name value changes.
   * Skips the search when the value has not actually changed since the last
   * run (guards against the initial mount firing) or when suppressNameSearchRef
   * is true (guards against programmatic name updates triggering the dropdown).
   */
  useEffect(() => {
    const searchCommunes = async () => {
      // Only search if debouncedName actually changed, not just on mount/re-mount
      if (prevDebouncedNameRef.current === debouncedName) {
        return;
      }
      prevDebouncedNameRef.current = debouncedName;

      if (suppressNameSearchRef.current) {
        suppressNameSearchRef.current = false;
        return;
      }

      if (debouncedName.length < 2) {
        setNameSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      try {
        setIsSearching(true);
        const results = await communityService.searchCommunes(debouncedName);
        setNameSuggestions(results);
        setShowSuggestions(true);
      } catch (err) {
        console.error('Error while searching for commune by name:', err);
        setNameSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    };

    searchCommunes();
  }, [debouncedName]);

  // --- Handlers ---

  /**
   * Updates the AGS key locally and in Redux. When the key reaches its full
   * 8-digit length, fetches the matching commune, populates the name and
   * postal-code fields, and triggers a prefill + average-data fetch.
   * Suppresses the name autocomplete after the programmatic name update.
   */
  const handleKeyChange = async (value: string) => {
    setLocalKey(value);
    dispatch(setCommuneKey(value));

    if (value.length === 8) {
      try {
        const result = await dispatch(fetchCommuneByKey(value)).unwrap();

        suppressNameSearchRef.current = true;
        setLocalName(result.name);
        setLocalCode(result.postal_code);

        dispatch(resetInputs());
        dispatch(resetVisitedCategories());

        await dispatch(fetchPrefillData(value));
        await dispatch(fetchAverageData());
      } catch (err) {
        console.error('Error while loading commune by key:', err);
      }
    }
  };

  /**
   * Updates the postal code locally and in Redux. When the code reaches its
   * full 5-digit length and no AGS key is already set, resolves the commune,
   * backfills the key and name fields, and triggers a prefill + average-data
   * fetch. Suppresses autocomplete after the programmatic name update.
   */
  const handleCodeChange = async (value: string) => {
    setLocalCode(value);
    dispatch(setPostalCode(value));

    if (!communeKey && value.length === 5) {
      try {
        const result = await dispatch(fetchCommuneByCode(value)).unwrap();
        if (!localKey) setLocalKey(result.key);
        if (!localName) {
          suppressNameSearchRef.current = true;
          setLocalName(result.name);
        }

        dispatch(resetInputs());
        dispatch(resetVisitedCategories());

        await dispatch(fetchPrefillData(result.key));
        await dispatch(fetchAverageData());
      } catch (err) {
        console.error('Error while loading commune by postal code:', err);
      }
    }
  };

  /**
   * Updates the commune name locally and in Redux.
   * Does not trigger a lookup — the debounced autocomplete effect handles search.
   */
  const handleNameChange = (value: string) => {
    setLocalName(value);
    dispatch(setCommuneName(value));
  };

  /**
   * Applies a selected autocomplete suggestion, populating all three fields
   * (name, key, postal code) at once and triggering a prefill + average-data
   * fetch. Suppresses autocomplete before updating the name to prevent an
   * immediate re-search on the newly set value.
   */
  const handleSelectSuggestion = async (commune: {
    key: string;
    name: string;
    postal_code: string;
  }) => {
    suppressNameSearchRef.current = true;

    setLocalName(commune.name);
    setLocalKey(commune.key);
    setLocalCode(commune.postal_code);

    dispatch(setCommuneName(commune.name));
    dispatch(setCommuneKey(commune.key));
    dispatch(setPostalCode(commune.postal_code));

    setShowSuggestions(false);
    setNameSuggestions([]);

    dispatch(resetInputs());
    dispatch(resetVisitedCategories());

    await dispatch(fetchPrefillData(commune.key));
    await dispatch(fetchAverageData());
  };

  /**
   * Handles reference commune selection. When 'none' is selected, reverts to
   * the actual commune's prefill data if a key is available. Any other value
   * fetches the reference commune's data, overwriting all current prefill values.
   */
  const handleReferenceChange = async (value: string) => {
    setSelectedReference(value);

    if (value === 'none') {
      if (communeKey) {
        dispatch(resetInputs());
        dispatch(resetVisitedCategories());
        await dispatch(fetchPrefillData(communeKey));
        await dispatch(fetchAverageData());
      }
    } else {
      dispatch(resetInputs());
      dispatch(resetVisitedCategories());
      await dispatch(fetchReferenceCommune(value));
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">

      {/* Header */}
      <div className="mb-8">
        <div className="items-start justify-between mb-3">
          <h2 className="text-3xl font-bold text-gray-900">
            Gemeinde auswählen
          </h2>
        </div>
        <p className="text-gray-600">
          Geben Sie den amtlichen Gemeindeschlüssel, den Namen oder die Postleitzahl Ihrer 
          Kommune ein, um automatisch Daten vorausfüllen zu lassen. Alternativ können Sie 
          eine prototypische Kommune zum Testen wählen oder eine gespeicherte Sitzung importieren.
        </p>
      </div>

      {/* Global error banner — shown when a Redux thunk reports a failure */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 rounded">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-6">

        {/* AGS (Amtlicher Gemeindeschlüssel) input */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 hover:border-secondary transition-colors">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              <Hash className="h-6 w-6 text-secondary" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Amtlicher Gemeindeschlüssel (AGS)
              </label>
              <input
                type="text"
                value={localKey}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder="z.B. 08212000"
                maxLength={8}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
              />
              <p className="mt-2 text-sm text-gray-600">
                Der 8-stellige Schlüssel zur eindeutigen Identifikation Ihrer Kommune
              </p>
            </div>
          </div>
        </div>

        {/* Commune name input with debounced autocomplete dropdown */}
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              <Building2 className="h-6 w-6 text-secondary" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Name der Kommune
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={localName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="z.B. Karlsruhe"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent bg-white"
                  onFocus={() => debouncedName.length >= 2 && setShowSuggestions(true)}
                  /** 150 ms delay allows onMouseDown on a suggestion to fire before the list closes. */
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                />

                {/* Inline searching indicator — shown while the API call is in flight */}
                {isSearching && (
                  <div className="absolute right-3 top-2.5 text-xs text-gray-400">
                    Suche Kommunen...
                  </div>
                )}

                {/* Autocomplete suggestion dropdown */}
                {showSuggestions && nameSuggestions.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {nameSuggestions.map((commune) => (
                      <li
                        key={commune.key}
                        onMouseDown={() => handleSelectSuggestion(commune)}
                        className="px-4 py-2 cursor-pointer hover:bg-gray-100 text-sm"
                      >
                        <div className="font-medium">{commune.name}</div>
                        <div className="text-xs text-gray-500">
                          AGS: {commune.key} · PLZ: {commune.postal_code}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Der offizielle Name Ihrer Kommune
              </p>
            </div>
          </div>
        </div>

        {/* Postal code input */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 hover:border-secondary transition-colors">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              <MapPin className="h-6 w-6 text-secondary" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Postleitzahl
              </label>
              <input
                type="text"
                value={localCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="z.B. 76133"
                maxLength={5}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
              />
              <p className="mt-2 text-sm text-gray-600">
                Die Postleitzahl des Verwaltungssitzes
              </p>
            </div>
          </div>
        </div>

        {/* Reference commune selector — overwrites prefill data when selected */}
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              <Search className="h-6 w-6 text-secondary" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Prototypische Kommune (Optional)
              </label>
              <select
                value={selectedReference}
                onChange={(e) => handleReferenceChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent bg-white"
              >
                <option value="none">Keine (eigene Daten verwenden)</option>
                {referenceCommunes.map((commune) => (
                  <option key={commune.id} value={commune.id}>
                    {commune.name} ({commune.population} Einwohner)
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm text-gray-600">
                Wählen Sie eine prototypische Kommune zum Testen. ACHTUNG: Dies überschreibt alle 
                automatisch vorausgefüllten Daten.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Loading spinner — shown while any async lookup or prefill fetch is active */}
      {loading && (
        <div className="mt-6 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-secondary border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-600">Lade Gemeindedaten...</p>
        </div>
      )}
    </div>
  );
};

export default StartView;