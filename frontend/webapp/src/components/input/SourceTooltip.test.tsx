/**
 * SourceTooltip.test.tsx
 *
 * Tests for SourceTooltip – button accessibility and tooltip content rendering.
 */

import { render, screen, fireEvent, within } from '@testing-library/react';
import SourceTooltip from './SourceTooltip';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SourceTooltip', () => {
  // --- Button rendering ---

  it('renders the info trigger button', () => {
    render(<SourceTooltip source="Statistisches Bundesamt" />);
    expect(screen.getByRole('button', { name: 'Quellenangabe anzeigen' })).toBeInTheDocument();
  });

  it('button has type="button" to prevent accidental form submission', () => {
    render(<SourceTooltip source="Test Source" />);
    const btn = screen.getByRole('button') as HTMLButtonElement;
    expect(btn.type).toBe('button');
  });

  it('button has the correct aria-label', () => {
    render(<SourceTooltip source="Source A" />);
    expect(screen.getByLabelText('Quellenangabe anzeigen')).toBeInTheDocument();
  });

  it('renders the Info icon inside the button', () => {
    const { container } = render(<SourceTooltip source="Some Source" />);
    // lucide-react renders an SVG inside the button
    expect(container.querySelector('button svg')).toBeInTheDocument();
  });

  // --- Tooltip content ---

  it('shows the source text in the tooltip when the tooltip is open', async () => {
    render(<SourceTooltip source="Mein Datensatz" />);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.focus(screen.getByRole('button', { name: 'Quellenangabe anzeigen' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Quelle: Mein Datensatz');
  });

  // --- Multiple instances ---

  it('renders independently for different sources', () => {
    render(
      <div>
        <SourceTooltip source="Source A" />
        <SourceTooltip source="Source B" />
      </div>
    );
    const buttons = screen.getAllByRole('button', { name: 'Quellenangabe anzeigen' });
    expect(buttons).toHaveLength(2);
    fireEvent.focus(buttons[0]);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Quelle: Source A');
    expect(within(screen.getByRole('tooltip')).queryByText('Quelle: Source B')).not.toBeInTheDocument();
  });

  // --- Style ---

  it('button has the flex-shrink-0 class to maintain stable layout', () => {
    render(<SourceTooltip source="Test" />);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('flex-shrink-0');
  });
});