/**
 * StartPage.tsx
 *
 * The landing page of the application. Provides entry points for starting a
 * new analysis, importing a saved session, and selecting a prototype reference
 * commune for testing. Also fetches and displays a data-freshness warning from
 * the backend if any datasets are outdated, so users are aware before running
 * a calculation.
 */

import { useNavigate } from 'react-router-dom';
import { ArrowRight, AlertTriangle, Upload, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import Button from '../components/Button';
import { API_BASE_URL } from '../config';
import ImportButton from '../components/ImportButton';
import { fetchReferenceCommune } from '../store/CommunitySlice';
import { setCurrentCategory } from '../store/UISlice';
import { ReferenceCommunePreview } from '../types/inputTypes';
import { communityService } from '../services/CommunityService';
import ReferenceCommuneCard from '../components/ReferenceCommuneCard';
import { AppDispatch } from '@/store/store';

// --- Types ---

interface OutdatedDatum {
  /** Human-readable dataset name displayed in the warning banner. */
  title: string;
  /** ISO date string of the dataset's last known update. */
  last_update: string;
}

// --- Utilities ---

/**
 * Fetches the list of outdated datasets from the backend.
 * Returns an empty array when all datasets are current; a non-empty array
 * triggers the yellow warning banner on the start page.
 */
async function fetchOutdated(): Promise<OutdatedDatum[]> {
  const response = await fetch(`${API_BASE_URL}/api/data/outdatedWarning`);
  if (!response.ok) {
    throw new Error('Failed to fetch outdated warning status');
  }
  return response.json();
}

// --- Component ---

/**
 * StartPage
 *
 * Sections:
 *  - Two parallel data fetches on mount: outdated-data warning and reference communes.
 *  - formatDate — converts ISO date strings to German locale for display.
 *  - handleSelectReferenceCommune — dispatches reference commune data and navigates
 *    to the input page at the General category.
 *  - Hero section: title, description, optional warning banner, error banner,
 *    action buttons (new analysis + import).
 *  - Reference communes section: loading spinner, grid of ReferenceCommuneCards,
 *    or empty state.
 */
const StartPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  /** Datasets flagged as outdated by the backend; empty when all data is current. */
  const [outdatedData, setOutdatedData] = useState<OutdatedDatum[]>([]);

  /** True while the outdated-data fetch is in progress. */
  const [isLoading, setIsLoading] = useState(true);

  /** Error message when the outdated-data fetch fails; null when healthy. */
  const [error, setError] = useState<string | null>(null);

  /** Prototype reference communes available for quick testing. */
  const [referenceCommunes, setReferenceCommunes] = useState<ReferenceCommunePreview[]>([]);

  /** True while the reference commune list fetch is in progress. */
  const [referencesLoading, setReferencesLoading] = useState(true);

  // --- Effects ---

  /**
   * Fetches the outdated-data warning list on mount. A failure here is
   * non-critical — the error state shows a soft warning rather than blocking
   * the page, since the user can still proceed with a calculation.
   */
  useEffect(() => {
    const loadOutdatedData = async () => {
      try {
        setIsLoading(true);
        const data = await fetchOutdated();
        setOutdatedData(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching outdated data:', err);
        setError('Warnung: Aktualität der Daten konnte nicht überprüft werden.');
      } finally {
        setIsLoading(false);
      }
    };

    loadOutdatedData();
  }, []);

  /**
   * Fetches the list of prototype reference communes on mount.
   * Errors are logged but not surfaced — the section simply renders
   * the empty state if the fetch fails.
   */
  useEffect(() => {
    const loadReferenceCommunes = async () => {
      try {
        setReferencesLoading(true);
        const communes = await communityService.getReferenceCommunesList();
        setReferenceCommunes(communes);
      } catch (err) {
        console.error('Error loading reference communes:', err);
      } finally {
        setReferencesLoading(false);
      }
    };

    loadReferenceCommunes();
  }, []);

  // --- Helpers ---

  /**
   * Converts an ISO date string to a German locale display string
   * (e.g. "15. März 2024"). Falls back to the raw string if parsing fails.
   */
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('de-DE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // --- Handlers ---

  /**
   * Fetches the full data for the selected reference commune, sets the input
   * page to the General category, and navigates to the input page.
   * Errors are logged but not surfaced — the user remains on the start page
   * if the dispatch fails.
   */
  const handleSelectReferenceCommune = async (id: string) => {
    try {
      await dispatch(fetchReferenceCommune(id));
      dispatch(setCurrentCategory('General'));
      navigate('/input');
    } catch (err) {
      console.error('Error loading reference commune:', err);
    }
  };

  return (
    <>
      {/* Hero section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10 py-16 px-4">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">

          {/* Application title */}
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-5xl font-semibold tracking-tight text-balance text-green-900 sm:text-7xl">
              KommMa
            </h1>
          </div>

          <p className="text-xl md:text-2xl text-muted-foreground mb-4">
            Interaktives Tool für Klimaschutzmaßnahmen
          </p>

          <p className="text-lg text-muted-foreground mb-8 max-w-2xl">
            KommMa ist ein Priorisierungstool für kommunale Klimaschutzmaßnahmen, das Entscheidungsträger:innen dabei unterstützt, die wirkungsvollsten Maßnahmen für ihre Kommune zu identifizieren miteinander zu vergleichen und umzusetzen.
          </p>

          {/* Outdated data warning — only shown after loading completes and when
              at least one dataset is flagged as stale by the backend */}
          {!isLoading && outdatedData.length > 0 && (
            <div className="mb-8 w-full max-w-2xl">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow-sm">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 text-yellow-700 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 text-left">
                    <h3 className="text-sm font-semibold text-yellow-900 mb-2">
                      Hinweis: Veraltete Daten
                    </h3>
                    <p className="text-sm text-yellow-800 mb-3">
                      Die folgenden Daten sind möglicherweise nicht mehr aktuell und könnten die Berechnungen beeinflussen:
                    </p>
                    <ul className="space-y-2">
                      {outdatedData.map((item, index) => (
                        <li key={index} className="text-sm text-yellow-900">
                          <span className="font-medium">{item.title}</span>
                          <span className="text-yellow-700 ml-2">
                            (Stand: {formatDate(item.last_update)})
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-sm text-yellow-800 mb-3">
                      Wir werden schnellstmöglich unseren Datensatz aktualisieren. Dies kann einige Tage dauern, wobei wir um Ihr Verständnis bitten.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fetch error banner — shown when the outdated-data check itself failed */}
          {error && !isLoading && (
            <div className="mb-8 w-full max-w-2xl">
              <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Primary action buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" onClick={() => navigate('/input')} className="gap-2">
              Neue Analyse starten
              <ArrowRight className="h-5 w-5" />
            </Button>

            {/* ImportButton uses the render-prop pattern to style its trigger */}
            <ImportButton>
              {(onImportClick) => (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={onImportClick}
                  className="gap-2"
                >
                  <Upload className="h-5 w-5" />
                  Sitzung importieren
                </Button>
              )}
            </ImportButton>
          </div>
        </div>
      </div>

      {/* Reference communes section */}
      <div className="bg-gray-100 py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Users className="w-6 h-6 text-primary" />
              <h2 className="text-3xl font-bold text-green-900">
                Prototypische Kommunen
              </h2>
            </div>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Testen Sie das Tool mit vordefinierten Beispielkommunen, um die Funktionsweise kennenzulernen.
            </p>
          </div>

          {/* Three render states: loading spinner, card grid, empty state */}
          {referencesLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
              <p className="mt-4 text-gray-600">Lade Beispielkommunen...</p>
            </div>
          ) : referenceCommunes.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 max-w-5xl mx-auto">
              {referenceCommunes.map((commune) => (
                <ReferenceCommuneCard
                  key={commune.id}
                  commune={commune}
                  onSelect={() => handleSelectReferenceCommune(commune.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              Keine Beispielkommunen verfügbar
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default StartPage;