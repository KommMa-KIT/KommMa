import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';

import Navbar from '../components/Navbar';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function makeStore(measureResults: any = null) {
  return configureStore({
    reducer: {
      results: (
        state = {
          measureResults,
        }
      ) => state,
    },
  });
}

function renderNavbar(measureResults: any = null) {
  const store = makeStore(measureResults);

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
      </MemoryRouter>
    </Provider>
  );
}

describe('Navbar', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders the Startseite link', () => {
    renderNavbar();
    expect(screen.getByText('Startseite')).toBeInTheDocument();
  });

  it('renders the Maßnahmen link', () => {
    renderNavbar();
    expect(screen.getByText('Maßnahmen')).toBeInTheDocument();
  });

  it('renders the Dateneingabe link', () => {
    renderNavbar();
    expect(screen.getByText('Dateneingabe')).toBeInTheDocument();
  });

  it('renders Ergebnis as a disabled span when no result is available', () => {
    renderNavbar();
    const resultText = screen.getByText('Ergebnis');
    expect(resultText.tagName).toBe('SPAN');
  });

  it('disabled Ergebnis span has cursor-not-allowed class', () => {
    renderNavbar();
    expect(screen.getByText('Ergebnis')).toHaveClass('cursor-not-allowed');
  });

  it('disabled Ergebnis span carries an explanatory title attribute', () => {
    renderNavbar();
    expect(screen.getByText('Ergebnis')).toHaveAttribute(
      'title',
      'Diese Seite ist erst verfügbar, nachdem eine Berechnung durchgeführt wurde.'
    );
  });

  it('does not render an Ergebnis link when no result is available', () => {
    renderNavbar();
    expect(screen.queryByRole('link', { name: 'Ergebnis' })).not.toBeInTheDocument();
  });

  it('renders Ergebnis as a NavLink when a result is available', () => {
    renderNavbar({ some: 'result' });
    expect(screen.getByRole('link', { name: 'Ergebnis' })).toBeInTheDocument();
  });

  it('does not render Ergebnis as a disabled span when a result is available', () => {
    renderNavbar({ some: 'result' });
    const resultLink = screen.getByRole('link', { name: 'Ergebnis' });
    expect(resultLink.tagName).toBe('A');
  });

  it('renders the KIT logo image', () => {
    renderNavbar();
    expect(screen.getByAltText('Logo')).toBeInTheDocument();
  });

  it('navigates to / when the logo is clicked', () => {
    renderNavbar();
    fireEvent.click(screen.getByAltText('Logo'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('renders a sticky nav element', () => {
    const { container } = renderNavbar();
    const nav = container.querySelector('nav');
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveClass('sticky');
  });
});