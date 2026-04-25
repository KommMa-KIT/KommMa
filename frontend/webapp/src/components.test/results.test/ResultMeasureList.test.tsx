/**
 * ResultMeasureList.test.tsx
 *
 * Tests for ResultMeasureList covering all three render states:
 *  1. Completely empty (visibleMeasures=[], filteredOutMeasures=[])
 *  2. All hidden (visibleMeasures=[], filteredOutMeasures=[...])
 *  3. Normal (visibleMeasures=[...], filteredOutMeasures=[])
 *  4. Normal + some hidden (both arrays populated)
 *
 * Also covers:
 *  - buildCardProps resolves all status flags correctly
 *  - Rank numbers assigned correctly
 *  - Synergy/conflict highlighting passed to card
 */

import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ResultMeasureList from '../../components/results/ResultMeasureList';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const capturedCardProps: any[] = [];
jest.mock('../../components/results/ResultMeasureCard', () => (props: any) => {
  capturedCardProps.push(props);
  return (
    <div
      data-testid={`card-${props.measure.id}`}
      data-rank={props.result.rank}
      data-filtered={String(props.isFiltered)}
      data-hidden={String(props.isHidden)}
      data-transitive={String(props.isTransitiveInfeasible)}
      data-synergy={String(props.hasSynergy)}
      data-conflict={String(props.hasConflict)}
    />
  );
});

