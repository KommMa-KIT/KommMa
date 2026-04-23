/**
 * Tooltip.tsx
 *
 * Thin styled wrappers around Radix UI's Tooltip primitives, re-exported under
 * shorter names for convenience. TooltipProvider, Tooltip, and TooltipTrigger
 * are passed through unchanged; only TooltipContent receives custom styling
 * (dark background, small text, entry animation) via a forwarded-ref wrapper.
 *
 * Usage requires TooltipProvider to wrap the component tree (or at least the
 * relevant subtree) — Radix UI uses it to manage shared tooltip delay timing.
 */

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import clsx from 'clsx';

// --- Primitive re-exports ---

/** Provides shared delay and open/close timing context for all nested tooltips. */
const TooltipProvider = TooltipPrimitive.Provider;

/** The root state container for a single tooltip instance. */
const Tooltip = TooltipPrimitive.Root;

/** Wraps the element that triggers the tooltip on hover or focus. */
const TooltipTrigger = TooltipPrimitive.Trigger;

// --- Styled content ---

/**
 * TooltipContent
 *
 * A forwarded-ref wrapper around Radix UI's TooltipPrimitive.Content that
 * applies the application's tooltip visual style: dark rounded pill, small
 * white text, subtle drop shadow, and a fade-in + zoom-in entry animation.
 *
 * sideOffset defaults to 4 px to keep the tooltip from sitting flush against
 * its trigger element. Additional className values are merged via clsx so
 * consumers can extend or override styles as needed.
 */
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={clsx(
      'z-50 overflow-hidden rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white shadow-md animate-in fade-in-0 zoom-in-95',
      className
    )}
    {...props}
  />
));

/** Mirrors the Radix displayName so the component is identifiable in React DevTools. */
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };