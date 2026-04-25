/**
 * ExportDialog.test.tsx
 *
 * Tests for ExportDialog covering:
 *  - Returns null when open=false
 *  - Renders when open=true (title, both options)
 *  - Backdrop click closes dialog
 *  - Header X-button closes dialog
 *  - Footer Abbrechen button closes dialog
 *  - PDF button calls onExportPDF and closes dialog
 *  - CSV button calls onExportCSV and closes dialog
 *  - Option descriptions rendered
 */

import { render, screen, fireEvent } from '@testing-library/react';
import ExportDialog from '../../components/results/ExportDialog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderExportDialog(open = true) {
  const onOpenChange = jest.fn();
  const onExportPDF  = jest.fn();
  const onExportCSV  = jest.fn();
  render(
    <ExportDialog
      open={open}
      onOpenChange={onOpenChange}
      onExportPDF={onExportPDF}
      onExportCSV={onExportCSV}
    />
  );
  return { onOpenChange, onExportPDF, onExportCSV };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExportDialog', () => {

  // --- Visibility -----------------------------------------------------------

  it('renders nothing when open=false', () => {
    renderExportDialog(false);
    expect(screen.queryByText('Ergebnisse exportieren')).not.toBeInTheDocument();
  });

  it('renders dialog when open=true', () => {
    renderExportDialog();
    expect(screen.getByText('Ergebnisse exportieren')).toBeInTheDocument();
  });

  // --- Content --------------------------------------------------------------

  it('renders PDF option heading', () => {
    renderExportDialog();
    expect(screen.getByText('PDF-Dokument')).toBeInTheDocument();
  });

  it('renders CSV option heading', () => {
    renderExportDialog();
    expect(screen.getByText('CSV-Tabelle')).toBeInTheDocument();
  });

  it('renders PDF option description', () => {
    renderExportDialog();
    expect(
      screen.getByText('Übersichtlich formatierte Maßnahmen mit allen Details')
    ).toBeInTheDocument();
  });

  it('renders CSV option description', () => {
    renderExportDialog();
    expect(
      screen.getByText('Daten in tabellarischer Form für Excel/Sheets')
    ).toBeInTheDocument();
  });

  it('renders format selection prompt', () => {
    renderExportDialog();
    expect(screen.getByText(/gewünschte Export-Format/)).toBeInTheDocument();
  });

  it('renders Abbrechen button in footer', () => {
    renderExportDialog();
    expect(screen.getByText('Abbrechen')).toBeInTheDocument();
  });

  // --- Backdrop closes dialog -----------------------------------------------

  it('calls onOpenChange(false) when backdrop clicked', () => {
    const { onOpenChange } = renderExportDialog();
    const backdrop = document.querySelector('.absolute.inset-0');
    fireEvent.click(backdrop!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // --- Header X button ------------------------------------------------------

  it('calls onOpenChange(false) when X button clicked', () => {
    const { onOpenChange } = renderExportDialog();
    // X button is in the header (has an SVG child and hover:bg-gray-100)
    const buttons = screen.getAllByRole('button');
    const xBtn = buttons.find(b =>
      b.className.includes('rounded-full') && b.querySelector('svg')
    );
    fireEvent.click(xBtn!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // --- Footer Abbrechen button ----------------------------------------------

  it('calls onOpenChange(false) when Abbrechen clicked', () => {
    const { onOpenChange } = renderExportDialog();
    fireEvent.click(screen.getByText('Abbrechen'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // --- PDF export -----------------------------------------------------------

  it('calls onExportPDF when PDF button clicked', () => {
    const { onExportPDF } = renderExportDialog();
    fireEvent.click(screen.getByText('PDF-Dokument').closest('button')!);
    expect(onExportPDF).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenChange(false) after PDF export', () => {
    const { onOpenChange } = renderExportDialog();
    fireEvent.click(screen.getByText('PDF-Dokument').closest('button')!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onExportPDF before closing', () => {
    const order: string[] = [];
    const onExportPDF  = jest.fn(() => order.push('pdf'));
    const onOpenChange = jest.fn(() => order.push('close'));
    render(
      <ExportDialog
        open={true}
        onOpenChange={onOpenChange}
        onExportPDF={onExportPDF}
        onExportCSV={jest.fn()}
      />
    );
    fireEvent.click(screen.getByText('PDF-Dokument').closest('button')!);
    expect(order).toEqual(['pdf', 'close']);
  });

  // --- CSV export -----------------------------------------------------------

  it('calls onExportCSV when CSV button clicked', () => {
    const { onExportCSV } = renderExportDialog();
    fireEvent.click(screen.getByText('CSV-Tabelle').closest('button')!);
    expect(onExportCSV).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenChange(false) after CSV export', () => {
    const { onOpenChange } = renderExportDialog();
    fireEvent.click(screen.getByText('CSV-Tabelle').closest('button')!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onExportCSV before closing', () => {
    const order: string[] = [];
    const onExportCSV  = jest.fn(() => order.push('csv'));
    const onOpenChange = jest.fn(() => order.push('close'));
    render(
      <ExportDialog
        open={true}
        onOpenChange={onOpenChange}
        onExportPDF={jest.fn()}
        onExportCSV={onExportCSV}
      />
    );
    fireEvent.click(screen.getByText('CSV-Tabelle').closest('button')!);
    expect(order).toEqual(['csv', 'close']);
  });
});