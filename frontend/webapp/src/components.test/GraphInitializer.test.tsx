/**
 * GraphInitializer.test.tsx
 *
 * Tests for the GraphInitializer renderless component –
 * graph fetch, buildGraph delegation, and error handling.
 */

import { render, waitFor } from '@testing-library/react';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../services/GraphService', () => ({
  graphService: {
    fetchGraph: jest.fn(),
  },
}));

jest.mock('../services/DependencyGraphService', () => ({
  dependencyGraphService: {
    buildGraph: jest.fn(),
  },
}));

// ─── Import ───────────────────────────────────────────────────────────────────

import GraphInitializer from '../components/GraphInitializer';
import { graphService } from '../services/GraphService';
import { dependencyGraphService } from '../services/DependencyGraphService';

const mockFetchGraph = graphService.fetchGraph as jest.Mock;
const mockBuildGraph = dependencyGraphService.buildGraph as jest.Mock;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GraphInitializer', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders nothing – returns null', () => {
    mockFetchGraph.mockResolvedValue([]);
    const { container } = render(<GraphInitializer />);
    expect(container.firstChild).toBeNull();
  });

  it('calls fetchGraph once on mount', async () => {
    mockFetchGraph.mockResolvedValue([]);
    render(<GraphInitializer />);
    await waitFor(() => {
      expect(mockFetchGraph).toHaveBeenCalledTimes(1);
    });
  });

  it('calls buildGraph with the fetched edges', async () => {
    const edges = [
      { from: 'A', to: 'B', type: 'prerequisite' },
      { from: 'B', to: 'C', type: 'synergy' },
    ];
    mockFetchGraph.mockResolvedValue(edges);
    render(<GraphInitializer />);
    await waitFor(() => {
      expect(mockBuildGraph).toHaveBeenCalledWith(edges);
    });
  });

  it('calls buildGraph with an empty array when no edges are returned', async () => {
    mockFetchGraph.mockResolvedValue([]);
    render(<GraphInitializer />);
    await waitFor(() => {
      expect(mockBuildGraph).toHaveBeenCalledWith([]);
    });
  });

  it('logs an error when fetchGraph rejects', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchGraph.mockRejectedValue(new Error('Network error'));
    render(<GraphInitializer />);
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load dependency graph:',
        expect.any(Error)
      );
    });
    consoleSpy.mockRestore();
  });

  it('does not call buildGraph when fetchGraph rejects', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchGraph.mockRejectedValue(new Error('fail'));
    render(<GraphInitializer />);
    await waitFor(() => {
      expect(mockBuildGraph).not.toHaveBeenCalled();
    });
  });

  it('does not throw when fetchGraph rejects', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchGraph.mockRejectedValue(new Error('Unexpected'));
    expect(() => render(<GraphInitializer />)).not.toThrow();
  });
});