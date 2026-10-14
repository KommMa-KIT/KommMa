/**
 * GraphSlice.ts
 *
 * Redux slice holding the dependency-graph edges fetched from the backend and
 * the loading state of that request. It is the single source of truth for graph
 * data: views read the raw edges from here, and the same fetch also builds the
 * query maps inside DependencyGraphService.
 *
 * The fetch thunk is guarded by a condition, so the backend is contacted at most
 * once per session no matter how often or from where the thunk is dispatched.
 * A failed request can be retried by dispatching the thunk again.
 */

import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import graphService from '../services/GraphService';
import dependencyGraphService from '../services/DependencyGraphService';
import { GraphEdge } from '../types/graphTypes';

// --- Types ---

/** Lifecycle of the graph request. */
export type GraphStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface GraphState {
  /** All directed edges returned by the backend; empty until the fetch succeeds. */
  edges: GraphEdge[];
  /** Current lifecycle stage of the fetch. */
  status: GraphStatus;
  /** Message of the last failed fetch; null otherwise. */
  error: string | null;
}

/** Minimal root-state shape required by this slice's thunk and selectors. */
type GraphRootState = { graph: GraphState };

// --- Constants ---

/** Error message used when a failed fetch provides none. */
const fallbackErrorMessage = 'Fehler beim Laden des Graphen';

const initialState: GraphState = {
  edges: [],
  status: 'idle',
  error: null,
};

// --- Thunks ---

/**
 * Fetches all graph edges and builds the DependencyGraphService maps from them.
 *
 * The maps are built inside the thunk, before the fulfilled action is dispatched,
 * so components that react to the store update never read a half-initialised
 * service. The condition skips the request while one is running or after it has
 * succeeded; only an idle or failed state triggers a (new) fetch.
 */
export const fetchGraphEdges = createAsyncThunk<GraphEdge[], void, { state: GraphRootState }>(
  'graph/fetchEdges',
  async () => {
    const edges = await graphService.fetchGraph();
    dependencyGraphService.buildGraph(edges);
    return edges;
  },
  {
    condition: (_, { getState }) => {
      const { status } = getState().graph;
      return status === 'idle' || status === 'failed';
    },
  },
);

// --- Slice ---

const graphSlice = createSlice({
  name: 'graph',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchGraphEdges.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchGraphEdges.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.edges = action.payload;
      })
      .addCase(fetchGraphEdges.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || fallbackErrorMessage;
      });
  },
});

// --- Selectors ---

/** All graph edges; empty until the fetch has succeeded. */
export const selectGraphEdges = (state: GraphRootState) => state.graph.edges;

/** Lifecycle stage of the graph request. */
export const selectGraphStatus = (state: GraphRootState) => state.graph.status;

/** Error message of the last failed fetch, or null. */
export const selectGraphError = (state: GraphRootState) => state.graph.error;

/**
 * True while graph data is not yet available. The idle state counts as loading,
 * since the initializer dispatches the fetch right after the first render.
 */
export const selectGraphLoading = (state: GraphRootState) =>
  state.graph.status === 'idle' || state.graph.status === 'loading';

export default graphSlice.reducer;