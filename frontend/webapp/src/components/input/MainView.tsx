/**
 * MainView.tsx
 *
 * The primary input view for a single data category (General, Energy, Mobility,
 * Water). Fetches the field definitions for the active category from the backend
 * on mount and re-fetches whenever the category prop changes. Renders each field
 * via InputField, displays a validation error banner when required fields are
 * unmet, and auto-scrolls to the first erroneous field when validation runs.
 */

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { AlertCircle } from 'lucide-react';
import { CategorizedFields, InputFieldDefinition } from '../../types/inputTypes';
import InputField from './fields/InputField';
import communityService from '../../services/CommunityService';
import { selectValidationErrors } from '../../store/UISlice';

// --- Types ---

interface MainViewProps {
  /** The data category whose input fields should be loaded and displayed. */
  category: 'General' | 'Energy' | 'Mobility' | 'Water';
}

// --- Component ---

/**
 * MainView
 *
 * Sections:
 *  - Field-definition loading via useEffect (re-runs on category change)
 *  - Auto-scroll effect triggered by validationErrors changes
 *  - getCategoryTitle / getCategoryDescription — pure category → string helpers
 *  - Three early-return states: loading spinner, fetch error, empty field list
 *  - Main render: header, validation banner, column headers, field list, legend
 */
const MainView = ({ category }: MainViewProps) => {
  /** Field definitions fetched from the backend for the active category. */
  const [allFields, setAllFields] = useState<CategorizedFields>();
  const [currentFields, setCurrentFields] = useState<InputFieldDefinition[]>([]);

  /** True while the field-definition fetch is in progress. */
  const [loading, setLoading] = useState(true);

  /** Error message to display when the field fetch fails; null when healthy. */
  const [error, setError] = useState<string | null>(null);

  /** Map of field IDs to their active validation error messages. */
  const validationErrors = useSelector(selectValidationErrors);

  // --- Data loading ---

  /**
   * Fetches input field definitions for the current category on mount.
   * Only the slice for the active category is stored in state; other categories are discarded.
   */
  useEffect(() => {
    const loadFields = async () => {
      try {
        setLoading(true);
        const allFields = await communityService.getInputParameters();
        setAllFields(allFields);
        setError(null);
      } catch (err) {
        console.error('Error loading fields:', err);
        setError('Felder konnten nicht geladen werden');
      } finally {
        setLoading(false);
      }
    };

    loadFields();
  }, []);

  useEffect(() => {
    if (allFields) {
      setCurrentFields(allFields[category] || []);
    }
  }, [category, allFields]);

  // --- Validation scroll ---

  /**
   * Scrolls the first field with a validation error into view whenever the
   * set of validation errors changes. Uses the DOM ID convention `field-{id}`
   * that InputField is expected to apply to its root element.
   */
  useEffect(() => {
    const errorFieldIds = Object.keys(validationErrors);
    if (errorFieldIds.length > 0) {
      const firstFieldId = errorFieldIds[0];
      const element = document.getElementById(`field-${firstFieldId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [validationErrors]);

  // --- Category helpers ---

  /** Returns the localised display title for the active category. */
  const getCategoryTitle = () => {
    switch (category) {
      case 'General':  return 'Allgemeine Angaben';
      case 'Energy':   return 'Energie';
      case 'Mobility': return 'Mobilität';
      case 'Water':    return 'Wasser';
      default:         return category;
    }
  };

  /** Returns the localised descriptive subtitle for the active category. */
  const getCategoryDescription = () => {
    switch (category) {
      case 'General':
        return 'Grundlegende Informationen über Ihre Kommune, die für die Bewertung verschiedener Maßnahmen relevant sind.';
      case 'Energy':
        return 'Angaben zum Energieverbrauch und zur Energieversorgung Ihrer Kommune.';
      case 'Mobility':
        return 'Informationen über Verkehr und Mobilität in Ihrer Kommune.';
      case 'Water':
        return 'Daten zur Wasserversorgung und Abwasserentsorgung.';
      default:
        return '';
    }
  };

  // --- Early-return states ---

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-secondary border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-600">Lade Eingabefelder...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="p-4 bg-red-50 border-l-4 border-red-400 rounded">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (currentFields.length === 0) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="text-center py-12">
          <p className="text-gray-600">Keine Felder für diese Kategorie verfügbar.</p>
        </div>
      </div>
    );
  }

  /** True when at least one field in the current category has a validation error. */
  const hasValidationErrors = Object.keys(validationErrors).length > 0;

  return (
    <div className="max-w-7xl mx-auto py-8">

      {/* Header — category title, description, and conditional validation banner */}
      <div className="px-4 mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-3">
          {getCategoryTitle()}
        </h2>
        <p className="text-gray-600">
          {getCategoryDescription()}
        </p>

        {/* Validation error banner — only shown when required fields are unmet */}
        {hasValidationErrors && (
          <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-400 rounded text-left">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800 mb-1">
                  Pflichtfelder nicht ausgefüllt
                </p>
                <p className="text-sm text-red-700">
                  Bitte füllen Sie alle markierten Pflichtfelder aus, bevor Sie fortfahren.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Column headers */}
      <div className="bg-secondary text-gray-800 px-6 py-3 grid grid-cols-3 gap-4">
        <div className="font-semibold text-sm">Eingabefeld</div>
        <div className="font-semibold text-sm">Wert</div>
        <div className="font-semibold text-sm">Beschreibung</div>
      </div>

      {/* Input field list — each field alternates background via its categoryIndex */}
      <div className="border-l border-r border-b border-gray-200">
        {currentFields.map((field, index) => (
          <InputField
            key={field.id}
            field={field}
            categoryIndex={index}
            level={0}
          />
        ))}
      </div>

      {/* Required-field legend */}
      <div className="px-4 mt-6">
        <p className="text-sm text-gray-600">
          <span className="text-red-500">*</span> = Pflichtfeld (muss ausgefüllt werden)
        </p>
      </div>
    </div>
  );
};

export default MainView;