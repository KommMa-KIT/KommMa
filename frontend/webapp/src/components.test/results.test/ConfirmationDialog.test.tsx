/**
 * ConfirmationDialog.test.tsx
 *
 * Tests for ConfirmationDialog covering:
 *  - Returns null when open=false
 *  - Renders title, message, confirm and cancel buttons when open=true
 *  - Custom confirmText / cancelText
 *  - Default confirmText="Fortfahren" and cancelText="Abbrechen"
 *  - Backdrop click calls onOpenChange(false)
 *  - Close-X button calls onOpenChange(false)
 *  - Cancel button calls onOpenChange(false)
 *  - Confirm button calls onConfirm() AND onOpenChange(false)
 *  - whitespace-pre-line message (multi-line via \n)
 */

import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmationDialog from '../../components/results/ConfirmationDialog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Props {
  open?:         boolean;
  onOpenChange?: jest.Mock;
  onConfirm?:    jest.Mock;
  title?:        string;
  message?:      string;
  confirmText?:  string;
  cancelText?:   string;
}

function renderDialog(overrides: Props = {}) {
  const props = {
    open:         true,
    onOpenChange: jest.fn(),
    onConfirm:    jest.fn(),
    title:        'Aktion bestätigen',
    message:      'Möchten Sie fortfahren?',
    ...overrides,
  };
  render(<ConfirmationDialog {...props} />);
  return props;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConfirmationDialog', () => {

  // --- Visibility -----------------------------------------------------------

  it('renders nothing when open=false', () => {
    renderDialog({ open: false });
    expect(screen.queryByText('Aktion bestätigen')).not.toBeInTheDocument();
  });

  it('renders dialog content when open=true', () => {
    renderDialog();
    expect(screen.getByText('Aktion bestätigen')).toBeInTheDocument();
  });

  // --- Content --------------------------------------------------------------

  it('renders the title', () => {
    renderDialog({ title: 'Mein Titel' });
    expect(screen.getByText('Mein Titel')).toBeInTheDocument();
  });

  it('renders the message', () => {
    renderDialog({ message: 'Bitte bestätigen Sie.' });
    expect(screen.getByText('Bitte bestätigen Sie.')).toBeInTheDocument();
  });

  it('renders multi-line message (whitespace-pre-line)', () => {
    renderDialog({ message: 'Zeile 1\nZeile 2' });
    const p = screen.getByText(/Zeile 1/);
    expect(p.className).toContain('whitespace-pre-line');
  });

  // --- Default button labels ------------------------------------------------

  it('renders default confirmText "Fortfahren"', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'Fortfahren' })).toBeInTheDocument();
  });

  it('renders default cancelText "Abbrechen"', () => {
    renderDialog();
    // There are two "Abbrechen" buttons (X close + Cancel), find the footer one
    const cancelBtns = screen.getAllByRole('button', { name: 'Abbrechen' });
    expect(cancelBtns.length).toBeGreaterThanOrEqual(1);
  });

  // --- Custom button labels -------------------------------------------------

  it('renders custom confirmText', () => {
    renderDialog({ confirmText: 'Ja, löschen' });
    expect(screen.getByRole('button', { name: 'Ja, löschen' })).toBeInTheDocument();
  });

  it('renders custom cancelText', () => {
    renderDialog({ cancelText: 'Nein' });
    expect(screen.getByRole('button', { name: 'Nein' })).toBeInTheDocument();
  });

  // --- Backdrop click -------------------------------------------------------

  it('calls onOpenChange(false) when backdrop is clicked', () => {
    const { onOpenChange } = renderDialog();
    // The backdrop is the first absolute-positioned div
    const backdrop = document.querySelector('.absolute.inset-0');
    fireEvent.click(backdrop!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // --- Close (X) button -----------------------------------------------------

  it('calls onOpenChange(false) when X button is clicked', () => {
    const { onOpenChange } = renderDialog();
    // The X button is inside the header next to the title
    const buttons = screen.getAllByRole('button');
    // X close button is the one with the X icon (first button in header)
    const xBtn = buttons.find(b => b.querySelector('svg'));
    fireEvent.click(xBtn!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // --- Cancel button --------------------------------------------------------

  it('calls onOpenChange(false) when cancel button is clicked', () => {
    const { onOpenChange } = renderDialog({ cancelText: 'Abbrechen' });
    const cancelBtns = screen.getAllByRole('button', { name: 'Abbrechen' });
    // Click the last one (footer cancel)
    fireEvent.click(cancelBtns[cancelBtns.length - 1]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does NOT call onConfirm when cancel button is clicked', () => {
    const { onConfirm } = renderDialog({ cancelText: 'Abbrechen' });
    const cancelBtns = screen.getAllByRole('button', { name: 'Abbrechen' });
    fireEvent.click(cancelBtns[cancelBtns.length - 1]);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // --- Confirm button -------------------------------------------------------

  it('calls onConfirm when confirm button is clicked', () => {
    const { onConfirm } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Fortfahren' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenChange(false) when confirm button is clicked', () => {
    const { onOpenChange } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Fortfahren' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onConfirm before closing', () => {
    const callOrder: string[] = [];
    const onConfirm    = jest.fn(() => callOrder.push('confirm'));
    const onOpenChange = jest.fn(() => callOrder.push('close'));
    renderDialog({ onConfirm, onOpenChange });
    fireEvent.click(screen.getByRole('button', { name: 'Fortfahren' }));
    expect(callOrder).toEqual(['confirm', 'close']);
  });

  // --- Warning icon ---------------------------------------------------------

  it('renders warning icon in header', () => {
    renderDialog();
    // AlertTriangle SVG is inside the header
    const header = document.querySelector('.border-b');
    expect(header?.querySelector('svg')).not.toBeNull();
  });
});