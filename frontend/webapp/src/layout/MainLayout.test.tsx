/**
 * MainLayout.test.tsx
 *
 * Tests for MainLayout – verifies Navbar rendering and all footer links.
 */

import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import graphReducer from '../store/GraphSlice';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('./Navbar', () => ({
  __esModule: true,
  default: () => <nav data-testid="navbar" />,
}));

jest.mock('../services/GraphService', () => ({
  __esModule: true, default: { fetchGraph: jest.fn().mockResolvedValue([]) },
}));

// ─── Import ───────────────────────────────────────────────────────────────────

import MainLayout from './MainLayout';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderLayout() {
  return render(
    <Provider store={configureStore({
      reducer: { graph: graphReducer },
      preloadedState: { graph: { edges: [], status: 'succeeded', error: null } },
    })}>
      <MemoryRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<p>Routeninhalt</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MainLayout', () => {
  beforeEach(() => jest.spyOn(window, 'scrollTo').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());
  it('renders the Navbar', () => {
    renderLayout();
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
  });

  it('renders the Datenschutz link pointing to /privacy_policy', () => {
    renderLayout();
    const link = screen.getByRole('link', { name: 'Datenschutz' });
    expect(link.getAttribute('href')).toBe('/privacy_policy');
  });

  it('renders the external Impressum link', () => {
    renderLayout();
    const link = screen.getByRole('link', { name: 'Impressum' });
    expect(link).toHaveAttribute('href', 'https://www.kommma-im-klimaschutz.de/impressum.php');
  });

  it('renders the external KIT link pointing to https://www.kit.edu', () => {
    renderLayout();
    const link = screen.getByRole('link', { name: 'KIT' });
    expect(link.getAttribute('href')).toBe('https://www.kit.edu');
  });

  it('renders the KIT footer attribution text', () => {
    renderLayout();
    expect(screen.getByText(/KIT - Die Forschungsuniversität/)).toBeInTheDocument();
  });

  it('renders a <main> element as content outlet', () => {
    renderLayout();
    expect(screen.getByRole('main')).toHaveTextContent('Routeninhalt');
  });

  it('renders a <footer> element', () => {
    renderLayout();
    expect(document.querySelector('footer')).toBeInTheDocument();
  });

  it('footer has dark background class', () => {
    renderLayout();
    const footer = document.querySelector('footer') as HTMLElement;
    expect(footer.className).toContain('bg-black');
  });
});