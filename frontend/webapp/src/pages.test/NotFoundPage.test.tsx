/**
 * NotFoundPage.test.tsx
 *
 * Tests for the 404 NotFoundPage component.
 */

import { render, screen } from '@testing-library/react';
import NotFoundPage from '../pages/NotFoundPage';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('NotFoundPage', () => {
  it('renders a 404 status code', () => {
    render(<NotFoundPage />);
    expect(screen.getByText(/404/)).toBeDefined();
  });

  it('renders the "Seite konnte nicht gefunden werden" message', () => {
    render(<NotFoundPage />);
    expect(screen.getByText(/Seite konnte nicht gefunden werden/)).toBeDefined();
  });

  it('renders the message as a heading', () => {
    render(<NotFoundPage />);
    const heading = screen.getByRole('heading');
    expect(heading.textContent).toContain('404');
  });

  it('renders inside a full-screen container', () => {
    const { container } = render(<NotFoundPage />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('min-h-screen');
  });
});