jest.mock('../../store/ResultSlice', () => ({
  selectVisibleMeasures:     (state: any) => state.result.visible,
  selectFilteredOutMeasures: (state: any) => state.result.filteredOut,
  selectMeasureStatus:       (state: any) => state.result.status,
  selectHiddenMeasures:      (state: any) => state.result.hidden,
  selectSynergyMeasures:     (state: any) => state.result.synergy,
  selectConflictMeasures:    (state: any) => state.result.conflict,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeItem(id: string, extra: any = {}) {
  return {
    measure: { id, title: `Measure ${id}` },
    timeScore: 1, costScore: 2, climateScore: 3,
    timeScale: 1, costScale: 2, climateScale: 3,
    time: 6, investmentCost: 10000, ongoingCost: 500,
    totalCost: 15000, onetimeEmissionSavings: 100, ongoingEmissionSavings: 50,
    filtered: false,
    ...extra,
  };
}

function buildStore({
  visible        = [],
  filteredOut    = [],
  implemented    = [] as string[],
  infeasible     = [] as string[],
  hidden         = new Set<string>(),
  synergy        = new Set<string>(),
  conflict       = new Set<string>(),
}: {
  visible?:     any[];
  filteredOut?: any[];
  implemented?: string[];
  infeasible?:  string[];
  hidden?:      Set<string>;
  synergy?:     Set<string>;
  conflict?:    Set<string>;
} = {}) {
  return configureStore({
    reducer: {
      result: () => ({
        visible,
        filteredOut,
        status: { implemented, infeasible },
        hidden,
        synergy,
        conflict,
      }),
    },
  });
}

function renderList(storeOptions = {}) {
  const store = buildStore(storeOptions);
  render(
    <Provider store={store}>
      <ResultMeasureList />
    </Provider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ResultMeasureList', () => {
  beforeEach(() => {
    capturedCardProps.length = 0;
  });

  // --- Completely empty state -----------------------------------------------

  it('shows "Keine Ergebnisse gefunden" when both arrays empty', () => {
    renderList();
    expect(screen.getByText('Keine Ergebnisse gefunden')).toBeInTheDocument();
  });

  it('shows empty state sub-text', () => {
    renderList();
    expect(screen.getByText(/Bitte führe zuerst eine Bewertung durch/)).toBeInTheDocument();
  });

  it('does NOT render any cards in empty state', () => {
    renderList();
    expect(capturedCardProps).toHaveLength(0);
  });

  // --- All-hidden state (visible=[], filteredOut=[...]) ---------------------

  it('shows all-hidden warning when visible=[] but filteredOut has items', () => {
    renderList({ visible: [], filteredOut: [makeItem('f1'), makeItem('f2')] });
    expect(screen.getByText('Alle Maßnahmen wurden ausgeblendet')).toBeInTheDocument();
  });

  it('shows filteredOut count in all-hidden state', () => {
    renderList({ visible: [], filteredOut: [makeItem('f1'), makeItem('f2')] });
    expect(screen.getByText(/2 Maßnahmen/)).toBeInTheDocument();
  });

  it('renders "Ausgeblendete Maßnahmen" heading in all-hidden state', () => {
    renderList({ visible: [], filteredOut: [makeItem('f1')] });
    expect(screen.getByText('Ausgeblendete Maßnahmen (1)')).toBeInTheDocument();
  });

  it('renders cards for each filteredOut measure in all-hidden state', () => {
    renderList({ visible: [], filteredOut: [makeItem('f1'), makeItem('f2')] });
    expect(screen.getByTestId('card-f1')).toBeInTheDocument();
    expect(screen.getByTestId('card-f2')).toBeInTheDocument();
  });

  it('assigns rank starting at 1 in all-hidden state', () => {
    renderList({ visible: [], filteredOut: [makeItem('f1'), makeItem('f2')] });
    expect(screen.getByTestId('card-f1')).toHaveAttribute('data-rank', '1');
    expect(screen.getByTestId('card-f2')).toHaveAttribute('data-rank', '2');
  });

  // --- Normal state (visible=[...], filteredOut=[]) -------------------------

  it('renders visible measure count header', () => {
    renderList({ visible: [makeItem('v1'), makeItem('v2')], filteredOut: [] });
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('uses "Maßnahmen" (plural) for count > 1', () => {
    renderList({ visible: [makeItem('v1'), makeItem('v2')], filteredOut: [] });
    expect(screen.getByText(/Maßnahmen basierend auf Ihren Angaben/)).toBeInTheDocument();
  });

  it('uses "Maßnahme" (singular) for count = 1', () => {
    renderList({ visible: [makeItem('v1')], filteredOut: [] });
    expect(screen.getByText(/Maßnahme basierend auf Ihren Angaben/)).toBeInTheDocument();
  });

  it('renders cards for visible measures', () => {
    renderList({ visible: [makeItem('v1'), makeItem('v2')], filteredOut: [] });
    expect(screen.getByTestId('card-v1')).toBeInTheDocument();
    expect(screen.getByTestId('card-v2')).toBeInTheDocument();
  });

  it('assigns rank 1 to first visible measure', () => {
    renderList({ visible: [makeItem('v1'), makeItem('v2')], filteredOut: [] });
    expect(screen.getByTestId('card-v1')).toHaveAttribute('data-rank', '1');
  });

  it('assigns rank 2 to second visible measure', () => {
    renderList({ visible: [makeItem('v1'), makeItem('v2')], filteredOut: [] });
    expect(screen.getByTestId('card-v2')).toHaveAttribute('data-rank', '2');
  });

  it('does NOT render hidden section when filteredOut=[]', () => {
    renderList({ visible: [makeItem('v1')], filteredOut: [] });
    expect(screen.queryByText(/Ausgeblendete Maßnahmen/)).not.toBeInTheDocument();
  });

  // --- Normal + hidden section ----------------------------------------------

  it('shows hidden count in header when filteredOut has items', () => {
    renderList({
      visible:     [makeItem('v1')],
      filteredOut: [makeItem('h1')],
    });
    expect(screen.getByText(/1 ausgeblendet/)).toBeInTheDocument();
  });

  it('renders "Ausgeblendete Maßnahmen (1)" heading when some filtered', () => {
    renderList({
      visible:     [makeItem('v1')],
      filteredOut: [makeItem('h1')],
    });
    expect(screen.getByText('Ausgeblendete Maßnahmen (1)')).toBeInTheDocument();
  });

  it('assigns rank = visibleCount + index + 1 to filtered measures', () => {
    renderList({
      visible:     [makeItem('v1'), makeItem('v2')],
      filteredOut: [makeItem('h1')],
    });
    // visible count = 2; h1 gets rank 3
    expect(screen.getByTestId('card-h1')).toHaveAttribute('data-rank', '3');
  });

  it('renders description text for hidden section', () => {
    renderList({
      visible:     [makeItem('v1')],
      filteredOut: [makeItem('h1')],
    });
    expect(screen.getByText(/ausgefiltert oder als umgesetzt/)).toBeInTheDocument();
  });

  // --- buildCardProps — status flags ----------------------------------------

  it('passes isFiltered=true when item.filtered=true', () => {
    renderList({
      visible: [makeItem('v1', { filtered: true })],
      filteredOut: [],
    });
    expect(screen.getByTestId('card-v1')).toHaveAttribute('data-filtered', 'true');
  });

  it('passes isHidden=true when measure is in hiddenMeasures set', () => {
    renderList({
      visible: [makeItem('h1')],
      filteredOut: [],
      hidden: new Set(['h1']),
    });
    expect(screen.getByTestId('card-h1')).toHaveAttribute('data-hidden', 'true');
  });

  it('passes isTransitiveInfeasible=true when hidden but NOT implemented/infeasible', () => {
    renderList({
      visible: [makeItem('h1')],
      filteredOut: [],
      hidden: new Set(['h1']),
      implemented: [],
      infeasible: [],
    });
    expect(screen.getByTestId('card-h1')).toHaveAttribute('data-transitive', 'true');
  });

  it('passes isTransitiveInfeasible=false when hidden AND implemented', () => {
    renderList({
      visible: [makeItem('h1')],
      filteredOut: [],
      hidden: new Set(['h1']),
      implemented: ['h1'],
    });
    expect(screen.getByTestId('card-h1')).toHaveAttribute('data-transitive', 'false');
  });

  it('passes isTransitiveInfeasible=false when hidden AND infeasible', () => {
    renderList({
      visible: [makeItem('h1')],
      filteredOut: [],
      hidden: new Set(['h1']),
      infeasible: ['h1'],
    });
    expect(screen.getByTestId('card-h1')).toHaveAttribute('data-transitive', 'false');
  });

  it('passes hasSynergy=true when measure is in synergyMeasures set', () => {
    renderList({
      visible: [makeItem('s1')],
      filteredOut: [],
      synergy: new Set(['s1']),
    });
    expect(screen.getByTestId('card-s1')).toHaveAttribute('data-synergy', 'true');
  });

  it('passes hasConflict=true when measure is in conflictMeasures set', () => {
    renderList({
      visible: [makeItem('c1')],
      filteredOut: [],
      conflict: new Set(['c1']),
    });
    expect(screen.getByTestId('card-c1')).toHaveAttribute('data-conflict', 'true');
  });
});