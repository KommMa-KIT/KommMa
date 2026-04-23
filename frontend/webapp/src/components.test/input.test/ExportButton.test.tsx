/**
 * ExportButton.test.tsx
 *
 * Tests for ExportButton – disabled/enabled state, tooltip titles,
 * downloadCurrent delegation, and error alert.
 */

import { render, screen, fireEvent } from '@testing-library/react';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../../services/SaveService', () => ({
  __esModule: true,
  default: {
    hasData: jest.fn(),
    downloadCurrent: jest.fn(),
  },
}));

// ─── Import ───────────────────────────────────────────────────────────────────

import ExportButton from '../../components/input/ExportButton';
import SaveService from '../../services/SaveService';

const mockHasData = SaveService.hasData as jest.Mock;
const mockDownloadCurrent = SaveService.downloadCurrent as jest.Mock;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExportButton', () => {
  beforeEach(() => {
    mockHasData.mockReset();
    mockDownloadCurrent.mockReset();
  });

  // --- Rendering ---

  it('renders a button', () => {
    mockHasData.mockReturnValue(false);
    render(<ExportButton />);
    expect(screen.getByRole('button')).toBeDefined();
  });

  it('renders the label text', () => {
    mockHasData.mockReturnValue(true);
    render(<ExportButton />);
    expect(screen.getByText('Eingabe lokal speichern')).toBeDefined();
  });

  // --- Disabled state (no data) ---

  it('is disabled when hasData returns false', () => {
    mockHasData.mockReturnValue(false);
    render(<ExportButton />);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows "Keine Daten zum Exportieren" as title when no data', () => {
    mockHasData.mockReturnValue(false);
    render(<ExportButton />);
    expect(screen.getByRole('button').getAttribute('title')).toBe('Keine Daten zum Exportieren');
  });

  it('does not call downloadCurrent when disabled and clicked', () => {
    mockHasData.mockReturnValue(false);
    render(<ExportButton />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockDownloadCurrent).not.toHaveBeenCalled();
  });

  // --- Enabled state (has data) ---

  it('is enabled when hasData returns true', () => {
    mockHasData.mockReturnValue(true);
    render(<ExportButton />);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows "Eingaben exportieren" as title when data is available', () => {
    mockHasData.mockReturnValue(true);
    render(<ExportButton />);
    expect(screen.getByRole('button').getAttribute('title')).toBe('Eingaben exportieren');
  });

  it('calls downloadCurrent when clicked and data is available', () => {
    mockHasData.mockReturnValue(true);
    render(<ExportButton />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockDownloadCurrent).toHaveBeenCalledTimes(1);
  });

  // --- Error handling ---

  it('shows an alert when downloadCurrent throws', () => {
    mockHasData.mockReturnValue(true);
    mockDownloadCurrent.mockImplementation(() => {
      throw new Error('Disk full');
    });
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<ExportButton />);
    fireEvent.click(screen.getByRole('button'));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    alertSpy.mockRestore();
  });

  it('logs the error to console when downloadCurrent throws', () => {
    mockHasData.mockReturnValue(true);
    const err = new Error('Disk full');
    mockDownloadCurrent.mockImplementation(() => { throw err; });
    jest.spyOn(window, 'alert').mockImplementation(() => {});
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<ExportButton />);
    fireEvent.click(screen.getByRole('button'));

    expect(consoleSpy).toHaveBeenCalledWith('Export failed:', err);
    consoleSpy.mockRestore();
  });

  // --- Layout ---

  it('is fixed-positioned', () => {
    mockHasData.mockReturnValue(false);
    render(<ExportButton />);
    expect(screen.getByRole('button').className).toContain('fixed');
  });
});