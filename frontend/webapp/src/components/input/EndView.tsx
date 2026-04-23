/**
 * EndView.tsx
 *
 * The final section of the input page, allowing users to declare subsidies
 * available for specific measure categories. Each subsidy entry consists of a
 * category selection, a numeric amount, and a unit (euro or percent). Subsidy
 * state is managed in Redux; available categories are loaded asynchronously from
 * the backend on mount. The "Add" button is hidden once all available categories
 * have been assigned to prevent duplicates.
 */

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Trash2, Euro, Percent } from 'lucide-react';
import { SubsidyCategory, SubsidyUnit } from '../../types/inputTypes';
import {
  addSubsidy,
  updateSubsidy,
  removeSubsidy,
  selectSubsidies,
} from '../../store/CommunitySlice';
import communityService from '../../services/CommunityService';

// --- Component ---

/**
 * EndView
 *
 * Sections:
 *  - Async category loading via useEffect
 *  - Five Redux dispatch handlers (add, category change, value change, unit change, remove)
 *  - Two pure derivation helpers (getCategoryTitle, getAvailableCategories)
 *  - Rendered subsidy list with per-entry category dropdown, amount input,
 *    euro/percent toggle, delete button, and completion summary
 *  - Conditional UI states: loading spinner, empty state, all-categories-used notice
 *  - Static info box
 */
