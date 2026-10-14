import { configureStore } from '@reduxjs/toolkit';
import graphReducer, {
  fetchGraphEdges,
  selectGraphEdges,
  selectGraphError,
  selectGraphLoading,
  selectGraphStatus,
} from './GraphSlice';
import graphService from '../services/GraphService';
import dependencyGraphService from '../services/DependencyGraphService';
import { GraphEdge } from '../types/graphTypes';

jest.mock('../services/GraphService', () => ({
  __esModule: true,
  default: { fetchGraph: jest.fn() },
}));

jest.mock('../services/DependencyGraphService', () => ({
  __esModule: true,
  default: { buildGraph: jest.fn() },
}));

const fetchGraph = graphService.fetchGraph as jest.Mock;
const buildGraph = dependencyGraphService.buildGraph as jest.Mock;

const edges = [{ from: 'a', to: 'b', type: 'synergy' }] as GraphEdge[];

const createTestStore = () => configureStore({ reducer: { graph: graphReducer } });

describe('GraphSlice', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('starts idle with no edges and counts as loading', () => {
    const store = createTestStore();
    expect(selectGraphStatus(store.getState())).toBe('idle');
    expect(selectGraphEdges(store.getState())).toEqual([]);
    expect(selectGraphLoading(store.getState())).toBe(true);
  });

  it('stores the edges and builds the dependency graph on success', async () => {
    fetchGraph.mockResolvedValue(edges);
    const store = createTestStore();

    await store.dispatch(fetchGraphEdges());

    expect(selectGraphStatus(store.getState())).toBe('succeeded');
    expect(selectGraphEdges(store.getState())).toEqual(edges);
    expect(selectGraphLoading(store.getState())).toBe(false);
    expect(buildGraph).toHaveBeenCalledWith(edges);
  });

  it('stores the error message on failure', async () => {
    fetchGraph.mockRejectedValue(new Error('Network down'));
    const store = createTestStore();

    await store.dispatch(fetchGraphEdges());

    expect(selectGraphStatus(store.getState())).toBe('failed');
    expect(selectGraphError(store.getState())).toBe('Network down');
    expect(buildGraph).not.toHaveBeenCalled();
  });

  it('does not fetch again once the edges are loaded', async () => {
    fetchGraph.mockResolvedValue(edges);
    const store = createTestStore();

    await store.dispatch(fetchGraphEdges());
    await store.dispatch(fetchGraphEdges());

    expect(fetchGraph).toHaveBeenCalledTimes(1);
  });

  it('fetches only once when dispatched concurrently', async () => {
    fetchGraph.mockResolvedValue(edges);
    const store = createTestStore();

    await Promise.all([
      store.dispatch(fetchGraphEdges()),
      store.dispatch(fetchGraphEdges()),
    ]);

    expect(fetchGraph).toHaveBeenCalledTimes(1);
  });

  it('retries after a failed fetch and clears the error', async () => {
    fetchGraph.mockRejectedValueOnce(new Error('Network down'));
    fetchGraph.mockResolvedValueOnce(edges);
    const store = createTestStore();

    await store.dispatch(fetchGraphEdges());
    await store.dispatch(fetchGraphEdges());

    expect(fetchGraph).toHaveBeenCalledTimes(2);
    expect(selectGraphStatus(store.getState())).toBe('succeeded');
    expect(selectGraphError(store.getState())).toBeNull();
  });
});