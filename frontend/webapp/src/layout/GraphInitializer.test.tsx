import { StrictMode } from 'react';
import { render, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import GraphInitializer from './GraphInitializer';
import graphReducer from '../store/GraphSlice';
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

/** Renders the initializer under StrictMode, which double-invokes effects in development. */
const renderInitializer = () => {
  const store = configureStore({ reducer: { graph: graphReducer } });
  const view = render(
    <StrictMode>
      <Provider store={store}>
        <GraphInitializer />
      </Provider>
    </StrictMode>,
  );
  return { store, ...view };
};

describe('GraphInitializer', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders nothing', () => {
    fetchGraph.mockResolvedValue(edges);
    const { container } = renderInitializer();
    expect(container).toBeEmptyDOMElement();
  });

  it('loads the graph once and builds the dependency graph', async () => {
    fetchGraph.mockResolvedValue(edges);
    const { store } = renderInitializer();

    await waitFor(() => expect(store.getState().graph.status).toBe('succeeded'));

    expect(fetchGraph).toHaveBeenCalledTimes(1);
    expect(buildGraph).toHaveBeenCalledWith(edges);
  });

  it('records the error when the fetch fails', async () => {
    fetchGraph.mockRejectedValue(new Error('Network down'));
    const { store } = renderInitializer();

    await waitFor(() => expect(store.getState().graph.status).toBe('failed'));

    expect(store.getState().graph.error).toBe('Network down');
    expect(buildGraph).not.toHaveBeenCalled();
  });
});