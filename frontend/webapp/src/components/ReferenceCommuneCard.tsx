/**
 * ReferenceCommuneCard.tsx
 *
 * A preview card for a single prototype reference commune, displaying its name,
 * population, and description alongside a button that immediately applies it as
 * the active commune for the input page. Used on the home/start page to allow
 * users to quickly begin testing without entering their own commune data.
 */

import { ArrowRight, Users } from 'lucide-react';
import Button from './Button';
import { ReferenceCommunePreview } from '../types/inputTypes';

// --- Types ---

interface ReferenceCommuneCardProps {
  /** The reference commune data to display. */
  commune: ReferenceCommunePreview;
  /** Callback fired when the user clicks the selection button. */
  onSelect: () => void;
}

// --- Component ---

/**
 * ReferenceCommuneCard
 *
 * Renders a horizontal card with two columns:
 *  - Left: commune name, population count (formatted as German locale), description.
 *  - Right: a fixed-width selection button that triggers onSelect.
 */
const ReferenceCommuneCard = ({ commune, onSelect }: ReferenceCommuneCardProps) => {
  return (
    <div className="bg-white text-left rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200">
      <div className="flex items-center gap-6">

        {/* Left column — commune name, population, and description */}
        <div className="flex-1">
          <div className="flex items-baseline gap-3 mb-2">
            <h3 className="text-2xl font-semibold text-gray-900">
              {commune.name}
            </h3>
            {/* Population formatted as a German locale number (e.g. "12.345 Einwohner") */}
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <Users className="w-4 h-4" />
              <span>({commune.population.toLocaleString('de-DE')} Einwohner)</span>
            </div>
          </div>
          <p className="text-gray-700 text-sm leading-relaxed">
            {commune.description}
          </p>
        </div>

        {/* Right column — selection button, flex-shrink-0 prevents it from
            compressing when the description text is long */}
        <div className="flex-shrink-0">
          <Button
            onClick={onSelect}
            className="gap-2 whitespace-nowrap"
            size="lg"
          >
            Mit dieser Kommune starten
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

      </div>
    </div>
  );
};

export default ReferenceCommuneCard;