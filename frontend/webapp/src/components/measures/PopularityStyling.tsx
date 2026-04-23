/**
 * PopularityStyling.ts
 *
 * Pure utility functions for mapping PopularityLevel values to display strings.
 * Centralises all popularity-related presentation logic so that MeasureCard,
 * MeasurePopup, and any future consumers share a single source of truth for
 * colours and labels.
 */

import { PopularityLevel } from '../../types/measureTypes';

// --- Utilities ---

/**
 * Maps a PopularityLevel to a Tailwind class string covering background,
 * text, and border colours. Follows the green / yellow / red traffic-light
 * convention used across the application.
 *
 * @param popularity The popularity level to style.
 * @returns A combined Tailwind class string for bg, text, and border.
 */
export const getPopularityStyle = (popularity: PopularityLevel): string => {
  switch (popularity) {
    case 'hoch':   return 'bg-green-100 text-green-800 border-green-300';
    case 'mittel': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'niedrig':    return 'bg-red-100 text-red-800 border-red-300';
    default:       return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

/**
 * Maps a PopularityLevel to a short localised label suitable for display
 * in badges and tooltips.
 *
 * @param popularity The popularity level to label.
 * @returns A short German-language acceptance label.
 */
export const getPopularityLabel = (popularity: PopularityLevel): string => {
  switch (popularity) {
    case 'hoch':   return 'Hohe Akzeptanz';
    case 'mittel': return 'Mittlere Akzeptanz';
    case 'niedrig':    return 'Geringe Akzeptanz';
    default:       return 'Unbekannte Akzeptanz';
  }
};