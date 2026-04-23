/**
 * Button.tsx
 *
 * A theme-consistent button primitive built on top of class-variance-authority
 * (CVA) and Radix UI's Slot. Supports five visual variants and four sizes,
 * all composable via props. When asChild is true, the button's styles are
 * applied to the first child element via Slot rather than rendering a <button>,
 * enabling use with custom elements such as router Link components.
 */

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';

// --- Variants ---

/**
 * CVA variant definition for the Button component.
 *
 * Base classes apply to every variant: flex layout, rounded corners, font
 * weight, transition, focus ring, and disabled state handling.
 *
 * Variants:
 *  - default     — primary green action button.
 *  - secondary   — muted zinc background for secondary actions.
 *  - outline     — bordered, transparent background.
 *  - ghost       — no background until hovered.
 *  - destructive — red background for irreversible actions.
 *
 * Sizes:
 *  - sm   — compact height (h-8) for dense UIs.
 *  - md   — standard height (h-9), used as default.
 *  - lg   — tall height (h-10) for prominent actions.
 *  - icon — square (h-9 × w-9) for icon-only buttons.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:     'bg-green-800 text-white hover:bg-green-800',
        secondary:   'bg-zinc-100 text-green-900 hover:bg-zinc-200',
        outline:     'border border-zinc-200 hover:bg-zinc-100',
        ghost:       'hover:bg-zinc-100',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
      },
      size: {
        sm:   'h-8 px-3 text-xs',
        md:   'h-9 px-4',
        lg:   'h-10 px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size:    'md',
    },
  }
);

// --- Types ---

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * When true, renders the button's styles via Radix UI's Slot onto the first
   * child element instead of a <button> tag. Useful for composing button
   * styles with router Link components or other custom elements.
   */
  asChild?: boolean;
}

// --- Component ---

/**
 * Button
 *
 * A forwarded-ref button that merges CVA variant classes with any additional
 * className passed by the consumer. displayName is set explicitly to ensure
 * the component label is readable in React DevTools.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    /**
     * When asChild is true, Slot merges Button's props (including ref and
     * className) onto its single child element, allowing any element to
     * receive button styling without wrapping it in an extra DOM node.
     */
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        className={clsx(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export default Button;