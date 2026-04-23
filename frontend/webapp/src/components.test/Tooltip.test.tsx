/**
 * Tooltip.test.tsx
 *
 * Tests for the Tooltip component exports:
 *  TooltipProvider, Tooltip, TooltipTrigger, TooltipContent.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/Tooltip';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Renders an open tooltip with the given content text and optional className. */
function renderOpenTooltip(contentText: string, contentClassName?: string) {
  return render(
    <TooltipProvider>
      <Tooltip open>
        <TooltipTrigger>Trigger</TooltipTrigger>
        <TooltipContent className={contentClassName}>{contentText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Returns the visible tooltip content container.
 * Radix renders the text twice (visible text + hidden accessible tooltip span),
 * so we select the visible element by class.
 */
function getVisibleTooltipContent(text: string): HTMLElement {
  const matches = screen.getAllByText(text);
  const visible = matches.find(
    (el) =>
      el instanceof HTMLElement &&
      (el.className?.includes('bg-gray-900') ||
        el.parentElement?.className?.includes('bg-gray-900'))
  );

  if (!visible) {
    throw new Error(`Visible tooltip content for "${text}" not found.`);
  }

  return visible.className?.includes('bg-gray-900')
    ? (visible as HTMLElement)
    : (visible.parentElement as HTMLElement);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Tooltip exports', () => {
  it('exports TooltipProvider', () => {
    expect(TooltipProvider).toBeDefined();
  });

  it('exports Tooltip', () => {
    expect(Tooltip).toBeDefined();
  });

  it('exports TooltipTrigger', () => {
    expect(TooltipTrigger).toBeDefined();
  });

  it('exports TooltipContent', () => {
    expect(TooltipContent).toBeDefined();
  });
});

describe('TooltipContent', () => {
  it('has a displayName', () => {
    expect(TooltipContent.displayName).toBeDefined();
  });

  it('renders the tooltip text when open', () => {
    renderOpenTooltip('Tooltip text');
    expect(getVisibleTooltipContent('Tooltip text')).toBeDefined();
  });

  it('applies dark background class', () => {
    renderOpenTooltip('Content');
    expect(getVisibleTooltipContent('Content').className).toContain('bg-gray-900');
  });

  it('applies white text class', () => {
    renderOpenTooltip('Content');
    expect(getVisibleTooltipContent('Content').className).toContain('text-white');
  });

  it('applies small text class', () => {
    renderOpenTooltip('Content');
    expect(getVisibleTooltipContent('Content').className).toContain('text-xs');
  });

  it('applies rounded corners class', () => {
    renderOpenTooltip('Content');
    expect(getVisibleTooltipContent('Content').className).toContain('rounded-md');
  });

  it('merges a custom className with default styles', () => {
    renderOpenTooltip('Content', 'extra-class');
    const content = getVisibleTooltipContent('Content');
    expect(content.className).toContain('extra-class');
    expect(content.className).toContain('bg-gray-900');
  });

  it('forwards ref to the content DOM element', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent ref={ref}>Ref content</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    expect(ref.current).toBeDefined();
  });

  it('does not render when tooltip is closed', () => {
    render(
      <TooltipProvider>
        <Tooltip open={false}>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent>Hidden content</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    expect(screen.queryByText('Hidden content')).toBeNull();
  });
});