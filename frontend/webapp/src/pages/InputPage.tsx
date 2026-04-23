/**
 * InputPage.tsx
 *
 * The multi-step data entry page where users provide information about their
 * commune. The active step is driven by the currentCategory value in the Redux
 * store, which is advanced and retreated by NavigationButtons. The progress
 * bar and navigation buttons are sticky so they remain accessible while the
 * user scrolls through longer input categories.
 */

import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentCategory } from '../store/UISlice';
import InputProgressBar from '../components/input/ProgressBar';
import StartView from '../components/input/StartView';
import InputCategoryView from '../components/input/MainView';
import EndView from '../components/input/EndView';
import NavigationButtons from '../components/input/NavigationButtons';
import ExportButton from '../components/input/ExportButton';

// --- Component ---

/**
 * InputPage
 *
 * Sections:
 *  - Scroll-to-top effect triggered on every category change.
 *  - renderCurrentView — resolves the active category to its view component.
 *  - Layout: sticky InputProgressBar (top), fixed ExportButton (top-right),
 *    scrollable content area, sticky NavigationButtons (bottom).
 */
const InputPage = () => {
  /** The currently active input step, driven by the Redux store. */
  const currentCategory = useSelector(selectCurrentCategory);

  // --- Effects ---

  /**
   * Scrolls to the top of the page whenever the category changes so the user
   * always starts reading a new step from the beginning rather than mid-page.
   */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentCategory]);

  // --- View resolver ---

  /**
   * Returns the view component corresponding to the active category.
   * The four data categories (General, Energy, Mobility, Water) all use
   * InputCategoryView with a category prop rather than dedicated components,
   * keeping the step-switching logic centralised here. Falls back to a visible
   * error message for any unrecognised category value.
   */
  const renderCurrentView = () => {
    switch (currentCategory) {
      case 'Start':
        return <StartView />;

      case 'General':
        return <InputCategoryView category="General" />;

      case 'Energy':
        return <InputCategoryView category="Energy" />;

      case 'Mobility':
        return <InputCategoryView category="Mobility" />;

      case 'Water':
        return <InputCategoryView category="Water" />;

      case 'End':
        return <EndView />;

      default:
        /* Unrecognised category — renders a visible error rather than silently rendering nothing. */
        return (
          <div className="text-center py-12">
            <p className="text-gray-600">Unbekannte Kategorie: {currentCategory}</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex flex-col">

      {/* Progress bar — sticky below the Navbar, always visible while scrolling */}
      <InputProgressBar />

      {/* Export button — fixed to the top-right corner, independent of scroll position */}
      <ExportButton />

      {/* Scrollable content area — bottom padding reserves space for the sticky NavigationButtons */}
      <div className="flex-1 pb-24">
        {renderCurrentView()}
      </div>

      {/* Navigation buttons — sticky to the bottom of the viewport */}
      <NavigationButtons />

    </div>
  );
};

export default InputPage;