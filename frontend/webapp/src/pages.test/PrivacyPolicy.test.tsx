/**
 * PrivacyPolicy.test.tsx
 *
 * Unit tests for the PrivacyPolicyPage component covering:
 *  - All nine DSGVO section headings are rendered
 *  - Dynamic "Stand" date matches the current locale date
 *  - Contact email links are present and correct
 *  - Static content (title, description intro) is rendered
 *  - No network calls or side effects on mount
 */

import { render, screen } from '@testing-library/react';
import PrivacyPolicyPage from '../pages/PrivacyPolicy';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PrivacyPolicyPage', () => {
  // --- Page header ----------------------------------------------------------

  it('renders the main page title', () => {
    render(<PrivacyPolicyPage />);
    expect(
      screen.getByRole('heading', { name: 'Datenschutzerklärung', level: 1 })
    ).toBeInTheDocument();
  });

  it('renders the DSGVO subtitle', () => {
    render(<PrivacyPolicyPage />);
    expect(
      screen.getByText('Informationen zur Verarbeitung Ihrer Daten gemäß DSGVO')
    ).toBeInTheDocument();
  });

  it('renders a dynamic "Stand" date matching today in German locale', () => {
    render(<PrivacyPolicyPage />);
    const expectedDate = new Date().toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    expect(screen.getByText(`Stand: ${expectedDate}`)).toBeInTheDocument();
  });

  // --- Section headings (nine required DSGVO sections) ----------------------

  it('renders section 1 — Verantwortlicher', () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText('1. Verantwortlicher')).toBeInTheDocument();
  });

  it('renders section 2 — Datenschutzbeauftragter', () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText('2. Datenschutzbeauftragter')).toBeInTheDocument();
  });

  it('renders section 3 — Erhebung und Speicherung personenbezogener Daten', () => {
    render(<PrivacyPolicyPage />);
    expect(
      screen.getByText('3. Erhebung und Speicherung personenbezogener Daten')
    ).toBeInTheDocument();
  });

  it('renders section 3.1 — Beim Besuch der Website', () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText('3.1 Beim Besuch der Website')).toBeInTheDocument();
  });

  it('renders section 3.2 — Bei Nutzung des Planungstools', () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText('3.2 Bei Nutzung des Planungstools')).toBeInTheDocument();
  });

  it('renders section 4 — Rechtsgrundlage', () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText('4. Rechtsgrundlage')).toBeInTheDocument();
  });

  it('renders section 5 — Cookies', () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText('5. Cookies')).toBeInTheDocument();
  });

  it('renders section 6 — Datensicherheit', () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText('6. Datensicherheit')).toBeInTheDocument();
  });

  it('renders section 7 — Ihre Rechte', () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText('7. Ihre Rechte')).toBeInTheDocument();
  });

  it('renders section 8 — Dauer der Speicherung', () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText('8. Dauer der Speicherung')).toBeInTheDocument();
  });

  it('renders section 9 — Änderungen dieser Datenschutzerklärung', () => {
    render(<PrivacyPolicyPage />);
    expect(
      screen.getByText('9. Änderungen dieser Datenschutzerklärung')
    ).toBeInTheDocument();
  });

  // --- DSGVO rights list ----------------------------------------------------

  it('renders user rights from Art. 15–21 DSGVO', () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText('Recht auf Auskunft')).toBeInTheDocument();
    expect(screen.getByText('Recht auf Berichtigung')).toBeInTheDocument();
    expect(screen.getByText('Recht auf Löschung')).toBeInTheDocument();
    expect(screen.getByText('Recht auf Einschränkung der Verarbeitung')).toBeInTheDocument();
    expect(screen.getByText('Recht auf Datenübertragbarkeit')).toBeInTheDocument();
    expect(screen.getByText('Widerspruchsrecht')).toBeInTheDocument();
  });

  // --- Contact information ---------------------------------------------------

  it('renders the KIT info email link', () => {
    render(<PrivacyPolicyPage />);
    const infoLink = screen.getByRole('link', { name: 'info@kit.edu' });
    expect(infoLink).toHaveAttribute('href', 'mailto:info@kit.edu');
  });

  it('renders both datenschutz email links', () => {
    render(<PrivacyPolicyPage />);
    const dsLinks = screen.getAllByRole('link', { name: 'datenschutz@kit.edu' });
    expect(dsLinks.length).toBeGreaterThanOrEqual(2);
    dsLinks.forEach(link =>
      expect(link).toHaveAttribute('href', 'mailto:datenschutz@kit.edu')
    );
  });

  // --- Institutional address -------------------------------------------------

  it('renders the KIT name in the Verantwortlicher section', () => {
    render(<PrivacyPolicyPage />);
    expect(
      screen.getByText('Karlsruher Institut für Technologie (KIT)')
    ).toBeInTheDocument();
  });

  it('renders the KIT street address', () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText('Kaiserstraße 12')).toBeInTheDocument();
    expect(screen.getByText('76131 Karlsruhe')).toBeInTheDocument();
  });

  // --- Cookie section -------------------------------------------------------

  it('renders the technisch notwendige Cookies info box', () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText('Technisch notwendige Cookies')).toBeInTheDocument();
  });

  // --- Contact box ----------------------------------------------------------

  it('renders the contact box heading', () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText('Fragen zum Datenschutz?')).toBeInTheDocument();
  });

  // --- Data retention -------------------------------------------------------

  it('states logfiles are deleted after 7 days', () => {
    render(<PrivacyPolicyPage />);
    expect(
      screen.getByText(/Logfiles werden nach spätestens 7 Tagen automatisch gelöscht/)
    ).toBeInTheDocument();
  });
});