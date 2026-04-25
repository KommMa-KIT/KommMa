/**
 * IndividualisationDetailPopup.test.tsx
 *
 * Fix: capturedTooltipContent war null weil Recharts Tooltip content als
 * React.ReactElement rendert, nicht als plain function.
 * Lösung: CustomTooltip wird direkt über getByText/queryByText im DOM getestet,
 * da die Komponente es intern als JSX rendert.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import IndividualisationDetailPopup from '../../components/results/IndividualisationDetailPopup';

// ---------------------------------------------------------------------------
// Mocks — Recharts: Tooltip content als JSX rendern (aktiver Zustand simulieren)
// ---------------------------------------------------------------------------

jest.mock('recharts', () => {
  return {
    Radar:               ({ name }: any) => <div data-testid="radar" data-name={name} />,
    RadarChart:          ({ children }: any) => <div data-testid="radar-chart">{children}</div>,
    PolarGrid:           () => <div data-testid="polar-grid" />,
    PolarAngleAxis:      ({ dataKey }: any) => <div data-testid="polar-angle" data-key={dataKey} />,
    PolarRadiusAxis:     ({ tickFormatter }: any) => {
      const formatted = tickFormatter?.(50);
      return <div data-testid="polar-radius" data-formatted={formatted} />;
    },
    ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
    // Tooltip: content als React.ReactElement direkt rendern mit aktiven Testdaten
    Tooltip: ({ content }: any) => {
      const R = require('react');
      if (!content) return <div data-testid="tooltip" />;
      const tooltipEl = R.cloneElement(content, {
        active: true,
        payload: [{ value: 60, payload: { category: 'Test' } }],
      });
      return <div data-testid="tooltip">{tooltipEl}</div>;
    },
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LEVELS = {
  general:  0.8,   // 80% → green
  energy:   0.5,   // 50% → amber
  mobility: 0.3,   // 30% → red
  water:    0.75,  // 75% → green
  total:    0.6,   // 60% → amber
};

function renderPopup(open = true, levels = LEVELS) {
  const onOpenChange = jest.fn();
  render(
    <IndividualisationDetailPopup
      open={open}
      onOpenChange={onOpenChange}
      levels={levels}
    />
  );
  return { onOpenChange };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IndividualisationDetailPopup', () => {

  // --- Visibility -----------------------------------------------------------

  it('renders nothing when open=false', () => {
    renderPopup(false);
    expect(screen.queryByText('Individualisierungsgrad - Details')).not.toBeInTheDocument();
  });

  it('renders dialog when open=true', () => {
    renderPopup();
    expect(screen.getByText('Individualisierungsgrad - Details')).toBeInTheDocument();
  });

  // --- Overall score --------------------------------------------------------

  it('renders "Gesamt-Individualisierung" label', () => {
    renderPopup();
    expect(screen.getByText('Gesamt-Individualisierung')).toBeInTheDocument();
  });

  // --- Category legend grid -------------------------------------------------

  it('renders all four category labels in the legend', () => {
    renderPopup();
    ['Allgemein', 'Energie', 'Mobilität', 'Wasser'].forEach(label => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('renders correct percentages for each category', () => {
    renderPopup();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  // --- Colour helpers -------------------------------------------------------

  it('uses green bg for total score >= 70', () => {
    renderPopup(true, { ...LEVELS, total: 0.75 });
    expect(document.querySelector('.bg-green-50')).not.toBeNull();
  });

  it('uses amber bg for total score in [40, 70)', () => {
    renderPopup(true, { ...LEVELS, total: 0.55 });
    expect(document.querySelector('.bg-amber-50')).not.toBeNull();
  });

  it('uses red bg for total score < 40', () => {
    renderPopup(true, { ...LEVELS, total: 0.2 });
    expect(document.querySelector('.bg-red-50')).not.toBeNull();
  });

  it('uses green text for total score >= 70', () => {
    renderPopup(true, { ...LEVELS, total: 0.75 });
    expect(document.querySelector('.text-green-600')).not.toBeNull();
  });

  it('uses amber text for total score in [40, 70)', () => {
    renderPopup(true, { ...LEVELS, total: 0.55 });
    expect(document.querySelector('.text-amber-600')).not.toBeNull();
  });

  it('uses red text for total score < 40', () => {
    renderPopup(true, { ...LEVELS, total: 0.2 });
    expect(document.querySelector('.text-red-600')).not.toBeNull();
  });

  // --- Radar chart ----------------------------------------------------------

  it('renders ResponsiveContainer', () => {
    renderPopup();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('renders RadarChart', () => {
    renderPopup();
    expect(screen.getByTestId('radar-chart')).toBeInTheDocument();
  });

  it('renders Radar with name="Individualisierung"', () => {
    renderPopup();
    expect(screen.getByTestId('radar')).toHaveAttribute('data-name', 'Individualisierung');
  });

  it('PolarAngleAxis dataKey is "category"', () => {
    renderPopup();
    expect(screen.getByTestId('polar-angle')).toHaveAttribute('data-key', 'category');
  });

  it('PolarRadiusAxis tickFormatter appends %', () => {
    renderPopup();
    expect(screen.getByTestId('polar-radius')).toHaveAttribute('data-formatted', '50%');
  });

  // --- Tooltip rendered via mock -----------------------------------------------
  // Der Tooltip-Mock rendert den content direkt mit aktiven Daten, sodass
  // CustomTooltip im DOM sichtbar ist.

  it('tooltip is rendered in the DOM', () => {
    renderPopup();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
  });

  // --- Close actions --------------------------------------------------------

  it('calls onOpenChange(false) when backdrop clicked', () => {
    const { onOpenChange } = renderPopup();
    const backdrop = document.querySelector('.absolute.inset-0');
    fireEvent.click(backdrop!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) when X button clicked', () => {
    const { onOpenChange } = renderPopup();
    const buttons = screen.getAllByRole('button');
    const xBtn = buttons.find(b => b.className.includes('rounded-full'));
    fireEvent.click(xBtn!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) when Schließen button clicked', () => {
    const { onOpenChange } = renderPopup();
    fireEvent.click(screen.getByText('Schließen'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // --- Hint -----------------------------------------------------------------

  it('renders explanatory hint text', () => {
    renderPopup();
    expect(screen.getByText(/Je höher der Individualisierungsgrad/)).toBeInTheDocument();
  });

  it('renders "Aufschlüsselung nach Kategorien" heading', () => {
    renderPopup();
    expect(screen.getByText('Aufschlüsselung nach Kategorien')).toBeInTheDocument();
  });

  // --- Basierend auf Angaben ------------------------------------------------

  it('renders description text below overall score', () => {
    renderPopup();
    expect(screen.getByText(/Basierend auf der Anzahl/)).toBeInTheDocument();
  });
});