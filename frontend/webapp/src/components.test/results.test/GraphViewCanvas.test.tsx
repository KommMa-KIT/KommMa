/**
 * GraphViewCanvas.test.tsx
 */

import { render, screen, fireEvent } from '@testing-library/react';
import GraphViewCanvas from '../../components/results/GraphViewCanvas';

// ---------------------------------------------------------------------------
// Mocks — ReaGraph
// ---------------------------------------------------------------------------

let capturedGraphProps: any = {};

// These are defined OUTSIDE the factory and referenced via closure,
// but useSelection must NOT be jest.fn() — it must be a plain function
// that always returns a valid object.
const mockOnNodeClick   = { calls: [] as any[] };
const mockOnCanvasClick = { calls: [] as any[] };

jest.mock('reagraph', () => {
  const React = require('react');
  return {
    __esModule: true,
    GraphCanvas: React.forwardRef((props: any, _ref: any) => {
      capturedGraphProps = props;
      return (
        <div data-testid="graph-canvas">
          <button onClick={() => props.onNodeClick?.({ id: 'n1', label: 'Node 1' })}>
            click-node
          </button>
          <button onClick={() => props.onCanvasClick?.({})}>
            click-canvas
          </button>
        </div>
      );
    }),
    GraphNode: {},
    GraphEdge: {},
    useSelection: () => ({
      selections:    [],
      onNodeClick:   () => { mockOnNodeClick.calls.push(true); },
      onCanvasClick: () => { mockOnCanvasClick.calls.push(true); },
    }),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MEASURES = [
  { measure: { id: 'm1', title: 'Solar' },  totalScore: 200 },
  { measure: { id: 'm2', title: 'Wind' },   totalScore: 10  },
  { measure: { id: 'm3', title: 'Wasser' }, totalScore: 80  },
  { measure: { id: 'm4', title: 'Leere' },  totalScore: 0   },
];

const EDGES = [
  { from: 'm1', to: 'm2', type: 'synergy'      },
  { from: 'm2', to: 'm1', type: 'conflict'     },
  { from: 'm3', to: 'm4', type: 'dependency'   },
  { from: 'm1', to: 'm3', type: 'prerequisite' },
  { from: 'm2', to: 'm3', type: 'unknown_type' },
];

function renderCanvas(overrides: {
  measures?:          any[];
  edges?:             any[];
  selectedMeasureId?: string | null;
  onSelectMeasure?:   jest.Mock;
  height?:            number;
} = {}) {
  const {
    measures          = MEASURES,
    edges             = EDGES,
    selectedMeasureId = null,
    onSelectMeasure   = jest.fn(),
    height,
  } = overrides;

  const props: any = { measures, edges, selectedMeasureId, onSelectMeasure };
  if (height !== undefined) props.height = height;

  render(<GraphViewCanvas {...props} />);
  return { onSelectMeasure };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GraphViewCanvas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedGraphProps = {};
    mockOnNodeClick.calls   = [];
    mockOnCanvasClick.calls = [];
  });

  // --- Renders GraphCanvas --------------------------------------------------

  it('renders the GraphCanvas element', () => {
    renderCanvas();
    expect(screen.getByTestId('graph-canvas')).toBeInTheDocument();
  });

  // --- Node derivation ------------------------------------------------------

  it('derives correct number of nodes from measures', () => {
    renderCanvas();
    expect(capturedGraphProps.nodes).toHaveLength(MEASURES.length);
  });

  it('maps measure id to node id', () => {
    renderCanvas();
    expect(capturedGraphProps.nodes[0].id).toBe('m1');
  });

  it('maps measure title to node label', () => {
    renderCanvas();
    expect(capturedGraphProps.nodes[0].label).toBe('Solar');
  });

  it('clamps node size to max 20 for large totalScore', () => {
    renderCanvas();
    expect(capturedGraphProps.nodes[0].size).toBe(20);
  });

  it('clamps node size to min 5 for small totalScore', () => {
    renderCanvas();
    const windNode = capturedGraphProps.nodes.find((n: any) => n.id === 'm2');
    expect(windNode.size).toBe(5);
  });

  it('calculates correct size for mid-range totalScore (80 → 8)', () => {
    renderCanvas();
    const wasserNode = capturedGraphProps.nodes.find((n: any) => n.id === 'm3');
    expect(wasserNode.size).toBe(8);
  });

  it('handles missing measure data gracefully (empty id/label)', () => {
    const measures = [{ measure: { id: undefined, title: undefined }, totalScore: undefined }];
    renderCanvas({ measures });
    expect(capturedGraphProps.nodes[0].id).toBe('');
    expect(capturedGraphProps.nodes[0].label).toBe('');
    expect(capturedGraphProps.nodes[0].size).toBe(5);
  });

  // --- Edge derivation ------------------------------------------------------

  it('derives correct number of edges', () => {
    renderCanvas();
    expect(capturedGraphProps.edges).toHaveLength(EDGES.length);
  });

  it('edge id format is "from-to-index"', () => {
    renderCanvas();
    expect(capturedGraphProps.edges[0].id).toBe('m1-m2-0');
  });

  it('edge source maps to edge.from', () => {
    renderCanvas();
    expect(capturedGraphProps.edges[0].source).toBe('m1');
  });

  it('edge target maps to edge.to', () => {
    renderCanvas();
    expect(capturedGraphProps.edges[0].target).toBe('m2');
  });

  // --- getEdgeStyle colours -------------------------------------------------

  it('synergy edge gets green fill', () => {
    renderCanvas();
    expect(capturedGraphProps.edges[0].fill).toBe('#22c55e');
  });

  it('conflict edge gets red fill', () => {
    renderCanvas();
    const conflictEdge = capturedGraphProps.edges.find(
      (e: any) => e.source === 'm2' && e.target === 'm1'
    );
    expect(conflictEdge.fill).toBe('#ef4444');
  });

  it('dependency edge gets blue fill', () => {
    renderCanvas();
    const depEdge = capturedGraphProps.edges.find((e: any) => e.source === 'm3');
    expect(depEdge.fill).toBe('#3b82f6');
  });

  it('prerequisite edge gets purple fill', () => {
    renderCanvas();
    const prereqEdge = capturedGraphProps.edges.find(
      (e: any) => e.source === 'm1' && e.target === 'm3'
    );
    expect(prereqEdge.fill).toBe('#a855f7');
  });

  it('unknown type falls back to neutral grey fill', () => {
    renderCanvas();
    const neutralEdge = capturedGraphProps.edges.find(
      (e: any) => e.source === 'm2' && e.target === 'm3'
    );
    expect(neutralEdge.fill).toBe('#9ca3af');
  });

  // --- Node click -----------------------------------------------------------

  it('calls onSelectMeasure with node.id when node clicked', () => {
    const { onSelectMeasure } = renderCanvas();
    fireEvent.click(screen.getByText('click-node'));
    expect(onSelectMeasure).toHaveBeenCalledWith('n1');
  });

  it('calls ReaGraph onNodeClick when node clicked', () => {
    renderCanvas();
    fireEvent.click(screen.getByText('click-node'));
    expect(mockOnNodeClick.calls.length).toBe(1);
  });

  // --- Canvas click ---------------------------------------------------------

  it('calls onSelectMeasure(null) when canvas clicked', () => {
    const { onSelectMeasure } = renderCanvas();
    fireEvent.click(screen.getByText('click-canvas'));
    expect(onSelectMeasure).toHaveBeenCalledWith(null);
  });

  it('calls ReaGraph onCanvasClick when canvas clicked', () => {
    renderCanvas();
    fireEvent.click(screen.getByText('click-canvas'));
    expect(mockOnCanvasClick.calls.length).toBe(1);
  });

  // --- Height ---------------------------------------------------------------

  it('applies default height=600', () => {
    renderCanvas();
    const wrapper = document.querySelector('[style*="height"]') as HTMLElement;
    expect(wrapper?.style.height).toBe('600px');
  });

  it('applies custom height prop', () => {
    renderCanvas({ height: 400 });
    const wrapper = document.querySelector('[style*="height"]') as HTMLElement;
    expect(wrapper?.style.height).toBe('400px');
  });
});