const EndView = () => {
  const dispatch = useDispatch();

  /** Currently configured subsidy entries from the Redux store. */
  const subsidies = useSelector(selectSubsidies);

  /** Full list of subsidy categories fetched from the backend. */
  const [categories, setCategories] = useState<SubsidyCategory[]>([]);

  /** True while the category fetch is in progress; controls the loading spinner. */
  const [loading, setLoading] = useState(true);

  // --- Data loading ---

  /**
   * Fetches available subsidy categories from the backend on mount.
   * Errors are logged to the console; the loading flag is always cleared
   * in the finally block so the UI does not remain stuck in the loading state.
   */
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setLoading(true);
        const data = await communityService.getSubsidyCategories();
        setCategories(data);
      } catch (err) {
        console.error('Error while loading subsidy categories: ', err);
      } finally {
        setLoading(false);
      }
    };
    loadCategories();
  }, []);

  // --- Handlers ---

  /**
   * Appends a new blank subsidy entry to the Redux list.
   * Initialised with an empty category ID and zero value so the entry
   * is immediately visible but not yet considered complete.
   */
  const handleAdd = () => {
    dispatch(addSubsidy({
      id: '',
      value: 0,
      unit: 'euro',
    }));
  };

  /**
   * Updates the category ID of the subsidy at the given index,
   * preserving all other fields on the entry.
   */
  const handleCategoryChange = (index: number, categoryId: string) => {
    const subsidy = subsidies[index];
    dispatch(updateSubsidy({
      index,
      subsidy: { ...subsidy, id: categoryId },
    }));
  };

  /**
   * Updates the numeric amount of the subsidy at the given index,
   * preserving all other fields on the entry.
   */
  const handleValueChange = (index: number, value: number) => {
    const subsidy = subsidies[index];
    dispatch(updateSubsidy({
      index,
      subsidy: { ...subsidy, value },
    }));
  };

  /**
   * Toggles the unit (euro / percent) of the subsidy at the given index,
   * preserving all other fields on the entry.
   */
  const handleUnitChange = (index: number, unit: SubsidyUnit) => {
    const subsidy = subsidies[index];
    dispatch(updateSubsidy({
      index,
      subsidy: { ...subsidy, unit },
    }));
  };

  /** Removes the subsidy entry at the given index from the Redux list. */
  const handleRemove = (index: number) => {
    dispatch(removeSubsidy(index));
  };

  // --- Derivation helpers ---

  /**
   * Returns the display title for a category by its ID.
   * Falls back to 'Unbekannt' when the ID is not found in the loaded categories.
   */
  const getCategoryTitle = (id: string) => {
    const category = categories.find(c => c.id === id);
    return category?.title || 'Unbekannt';
  };

  /**
   * Returns the subset of categories not yet assigned to another subsidy entry.
   * The current entry's own ID is excluded from the "used" set so its own
   * category remains selectable in its dropdown.
   */
  const getAvailableCategories = (currentId: string) => {
    const usedIds = subsidies
      .filter(s => s.id !== currentId)
      .map(s => s.id);
    return categories.filter(c => !usedIds.includes(c.id));
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">

      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-3">
          Fördermittel
        </h2>
        <p className="text-gray-600">
          Geben Sie hier an, ob für bestimmte Maßnahmenkategorien Fördermittel zur Verfügung 
          stehen. Dies kann die Priorisierung beeinflussen.
        </p>
      </div>

      {/* Loading state — shown while categories are being fetched */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-secondary border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-600">Lade Fördermittel-Kategorien...</p>
        </div>
      )}

      {/* Subsidy list — rendered once categories have loaded */}
      {!loading && (
        <div className="space-y-4">
          {subsidies.map((subsidy, index) => {
            const availableCategories = getAvailableCategories(subsidy.id);

            /** An entry is considered complete when both a category and a non-zero value are set. */
            const isComplete = subsidy.id && subsidy.value > 0;

            return (
              <div
                key={index}
                className={`bg-white border-2 rounded-lg p-6 transition-all ${
                  isComplete ? 'border-green-300' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-4">

                  {/* Category dropdown */}
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Fördermittel vorhanden für
                    </label>
                    <select
                      value={subsidy.id}
                      onChange={(e) => handleCategoryChange(index, e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    >
                      <option value="">-- Kategorie wählen --</option>

                      {/* Current selection — always rendered so the controlled value
                          remains visible even if the category is no longer in the
                          available list (e.g. after another entry claimed it) */}
                      {subsidy.id && (
                        <option value={subsidy.id}>
                          {getCategoryTitle(subsidy.id)}
                        </option>
                      )}

                      {/* Remaining categories not yet assigned to another entry */}
                      {availableCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Amount input */}
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Höhe der Fördermittel
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={subsidy.value || ''}
                        onChange={(e) => handleValueChange(index, parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        min="0"
                        /** Finer step for percentages; coarser step for euro amounts. */
                        step={subsidy.unit === 'percent' ? '0.1' : '100'}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Unit toggle (euro / percent) */}
                  <div className="w-40">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Einheit
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleUnitChange(index, 'euro')}
                        className={`
                          flex-1 px-3 py-2 rounded-lg border-2 font-medium transition-all
                          flex items-center justify-center gap-1
                          ${subsidy.unit === 'euro'
                            ? 'border-green-700 border-secondary bg-secondary text-black'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-secondary'
                          }
                        `}
                      >
                        <Euro className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnitChange(index, 'percent')}
                        className={`
                          flex-1 px-3 py-2 rounded-lg border-2 font-medium transition-all
                          flex items-center justify-center gap-1
                          ${subsidy.unit === 'percent'
                            ? 'border-green-700 border-secondary bg-secondary text-black'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-secondary'
                          }
                        `}
                      >
                        <Percent className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Delete button */}
                  <div className="pt-7">
                    <button
                      type="button"
                      onClick={() => handleRemove(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Entfernen"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Completion summary — only shown when both category and value are set */}
                {isComplete && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Zusammenfassung:</span>{' '}
                      {getCategoryTitle(subsidy.id)} →{' '}
                      {subsidy.unit === 'euro'
                        ? `${subsidy.value.toLocaleString('de-DE')} €`
                        : `${subsidy.value} %`
                      }
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add button — hidden once every available category has been assigned */}
          {categories.length > subsidies.length && (
            <button
              type="button"
              onClick={handleAdd}
              className="w-full px-6 py-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-secondary hover:text-secondary hover:bg-secondary/5 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="h-5 w-5" />
              <span className="font-medium text-gray-600">Weitere Fördermittel hinzufügen</span>
            </button>
          )}

          {/* All-categories-used notice — shown when every category has an entry */}
          {categories.length > 0 && categories.length === subsidies.length && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-600">
                Alle verfügbaren Fördermittel-Kategorien wurden hinzugefügt.
              </p>
            </div>
          )}

          {/* Empty state — shown when no subsidy entries exist yet */}
          {subsidies.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-600 mb-4">
                Noch keine Fördermittel eingetragen
              </p>
              <button
                type="button"
                onClick={handleAdd}
                className="px-6 py-2 bg-secondary text-gray-600 rounded-lg hover:bg-tertiary transition-colors inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4 text-gray-600" />
                Erstes Fördermittel hinzufügen
              </button>
            </div>
          )}
        </div>
      )}

      {/* Static info box */}
      <div className="mt-8 p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">
          Hinweis zu Fördermitteln
        </h4>
        <p className="text-sm text-blue-800">
          Die Angabe von Fördermitteln ist optional. Sie können die Berechnung auch ohne 
          Fördermittel-Angaben starten. Die Berücksichtigung von Fördermitteln kann jedoch 
          die Kosteneffizienz bestimmter Maßnahmen erheblich verbessern.
        </p>
      </div>
    </div>
  );
};

export default EndView;