/**
 * Button.test.tsx
 *
 * Tests for the Button component – all variants, sizes, props, ref forwarding,
 * and the asChild behaviour.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../components/Button';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Button', () => {
  // --- Default rendering ---

  it('renders a <button> element by default', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toBeDefined();
  });

  it('applies default (green) variant classes', () => {
    render(<Button>Default</Button>);
    expect(screen.getByRole('button').className).toContain('bg-green-800');
  });

  it('applies default md size class', () => {
    render(<Button>Default</Button>);
    expect(screen.getByRole('button').className).toContain('h-9');
  });

  // --- Variants ---

  it('applies secondary variant classes', () => {
    render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button').className).toContain('bg-zinc-100');
  });

  it('applies outline variant classes', () => {
    render(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole('button').className).toContain('border-zinc-200');
  });

  it('applies ghost variant classes', () => {
    render(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole('button').className).toContain('hover:bg-zinc-100');
  });

  it('applies destructive variant classes', () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole('button').className).toContain('bg-red-600');
  });

  // --- Sizes ---

  it('applies sm size class', () => {
    render(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button').className).toContain('h-8');
  });

  it('applies lg size class', () => {
    render(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button').className).toContain('h-10');
  });

  it('applies icon size classes (square)', () => {
    render(<Button size="icon">🔍</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('h-9');
    expect(btn.className).toContain('w-9');
  });

  // --- Props ---

  it('merges custom className with variant classes', () => {
    render(<Button className="custom-class">Btn</Button>);
    expect(screen.getByRole('button').className).toContain('custom-class');
    expect(screen.getByRole('button').className).toContain('bg-green-800');
  });

  it('calls onClick handler when clicked', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when the disabled prop is passed', () => {
    render(<Button disabled>Disabled</Button>);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('does not call onClick when disabled', () => {
    const onClick = jest.fn();
    render(<Button disabled onClick={onClick}>Disabled</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('passes through arbitrary HTML button attributes', () => {
    render(<Button type="submit" aria-label="submit-btn">Submit</Button>);
    const btn = screen.getByRole('button');
    expect((btn as HTMLButtonElement).type).toBe('submit');
    expect(btn.getAttribute('aria-label')).toBe('submit-btn');
  });

  // --- Ref forwarding ---

  it('forwards ref to the underlying <button> element', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeDefined();
    expect(ref.current?.tagName).toBe('BUTTON');
  });

  // --- asChild ---

  it('renders as a child element when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );
    const link = screen.getByRole('link', { name: 'Link Button' });
    expect(link).toBeDefined();
    expect(link.className).toContain('bg-green-800');
  });

  it('does not render a <button> when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link</a>
      </Button>
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  // --- displayName ---

  it('has the displayName "Button"', () => {
    expect(Button.displayName).toBe('Button');
  });
});