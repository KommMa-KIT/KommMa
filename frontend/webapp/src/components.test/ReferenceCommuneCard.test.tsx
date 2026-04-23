/**
 * ReferenceCommuneCard.test.tsx
 *
 * Tests for ReferenceCommuneCard – display data and selection callback.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import ReferenceCommuneCard from '../components/ReferenceCommuneCard';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const commune = {
  id: 'ref-1',
  name: 'Musterstadt',
  population: 12345,
  description: 'Eine schöne Modellkommune für Tests.',
};

const smallCommune = {
  id: 'ref-2',
  name: 'Kleinort',
  population: 999,
  description: 'Sehr kleine Gemeinde.',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReferenceCommuneCard', () => {
  // --- Content rendering ---

  it('renders the commune name', () => {
    render(<ReferenceCommuneCard commune={commune} onSelect={jest.fn()} />);
    expect(screen.getByText('Musterstadt')).toBeDefined();
  });

  it('renders the commune description', () => {
    render(<ReferenceCommuneCard commune={commune} onSelect={jest.fn()} />);
    expect(screen.getByText('Eine schöne Modellkommune für Tests.')).toBeDefined();
  });

  it('formats population in de-DE locale (period as thousands separator)', () => {
    render(<ReferenceCommuneCard commune={commune} onSelect={jest.fn()} />);
    // 12345 → "12.345" in de-DE
    expect(screen.getByText(/12\.345 Einwohner/)).toBeDefined();
  });

  it('formats small population without thousands separator', () => {
    render(<ReferenceCommuneCard commune={smallCommune} onSelect={jest.fn()} />);
    expect(screen.getByText(/999 Einwohner/)).toBeDefined();
  });

  it('renders the "Mit dieser Kommune starten" button', () => {
    render(<ReferenceCommuneCard commune={commune} onSelect={jest.fn()} />);
    expect(screen.getByRole('button', { name: /Mit dieser Kommune starten/ })).toBeDefined();
  });

  // --- Interaction ---

  it('calls onSelect when the button is clicked', () => {
    const onSelect = jest.fn();
    render(<ReferenceCommuneCard commune={commune} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Mit dieser Kommune starten/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('calls onSelect when the button is clicked', () => {
    const onSelect = jest.fn();
    render(<ReferenceCommuneCard commune={commune} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('does not throw when onSelect is invoked multiple times', () => {
    const onSelect = jest.fn();
    render(<ReferenceCommuneCard commune={commune} onSelect={onSelect} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  // --- Layout ---

  it('renders inside a card container', () => {
    const { container } = render(
      <ReferenceCommuneCard commune={commune} onSelect={jest.fn()} />
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('rounded-lg');
  });
});