/**
 * MatrixCanvas.test.tsx
 *
 */

import { render, screen } from '@testing-library/react';
import MatrixCanvas from '../../components/results/MatrixCanvas';

// ---------------------------------------------------------------------------
// Capture store — Objekt-Mutation ist in jest.mock() Factories erlaubt
// ---------------------------------------------------------------------------

const capture = {
  scatterProps:   {} as any,
  xAxis:          null as ((v: number) => string) | null,
  yAxis:          null as ((v: number) => string) | null,
  cells:          [] as any[],
  scatterClick:   null as ((data: any) => void) | null,
};

jest.mock('recharts', () => {
  return {
    ScatterChart:        ({ children }: any) => <div data-testid="scatter-chart">{children}</div>,
    Scatter:             ({ data, fill, onClick, children }: any) => {
      capture.scatterProps = { data, fill };
      capture.scatterClick = onClick;
      capture.cells        = [];
      return <div data-testid="scatter">{children}</div>;
    },
    XAxis:               ({ tickFormatter }: any) => {
      capture.xAxis = tickFormatter;
      return <div data-testid="xaxis" />;
    },
    YAxis:               ({ tickFormatter }: any) => {
      capture.yAxis = tickFormatter;
      return <div data-testid="yaxis" />;
    },
    ZAxis:               () => <div data-testid="zaxis" />,
    CartesianGrid:       () => <div data-testid="grid" />,
    Tooltip:             () => <div data-testid="tooltip" />,
    ResponsiveContainer: ({ children }: any) => <div data-testid="responsive">{children}</div>,
    Cell:                ({ fill, stroke, strokeWidth, opacity }: any) => {
      capture.cells.push({ fill, stroke, strokeWidth, opacity });
      return <div data-testid="cell" data-fill={fill} />;
    },
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MEASURES = [
  {
    measure:        { id: 'm1', title: 'Solar' },
    investmentCost: 50000,
    time:           12,
    climateScore:   3,
    timeScore:      4,
    costScore:      2,
  },
  {
    measure:        { id: 'm2', title: 'Wind' },
    investmentCost: 200000,
    time:           24,
    climateScore:   5,
    timeScore:      3,
    costScore:      1,
  },
];

function renderCanvas(overrides: {
  measures?:          any[];
  selectedMeasureId?: string | null;
  onSelectMeasure?:   jest.Mock;
  height?:            number;
} = {}) {
  const {
    measures          = MEASURES,
    selectedMeasureId = null,
    onSelectMeasure   = jest.fn(),
    height,
  } = overrides;
  const props: any = { measures, selectedMeasureId, onSelectMeasure };
  if (height !== undefined) props.height = height;
  render(<MatrixCanvas {...props} />);
  return { onSelectMeasure };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MatrixCanvas', () => {
  beforeEach(() => {
    capture.scatterProps = {};
    capture.xAxis        = null;
    capture.yAxis        = null;
    capture.cells        = [];
    capture.scatterClick = null;
  });

  // --- Empty state ----------------------------------------------------------

  it('shows "Keine Daten verfügbar" when measures is empty', () => {
    renderCanvas({ measures: [] });
    expect(screen.getByText('Keine Daten verfügbar')).toBeInTheDocument();
  });

  it('shows empty-state sub-text', () => {
    renderCanvas({ measures: [] });
    expect(screen.getByText(/Bitte führen Sie zuerst eine Berechnung durch/)).toBeInTheDocument();
  });

  it('applies default height 600 in empty state', () => {
    renderCanvas({ measures: [] });
    const el = document.querySelector('[style*="height"]') as HTMLElement;
    expect(el?.style.height).toBe('600px');
  });

  it('applies custom height in empty state', () => {
    renderCanvas({ measures: [], height: 300 });
    const el = document.querySelector('[style*="height"]') as HTMLElement;
    expect(el?.style.height).toBe('300px');
  });

  it('does NOT render chart in empty state', () => {
    renderCanvas({ measures: [] });
    expect(screen.queryByTestId('scatter-chart')).not.toBeInTheDocument();
  });

  // --- Populated state ------------------------------------------------------

  it('renders ResponsiveContainer when measures present', () => {
    renderCanvas();
    expect(screen.getByTestId('responsive')).toBeInTheDocument();
  });

  it('applies default height=600 to wrapper', () => {
    renderCanvas();
    const wrapper = document.querySelector('.bg-white.rounded-lg') as HTMLElement;
    expect(wrapper?.style.height).toBe('600px');
  });

  it('applies custom height to wrapper', () => {
    renderCanvas({ height: 400 });
    const wrapper = document.querySelector('.bg-white.rounded-lg') as HTMLElement;
    expect(wrapper?.style.height).toBe('400px');
  });

  // --- Data mapping ---------------------------------------------------------

  it('maps measure to data points correctly', () => {
    renderCanvas();
    expect(capture.scatterProps.data[0]).toEqual(
      expect.objectContaining({ id: 'm1', name: 'Solar', x: 50000, y: 12, z: 3 })
    );
  });

  it('maps second measure correctly', () => {
    renderCanvas();
    expect(capture.scatterProps.data[1]).toEqual(
      expect.objectContaining({ id: 'm2', name: 'Wind', x: 200000, y: 24, z: 5 })
    );
  });

  it('uses 0 for missing investmentCost', () => {
    renderCanvas({ measures: [{ measure: { id: 'x', title: 'X' } }] });
    expect(capture.scatterProps.data[0].x).toBe(0);
  });

  it('uses 0 for missing time', () => {
    renderCanvas({ measures: [{ measure: { id: 'x', title: 'X' } }] });
    expect(capture.scatterProps.data[0].y).toBe(0);
  });

  it('uses 1 for missing climateScore (z)', () => {
    renderCanvas({ measures: [{ measure: { id: 'x', title: 'X' } }] });
    expect(capture.scatterProps.data[0].z).toBe(1);
  });

  it('falls back to empty string for missing measure id', () => {
    renderCanvas({ measures: [{ measure: {} }] });
    expect(capture.scatterProps.data[0].id).toBe('');
  });

  // --- formatCost (YAxis tickFormatter) -------------------------------------

  it('formatCost formats millions as "X.XM"', () => {
    renderCanvas();
    expect(capture.yAxis!(1_500_000)).toBe('1.5M');
  });

  it('formatCost formats thousands as "Xk"', () => {
    renderCanvas();
    expect(capture.yAxis!(50_000)).toBe('50k');
  });

  it('formatCost returns plain number for small values', () => {
    renderCanvas();
    expect(capture.yAxis!(500)).toBe('500');
  });

  // --- formatTime (XAxis tickFormatter) -------------------------------------

  it('formatTime returns raw value as string', () => {
    renderCanvas();
    expect(capture.xAxis!(12)).toBe('12');
  });

  // --- handleClick ----------------------------------------------------------

  it('calls onSelectMeasure with data.id on scatter click', () => {
    const { onSelectMeasure } = renderCanvas();
    capture.scatterClick!({ id: 'm1', name: 'Solar', x: 50000, y: 12 });
    expect(onSelectMeasure).toHaveBeenCalledWith('m1');
  });

  // --- Cell styling ---------------------------------------------------------

  it('selected bubble gets dark fill (#328E6E)', () => {
    renderCanvas({ selectedMeasureId: 'm1' });
    expect(capture.cells[0].fill).toBe('#328E6E');
  });

  it('unselected bubble gets green fill (#67AE6E)', () => {
    renderCanvas({ selectedMeasureId: 'm1' });
    expect(capture.cells[1].fill).toBe('#67AE6E');
  });

  it('selected bubble has strokeWidth=3', () => {
    renderCanvas({ selectedMeasureId: 'm1' });
    expect(capture.cells[0].strokeWidth).toBe(3);
  });

  it('unselected bubble has strokeWidth=1', () => {
    renderCanvas({ selectedMeasureId: 'm1' });
    expect(capture.cells[1].strokeWidth).toBe(1);
  });

  it('selected bubble has opacity=1', () => {
    renderCanvas({ selectedMeasureId: 'm1' });
    expect(capture.cells[0].opacity).toBe(1);
  });

  it('unselected bubble has opacity=0.7', () => {
    renderCanvas({ selectedMeasureId: 'm1' });
    expect(capture.cells[1].opacity).toBe(0.7);
  });

  it('all bubbles unselected when selectedMeasureId=null', () => {
    renderCanvas({ selectedMeasureId: null });
    capture.cells.forEach(c => expect(c.fill).toBe('#67AE6E'));
  });

  // --- Legend ---------------------------------------------------------------

  it('renders bubble size legend text', () => {
    renderCanvas();
    expect(screen.getByText(/Bubble-Größe = Klima-Score/)).toBeInTheDocument();
  });
});