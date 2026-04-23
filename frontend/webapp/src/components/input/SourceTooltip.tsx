/**
 * SourceTooltip.tsx
 *
 * A small info icon button that reveals the data source of a pre-filled input
 * field on hover. Rendered in the fixed-width tooltip slot inside InputField
 * whenever a community or external source is attached to a field value.
 */

import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../Tooltip';

// --- Types ---

interface SourceTooltipProps {
  /** The source string to display inside the tooltip (e.g. a dataset or authority name). */
  source: string;
}

// --- Component ---

/**
 * SourceTooltip
 *
 * Wraps an Info icon in a TooltipProvider so hovering reveals the source
 * attribution for a pre-filled field value. Rendered as a button to remain
 * keyboard-accessible; type="button" prevents accidental form submission.
 */
const SourceTooltip = ({ source }: SourceTooltipProps) => {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="flex-shrink-0 text-gray-400 hover:text-secondary transition-colors p-1"
            aria-label="Quellenangabe anzeigen"
          >
            <Info className="h-4 w-4" />
          </button>
        </TooltipTrigger>

        {/* Tooltip content — displays the source attribution above the trigger */}
        <TooltipContent side="top">
          <p>Quelle: {source}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default SourceTooltip;