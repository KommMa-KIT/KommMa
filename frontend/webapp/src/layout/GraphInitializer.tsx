/**
 * GraphInitializer.tsx
 *
 * Renderless component that triggers the one-time load of the dependency-graph
 * edges. The fetch itself, the shared edge data and the DependencyGraphService
 * initialisation live in GraphSlice; this component only starts the request.
 *
 * Mounted once in MainLayout so the graph is available on every page. Repeated
 * mounts are harmless, as the thunk skips the request while one is running or
 * once it has succeeded. Failures end up in the GraphSlice state; the rest of
 * the application keeps working without graph functionality.
 */

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { fetchGraphEdges } from '../store/GraphSlice';
import { AppDispatch } from '../store/store';

/**
 * GraphInitializer
 *
 * Dispatches fetchGraphEdges on mount. Renders nothing (returns null).
 */
const GraphInitializer = () => {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    dispatch(fetchGraphEdges());
  }, [dispatch]);

  return null;
};

export default GraphInitializer;