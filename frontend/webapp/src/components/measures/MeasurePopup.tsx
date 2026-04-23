/**
 * MeasurePopup.tsx
 *
 * A Radix UI Dialog that displays full details for a single measure, opened
 * when the user clicks a MeasureCard. Sections include a cover image header,
 * short description, popularity badge with optional comment, full description,
 * relevant parameters, external resource links, and a list of prerequisite
 * measures resolved via the DependencyGraphService.
 */

import { useSelector } from 'react-redux';
import { selectAllMeasures } from '../../store/MeasuresSlice';
import dependencyGraphService from '../../services/DependencyGraphService';
import * as Dialog from '@radix-ui/react-dialog';
import { Users, ArrowUpRight, Minus, ArrowDownRight, CircleX, X, ExternalLink } from 'lucide-react';
import { Measure, PopularityLevel } from '../../types/measureTypes';
import GraphInitializer from '../GraphInitializer';

// --- Types ---

interface MeasurePopupProps {
  measure: Measure;
  /** Whether the dialog is currently open. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// --- Component ---

/**
 * MeasurePopup
 *
 * Sections:
 *  - getPopularityLabel — maps PopularityLevel to a directional icon
 *  - getPopularityColor — maps PopularityLevel to a Tailwind colour pair
 *  - Prerequisite resolution via DependencyGraphService + Redux measure list
 *  - Dialog render: backdrop, cover image, close button, content body
 *    (title, short description, popularity badge, full description,
 *     relevant parameters, further resources, prerequisite list)
 */
const MeasurePopup = ({ measure, open, onOpenChange }: MeasurePopupProps) => {

  // --- Helpers ---

  /**
   * Returns a directional icon representing the measure's acceptance level.
   * hoch → upward arrow, mittel → dash, niedrig → downward arrow,
   * unknown → circled X as a visible fallback.
   */
  const getPopularityLabel = (popularity: PopularityLevel) => {
    switch (popularity) {
      case 'hoch':
        return <ArrowUpRight className="h-5 w-5" />;
      case 'mittel':
        return <Minus className="h-5 w-5" />;
      case 'niedrig':
        return <ArrowDownRight className="h-5 w-5" />;
      default:
        return <CircleX className="h-5 w-5" />;
    }
  };

  /**
   * Returns a Tailwind text + background colour pair for the popularity badge.
   * Matches the green / yellow / red traffic-light convention used elsewhere.
   */
  const getPopularityColor = (popularity: PopularityLevel) => {
    switch (popularity) {
      case 'hoch':
        return 'text-green-700 bg-green-50';
      case 'mittel':
        return 'text-yellow-700 bg-yellow-50';
      case 'niedrig':
        return 'text-red-700 bg-red-50';
      default:
        return 'text-gray-700 bg-gray-50';
    }
  };

  // --- Prerequisite resolution ---

  /** Full measure list from Redux, used to resolve prerequisite IDs to full objects. */
  const allMeasures = useSelector(selectAllMeasures);

  /** Set of measure IDs that must be implemented before this measure can be applied. */
  const prerequisiteIds = dependencyGraphService.getPrerequisiteMeasures(measure.id);

  /** Full Measure objects for each prerequisite ID, filtered from the Redux list. */
  const prerequisiteMeasures = allMeasures.filter(m => prerequisiteIds.has(m.id));

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>

        {/* Backdrop — blurs the page content behind the dialog */}
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200" />

        {/* Dialog panel */}
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-100 rounded-lg shadow-2xl z-50 w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">

          {/* Cover image header — falls back to a gradient when the image fails to load */}
          <div className="relative h-64 bg-gradient-to-br from-secondary/20 to-tertiary/20">
            <img
              src={measure.imageURL}
              alt={measure.title}
              className="w-full h-full object-cover"
              /** Hide the broken-image element on error; the gradient background shows through. */
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />

            {/* Close button — positioned absolutely over the cover image */}
            <Dialog.Close className="absolute top-4 right-4 p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-colors">
              <X className="h-5 w-5 text-gray-700" />
            </Dialog.Close>
          </div>

          {/* Content body */}
          <div className="p-6 space-y-6">

            {/* Title and short description */}
            <div>
              <Dialog.Title className="text-3xl font-bold text-gray-900 mb-3">
                {measure.title}
              </Dialog.Title>
              <p className="text-gray-700 leading-relaxed">{measure.shortDescription}</p>
            </div>

            {/* Popularity badge — icon + optional comment inline */}
            <div className={`inline-flex items-center gap-1 px-2 py-0.1 rounded-full ${getPopularityColor(measure.popularity)}`}>
              <Users className="h-4 w-4" />
              <span className="text-sm font-semibold">
                {getPopularityLabel(measure.popularity)}
              </span>
              {/* Optional popularity comment — only rendered when provided */}
              {measure.popularityComment && (
                <div className="p-4 bg-accent-2 border-l-4 border-secondary rounded">
                  <p className="text-sm text-gray-700">{measure.popularityComment}</p>
                </div>
              )}
            </div>

            {/* Full description — whitespace preserved for multi-paragraph text */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Beschreibung</h3>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                {measure.description}
              </p>
            </div>

            {/* Relevant parameters — only rendered when the list is non-empty */}
            {measure.relevantParameters.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Relevante Faktoren</h3>
                <div className="flex flex-wrap gap-2">
                  {measure.relevantParameters.map((param, index) => (
                    <span
                      key={index}
                      className="px-3 py-2 bg-accent-2 text-accent-3 rounded-lg text-sm font-medium"
                    >
                      {param}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Further resources — external links, only rendered when provided */}
            {measure.furtherInfo.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Weitere Informationen</h3>
                <div className="space-y-2">
                  {measure.furtherInfo.map((link, index) => (
                    <a
                      key={index}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-secondary hover:text-tertiary hover:underline transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>{link}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* GraphInitializer — ensures the dependency graph is loaded before
                the prerequisite list attempts to resolve IDs */}
            <GraphInitializer />

            {/* Prerequisite measures — only rendered when at least one exists */}
            {prerequisiteMeasures.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Vorausgesetzte Maßnahmen
                </h3>
                <div className="space-y-2">
                  {prerequisiteMeasures.map(prereq => (
                    <div
                      key={prereq.id}
                      className="flex items-center gap-2 px-3 py-2 bg-accent-2 rounded-lg"
                    >
                      <span className="text-sm font-medium text-gray-800">
                        {prereq.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default MeasurePopup;