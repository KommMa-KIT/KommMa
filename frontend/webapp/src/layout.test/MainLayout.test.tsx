/**
 * MainLayout.test.tsx
 *
 * Tests for MainLayout – verifies Navbar rendering and all footer links.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../../src/components/Navbar', () => ({
  __esModule: true,
  default: () => <nav data-testid="navbar" />,
}));

// ─── Import ───────────────────────────────────────────────────────────────────

import MainLayout from '../../src/layout/MainLayout';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderLayout() {
  return render(
    <MemoryRouter>
      <MainLayout />
    </MemoryRouter>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MainLayout', () => {
  it('renders the Navbar', () => {
    renderLayout();
    expect(screen.getByTestId('navbar')).toBeDefined();
  });

  it('renders the Datenschutz link pointing to /privacy_policy', () => {
    renderLayout();
    const link = screen.getByRole('link', { name: 'Datenschutz' });
    expect(link.getAttribute('href')).toBe('/privacy_policy');
  });

  it('renders the Impressum link pointing to /legal_disclosure', () => {
    renderLayout();
    const link = screen.getByRole('link', { name: 'Impressum' });
    expect(link.getAttribute('href')).toBe('/legal_disclosure');
  });

  it('renders the external KIT link pointing to https://www.kit.edu', () => {
    renderLayout();
    const link = screen.getByRole('link', { name: 'KIT' });
    expect(link.getAttribute('href')).toBe('https://www.kit.edu');
  });

  it('renders the KIT footer attribution text', () => {
    renderLayout();
    expect(screen.getByText(/KIT - Die Forschungsuniversität/)).toBeDefined();
  });

  it('renders a <main> element as content outlet', () => {
    renderLayout();
    expect(document.querySelector('main')).toBeDefined();
  });

  it('renders a <footer> element', () => {
    renderLayout();
    expect(document.querySelector('footer')).toBeDefined();
  });

  it('footer has dark background class', () => {
    renderLayout();
    const footer = document.querySelector('footer') as HTMLElement;
    expect(footer.className).toContain('bg-black');
  });
});