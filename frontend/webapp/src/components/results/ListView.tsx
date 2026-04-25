/**
 * ListView.tsx
 *
 * Tab view that renders the full ranked measure list via ResultMeasureList.
 * Acts as a thin wrapper with no additional layout beyond what ResultMeasureList provides.
 */

import ResultMeasureList from '../results/ResultMeasureList';

/**
 * ListView
 *
 * Delegates entirely to ResultMeasureList.
 * Selector imports are kept for potential future additions (e.g. a summary header).
 */
const ListView = () => {
  return (
    <div className="space-y-6">
      <ResultMeasureList />
    </div>
  );
};

export default ListView;
