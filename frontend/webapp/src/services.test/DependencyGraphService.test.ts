import dependencyGraphService from '../services/DependencyGraphService';

describe('DependencyGraphService – additional coverage', () => {
  beforeEach(() => {
    dependencyGraphService.reset();
  });

  describe('buildGraph', () => {
    it('handles an empty edge array', () => {
      expect(() => dependencyGraphService.buildGraph([])).not.toThrow();
      expect(dependencyGraphService.isInitialized()).toBe(true);
    });

    it('ignores duplicate edges by checking includes', () => {
      const edges: any[] = [
        { from: 'A', to: 'B', type: 'prerequisite' },
        { from: 'A', to: 'B', type: 'prerequisite' }, // duplicate
      ];
      dependencyGraphService.buildGraph(edges);
      expect(dependencyGraphService.getDirectDependentsCount('A')).toBe(1);
    });

    it('handles multiple synergy edges from the same source', () => {
      const edges: any[] = [
        { from: 'A', to: 'B', type: 'synergy' },
        { from: 'A', to: 'C', type: 'synergy' },
      ];
      dependencyGraphService.buildGraph(edges);
      const result = dependencyGraphService.getSynergyMeasures(['A']);
      expect(result).toEqual(new Set(['B', 'C']));
    });

    it('handles multiple conflict edges from the same source', () => {
      const edges: any[] = [
        { from: 'A', to: 'B', type: 'conflict' },
        { from: 'A', to: 'C', type: 'conflict' },
      ];
      dependencyGraphService.buildGraph(edges);
      const result = dependencyGraphService.getConflictMeasures(['A']);
      expect(result).toEqual(new Set(['B', 'C']));
    });

    it('handles multiple dependency edges from the same source', () => {
      const edges: any[] = [
        { from: 'A', to: 'X', type: 'dependency' },
        { from: 'A', to: 'Y', type: 'dependency' },
      ];
      dependencyGraphService.buildGraph(edges);
      const result = dependencyGraphService.getPrerequisiteMeasures('A');
      expect(result).toEqual(new Set(['X', 'Y']));
    });

    it('clears previous data when buildGraph is called again', () => {
      dependencyGraphService.buildGraph([{ from: 'A', to: 'B', type: 'prerequisite' } as any]);
      expect(dependencyGraphService.getDirectDependentsCount('A')).toBe(1);

      dependencyGraphService.buildGraph([]); // rebuild with no edges
      expect(dependencyGraphService.getDirectDependentsCount('A')).toBe(0);
    });
  });

  describe('getDependentMeasures', () => {
    it('returns empty Set for unknown measureId', () => {
      dependencyGraphService.buildGraph([]);
      expect(dependencyGraphService.getDependentMeasures('nonexistent').size).toBe(0);
    });

    it('handles circular dependencies without infinite loop', () => {
      // A → B → A (circular)
      const edges: any[] = [
        { from: 'A', to: 'B', type: 'prerequisite' },
        { from: 'B', to: 'A', type: 'prerequisite' },
      ];
      dependencyGraphService.buildGraph(edges);
      // Should not hang; both should be discoverable
      const result = dependencyGraphService.getDependentMeasures('A');
      expect(result.has('B')).toBe(true);
    });

    it('handles deep chains', () => {
      const edges: any[] = [
        { from: 'A', to: 'B', type: 'prerequisite' },
        { from: 'B', to: 'C', type: 'prerequisite' },
        { from: 'C', to: 'D', type: 'prerequisite' },
      ];
      dependencyGraphService.buildGraph(edges);
      const result = dependencyGraphService.getDependentMeasures('A');
      expect(result).toEqual(new Set(['B', 'C', 'D']));
    });
  });

  describe('getPrerequisiteMeasures', () => {
    it('returns empty Set for unknown measure', () => {
      dependencyGraphService.buildGraph([]);
      expect(dependencyGraphService.getPrerequisiteMeasures('unknown').size).toBe(0);
    });
  });

  describe('getSynergyMeasures', () => {
    it('returns empty Set for empty implementedIds', () => {
      dependencyGraphService.buildGraph([{ from: 'A', to: 'B', type: 'synergy' } as any]);
      expect(dependencyGraphService.getSynergyMeasures([]).size).toBe(0);
    });

    it('does not return measures already in implementedIds', () => {
      dependencyGraphService.buildGraph([{ from: 'A', to: 'B', type: 'synergy' } as any]);
      // B is already implemented
      const result = dependencyGraphService.getSynergyMeasures(['A', 'B']);
      expect(result.has('B')).toBe(false);
    });
  });

  describe('getConflictMeasures', () => {
    it('returns empty Set for empty implementedIds', () => {
      dependencyGraphService.buildGraph([{ from: 'A', to: 'B', type: 'conflict' } as any]);
      expect(dependencyGraphService.getConflictMeasures([]).size).toBe(0);
    });

    it('does not return measures already in implementedIds', () => {
      dependencyGraphService.buildGraph([{ from: 'A', to: 'B', type: 'conflict' } as any]);
      const result = dependencyGraphService.getConflictMeasures(['A', 'B']);
      expect(result.has('B')).toBe(false);
    });
  });

  describe('getDirectDependentsCount', () => {
    it('returns 0 for unknown measureId', () => {
      dependencyGraphService.buildGraph([]);
      expect(dependencyGraphService.getDirectDependentsCount('unknown')).toBe(0);
    });

    it('returns correct count for multiple dependents', () => {
      const edges: any[] = [
        { from: 'A', to: 'B', type: 'prerequisite' },
        { from: 'A', to: 'C', type: 'prerequisite' },
        { from: 'A', to: 'D', type: 'prerequisite' },
      ];
      dependencyGraphService.buildGraph(edges);
      expect(dependencyGraphService.getDirectDependentsCount('A')).toBe(3);
    });
  });

  describe('reset', () => {
    it('returns 0 dependents count after reset', () => {
      dependencyGraphService.buildGraph([{ from: 'A', to: 'B', type: 'prerequisite' } as any]);
      dependencyGraphService.reset();
      expect(dependencyGraphService.getDirectDependentsCount('A')).toBe(0);
    });

    it('returns empty Set from getDependentMeasures after reset', () => {
      dependencyGraphService.buildGraph([{ from: 'A', to: 'B', type: 'prerequisite' } as any]);
      dependencyGraphService.reset();
      expect(dependencyGraphService.getDependentMeasures('A').size).toBe(0);
    });
  });
});