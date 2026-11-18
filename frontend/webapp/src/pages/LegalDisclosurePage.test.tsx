/**
 * LegalDisclosurePage.test.tsx
 *
 * Tests for LegalDisclosurePage – verifies all static sections are rendered.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LegalDisclosurePage from './LegalDisclosurePage';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter>
      <LegalDisclosurePage />
    </MemoryRouter>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LegalDisclosurePage', () => {
  it('renders the Impressum heading', () => {
    renderPage();
    expect(screen.getByText('Impressum')).toBeInTheDocument();
  });

  it('renders § 5 TMG reference', () => {
    renderPage();
    expect(screen.getByText(/§ 5 TMG/)).toBeInTheDocument();
  });

  it('renders KIT as the operator name', () => {
    renderPage();
    expect(screen.getByText(/Karlsruher Institut für Technologie/)).toBeInTheDocument();
  });

  it('renders the postal address', () => {
    renderPage();
    expect(screen.getByText(/Kaiserstraße 12/)).toBeInTheDocument();
    expect(screen.getByText(/76131 Karlsruhe/)).toBeInTheDocument();
  });

  it('renders the Betreiber section heading', () => {
    renderPage();
    expect(screen.getByText('Betreiber')).toBeInTheDocument();
  });

  it('renders the Kontakt section heading', () => {
    renderPage();
    expect(screen.getByText('Kontakt')).toBeInTheDocument();
  });

  it('renders the contact email link', () => {
    renderPage();
    const link = screen.getByRole('link', { name: /email@kit\.edu/ });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toBe('mailto:email@kit.edu');
  });

  it('renders the phone number', () => {
    renderPage();
    expect(screen.getByText(/\+49 721 608-0/)).toBeInTheDocument();
  });

  it('renders KommMa project info', () => {
    renderPage();
    expect(screen.getByText(/KommMa/)).toBeInTheDocument();
  });

  it('renders the Digitales Planungstool description', () => {
    renderPage();
    expect(screen.getByText(/Digitales Planungstool/)).toBeInTheDocument();
  });
});