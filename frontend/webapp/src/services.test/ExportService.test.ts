/**
 * ExportService.test.ts
 *
 * Maximale Coverage für ExportService:
 *  - exportCSV:  Header, Rows, BOM, Formatierung, Download-Trigger
 *  - exportPDF:  Alle 3 Tabellen, addPage-Branch, leere Comments, Edges-Filter
 *  - getRelationTypeLabel: alle 5 bekannten Typen + Fallback
 */

import { exportService } from '../services/ExportService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('jspdf-autotable', () => jest.fn());
jest.mock('jspdf', () => jest.fn());

// ─── Helpers ────────────────────────────────────────────────────────────────

const OriginalBlob = global.Blob;

/** Builds a fresh doc mock. Pass finalY to test the addPage branch. */
function buildDocMock(finalY = 80, pageCount = 2) {
  return {
    internal:         { pageSize: { width: 297, height: 210 } },
    setFontSize:      jest.fn(),
    setFont:          jest.fn(),
    setTextColor:     jest.fn(),
    text:             jest.fn(),
    addPage:          jest.fn(),
    getNumberOfPages: jest.fn().mockReturnValue(pageCount),
    save:             jest.fn(),
    lastAutoTable:    { finalY },
  };
}

/** Intercepts the Blob created inside exportCSV and returns its raw string content. */
function captureCSV(fn: () => void): string {
  let captured = '';
  jest.spyOn(global, 'Blob').mockImplementationOnce((parts) => {
    captured = (parts as string[])[0];
    return new OriginalBlob(parts as BlobPart[]);
  });
  fn();
  return captured;
}

/** Creates a fully-populated ranked-measure object; fields can be overridden. */
function item(overrides: Record<string, any> = {}): any {
  const base = {
    rank:                   1,
    time:                   6,
    investmentCost:         10_000,
    ongoingCost:            200,
    totalCost:              10_200,
    onetimeEmissionSavings: 3_000,
    ongoingEmissionSavings: 800,
    measure: {
      id:                'm1',
      title:             'Solaranlage',
      popularity:        'high',
      popularityComment: 'Sehr beliebt',
    },
  };
  if (overrides.measure) {
    overrides.measure = { ...base.measure, ...overrides.measure };
  }
  return { ...base, ...overrides };
}

/** Two-item list with distinct IDs – used for edge tests. */
function twoItems() {
  return [
    item({ rank: 1, measure: { id: 'a', title: 'Solar',    popularity: 'high', popularityComment: '' } }),
    item({ rank: 2, measure: { id: 'b', title: 'Windkraft', popularity: 'low', popularityComment: '' } }),
  ];
}

// ─── Setup ──────────────────────────────────────────────────────────────────

/** Current doc mock – replaced in beforeEach and in individual tests that need custom finalY. */
let docMock: ReturnType<typeof buildDocMock>;

beforeEach(() => {
  jest.clearAllMocks();

  // Re-create the doc mock after clearAllMocks so internal is never undefined
  docMock = buildDocMock();
  (jsPDF as jest.Mock).mockImplementation(() => docMock);

  // DOM mocks for the anchor-click download pattern
  global.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock');
  global.URL.revokeObjectURL = jest.fn();
  const mockLink = { setAttribute: jest.fn(), click: jest.fn(), style: { visibility: '' } };
  jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
  jest.spyOn(document.body, 'appendChild').mockImplementation(jest.fn());
  jest.spyOn(document.body, 'removeChild').mockImplementation(jest.fn());
});

// ═══════════════════════════════════════════════════════════════════════════
// exportCSV
// ═══════════════════════════════════════════════════════════════════════════

describe('exportCSV', () => {

  // ── CSV content ──────────────────────────────────────────────────────────

  it('prepends UTF-8 BOM (\\ufeff)', () => {
    const csv = captureCSV(() => exportService.exportCSV([item()]));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('uses semicolons as column delimiter', () => {
    const csv = captureCSV(() => exportService.exportCSV([item()]));
    const headerLine = csv.split('\n')[0];
    expect(headerLine.split(';').length).toBeGreaterThan(1);
  });

  it('includes all 10 header columns', () => {
    const csv = captureCSV(() => exportService.exportCSV([item()]));
    const cols = [
      'Rang', 'Maßnahme', 'Soziale Akzeptanz', 'Kommentar zur sozialen Akzeptanz',
      'Umsetzungszeit (Monate)', 'Investitionskosten (€)', 'Laufende Kosten (€/Jahr)',
      'Gesamtkosten (€)', 'CO2-Einsparung einmalig (kg)', 'CO2-Einsparung jährlich (kg/Jahr)',
    ];
    cols.forEach((col) => expect(csv).toContain(col));
  });

  it('produces one data row per measure', () => {
    const csv = captureCSV(() => exportService.exportCSV([item({ rank: 1 }), item({ rank: 2 })]));
    const lines = csv.split('\n').filter(Boolean);
    expect(lines).toHaveLength(3); // header + 2 data rows
  });

  it('wraps every cell value in double quotes', () => {
    const csv = captureCSV(() => exportService.exportCSV([item()]));
    const dataLine = csv.split('\n')[1];
    const cells = dataLine.split(';');
    cells.forEach((cell) => expect(cell).toMatch(/^".*"$/));
  });

  it('writes rank correctly', () => {
    const csv = captureCSV(() => exportService.exportCSV([item({ rank: 7 })]));
    expect(csv).toContain('"7"');
  });

  it('writes measure title', () => {
    const csv = captureCSV(() => exportService.exportCSV([item({ measure: { title: 'Windkraft' } })]));
    expect(csv).toContain('"Windkraft"');
  });

  it('writes popularity as-is: "high"', () => {
    const csv = captureCSV(() => exportService.exportCSV([item({ measure: { popularity: 'high' } })]));
    expect(csv).toContain('"high"');
  });

  it('writes popularity as-is: "medium"', () => {
    const csv = captureCSV(() => exportService.exportCSV([item({ measure: { popularity: 'medium' } })]));
    expect(csv).toContain('"medium"');
  });

  it('writes popularity as-is: "low"', () => {
    const csv = captureCSV(() => exportService.exportCSV([item({ measure: { popularity: 'low' } })]));
    expect(csv).toContain('"low"');
  });

  it('substitutes "-" when popularityComment is empty string', () => {
    const csv = captureCSV(() =>
      exportService.exportCSV([item({ measure: { popularityComment: '' } })])
    );
    const commentCell = csv.split('\n')[1].split(';')[3];
    expect(commentCell).toBe('"-"');
  });

  it('writes non-empty popularityComment verbatim', () => {
    const csv = captureCSV(() =>
      exportService.exportCSV([item({ measure: { popularityComment: 'Sehr beliebt' } })])
    );
    expect(csv).toContain('"Sehr beliebt"');
  });

  it('writes time value', () => {
    const csv = captureCSV(() => exportService.exportCSV([item({ time: 12 })]));
    expect(csv).toContain('"12"');
  });

  it('formats investmentCost with de-DE locale (thousands dot)', () => {
    const csv = captureCSV(() => exportService.exportCSV([item({ investmentCost: 10_000 })]));
    expect(csv).toContain('"10.000"');
  });

  it('formats ongoingCost with de-DE locale', () => {
    const csv = captureCSV(() => exportService.exportCSV([item({ ongoingCost: 1_200 })]));
    expect(csv).toContain('"1.200"');
  });

  it('formats totalCost with de-DE locale', () => {
    const csv = captureCSV(() => exportService.exportCSV([item({ totalCost: 50_000 })]));
    expect(csv).toContain('"50.000"');
  });

  it('formats onetimeEmissionSavings with de-DE locale', () => {
    const csv = captureCSV(() => exportService.exportCSV([item({ onetimeEmissionSavings: 2_500 })]));
    expect(csv).toContain('"2.500"');
  });

  it('formats ongoingEmissionSavings with de-DE locale', () => {
    const csv = captureCSV(() => exportService.exportCSV([item({ ongoingEmissionSavings: 1_000 })]));
    expect(csv).toContain('"1.000"');
  });

  // ── Blob & download trigger ───────────────────────────────────────────────

  it('creates a Blob with MIME type text/csv;charset=utf-8', () => {
    const spy = jest.spyOn(global, 'Blob').mockImplementationOnce((parts, opts) => {
      expect(opts?.type).toBe('text/csv;charset=utf-8;');
      return new OriginalBlob(parts as BlobPart[], opts);
    });
    exportService.exportCSV([item()]);
    expect(spy).toHaveBeenCalled();
  });

  it('calls URL.createObjectURL with the Blob', () => {
    exportService.exportCSV([item()]);
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it('creates an <a> element', () => {
    exportService.exportCSV([item()]);
    expect(document.createElement).toHaveBeenCalledWith('a');
  });

  it('sets href attribute to the object URL', () => {
    const mockLink = { setAttribute: jest.fn(), click: jest.fn(), style: { visibility: '' } };
    (document.createElement as jest.Mock).mockReturnValueOnce(mockLink);
    exportService.exportCSV([item()]);
    const hrefCall = mockLink.setAttribute.mock.calls.find(([attr]) => attr === 'href');
    expect(hrefCall?.[1]).toBe('blob:mock');
  });

  it('sets download attribute with correct filename pattern', () => {
    const mockLink = { setAttribute: jest.fn(), click: jest.fn(), style: { visibility: '' } };
    (document.createElement as jest.Mock).mockReturnValueOnce(mockLink);
    exportService.exportCSV([item()]);
    const downloadCall = mockLink.setAttribute.mock.calls.find(([attr]) => attr === 'download');
    expect(downloadCall?.[1]).toMatch(/^klimaschutz-massnahmen_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('sets link visibility to hidden', () => {
    const mockLink = { setAttribute: jest.fn(), click: jest.fn(), style: { visibility: 'visible' } };
    (document.createElement as jest.Mock).mockReturnValueOnce(mockLink);
    exportService.exportCSV([item()]);
    expect(mockLink.style.visibility).toBe('hidden');
  });

  it('appends link to body', () => {
    exportService.exportCSV([item()]);
    expect(document.body.appendChild).toHaveBeenCalled();
  });

  it('calls link.click()', () => {
    const mockLink = { setAttribute: jest.fn(), click: jest.fn(), style: { visibility: '' } };
    (document.createElement as jest.Mock).mockReturnValueOnce(mockLink);
    exportService.exportCSV([item()]);
    expect(mockLink.click).toHaveBeenCalled();
  });

  it('removes link from body after click', () => {
    exportService.exportCSV([item()]);
    expect(document.body.removeChild).toHaveBeenCalled();
  });

  it('does not throw for an empty measures array', () => {
    expect(() => exportService.exportCSV([])).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// exportPDF
// ═══════════════════════════════════════════════════════════════════════════

describe('exportPDF', () => {

  // ── PDF instantiation & document header ──────────────────────────────────

  it('creates jsPDF in landscape A4', () => {
    exportService.exportPDF([item()]);
    expect(jsPDF).toHaveBeenCalledWith('l', 'mm', 'a4');
  });

  it('writes title containing "Klimaschutzmaßnahmen"', () => {
    exportService.exportPDF([item()]);
    const titleCall = docMock.text.mock.calls.find(
      ([txt]) => typeof txt === 'string' && txt.includes('Klimaschutzmaßnahmen'),
    );
    expect(titleCall).toBeDefined();
  });

  it('writes "Erstellt am" date line', () => {
    exportService.exportPDF([item()]);
    const dateCall = docMock.text.mock.calls.find(
      ([txt]) => typeof txt === 'string' && txt.includes('Erstellt am'),
    );
    expect(dateCall).toBeDefined();
  });

  it('writes correct measure count', () => {
    exportService.exportPDF([item(), item({ rank: 2 })]);
    const countCall = docMock.text.mock.calls.find(
      ([txt]) => typeof txt === 'string' && txt.includes('Anzahl Maßnahmen: 2'),
    );
    expect(countCall).toBeDefined();
  });

  it('writes measure count of 0 for empty list', () => {
    exportService.exportPDF([]);
    const countCall = docMock.text.mock.calls.find(
      ([txt]) => typeof txt === 'string' && txt.includes('Anzahl Maßnahmen: 0'),
    );
    expect(countCall).toBeDefined();
  });

  // ── Table 1: main measures ───────────────────────────────────────────────

  it('calls autoTable for the main measures table', () => {
    exportService.exportPDF([item()]);
    expect(autoTable).toHaveBeenCalled();
  });

  it('passes startY=35 to the main table', () => {
    exportService.exportPDF([item()]);
    const firstCall = (autoTable as jest.Mock).mock.calls[0];
    expect(firstCall[1].startY).toBe(35);
  });

  it('main table head row includes "Rang"', () => {
    exportService.exportPDF([item()]);
    const firstCall = (autoTable as jest.Mock).mock.calls[0];
    expect(firstCall[1].head[0]).toContain('Rang');
  });

  it('main table body has one row per measure', () => {
    exportService.exportPDF([item({ rank: 1 }), item({ rank: 2 })]);
    const firstCall = (autoTable as jest.Mock).mock.calls[0];
    expect(firstCall[1].body).toHaveLength(2);
  });

  it('main table body row[0][0] is rank as string', () => {
    exportService.exportPDF([item({ rank: 5 })]);
    expect((autoTable as jest.Mock).mock.calls[0][1].body[0][0]).toBe('5');
  });

  it('main table body row[0][1] is measure title', () => {
    exportService.exportPDF([item()]);
    expect((autoTable as jest.Mock).mock.calls[0][1].body[0][1]).toBe('Solaranlage');
  });

  it('main table body row[0][2] is popularity', () => {
    exportService.exportPDF([item()]);
    expect((autoTable as jest.Mock).mock.calls[0][1].body[0][2]).toBe('high');
  });

  it('main table body row[0][3] is time as string', () => {
    exportService.exportPDF([item({ time: 9 })]);
    expect((autoTable as jest.Mock).mock.calls[0][1].body[0][3]).toBe('9');
  });

  it('main table body investmentCost cell includes "€"', () => {
    exportService.exportPDF([item({ investmentCost: 10_000 })]);
    expect((autoTable as jest.Mock).mock.calls[0][1].body[0][4]).toContain('€');
  });

  it('main table body ongoingCost cell includes "€"', () => {
    exportService.exportPDF([item()]);
    expect((autoTable as jest.Mock).mock.calls[0][1].body[0][5]).toContain('€');
  });

  it('main table body totalCost cell includes "€"', () => {
    exportService.exportPDF([item()]);
    expect((autoTable as jest.Mock).mock.calls[0][1].body[0][6]).toContain('€');
  });

  it('main table body onetimeEmissionSavings cell includes "kg"', () => {
    exportService.exportPDF([item()]);
    expect((autoTable as jest.Mock).mock.calls[0][1].body[0][7]).toContain('kg');
  });

  it('main table body ongoingEmissionSavings cell includes "kg/J"', () => {
    exportService.exportPDF([item()]);
    expect((autoTable as jest.Mock).mock.calls[0][1].body[0][8]).toContain('kg/J');
  });

  it('didDrawPage callback writes page number footer', () => {
    exportService.exportPDF([item()]);
    const { didDrawPage } = (autoTable as jest.Mock).mock.calls[0][1];
    didDrawPage({ pageNumber: 1 });
    const footerCall = docMock.text.mock.calls.find(
      ([txt]) => typeof txt === 'string' && txt.includes('Seite'),
    );
    expect(footerCall).toBeDefined();
  });

  it('didDrawPage uses getNumberOfPages() in footer text', () => {
    exportService.exportPDF([item()]);
    const { didDrawPage } = (autoTable as jest.Mock).mock.calls[0][1];
    didDrawPage({ pageNumber: 1 });
    const footerCall = docMock.text.mock.calls.find(
      ([txt]) => typeof txt === 'string' && txt.includes('von 2'),
    );
    expect(footerCall).toBeDefined();
  });

  // ── Table 2: comments ────────────────────────────────────────────────────

  it('renders comments section heading', () => {
    exportService.exportPDF([item()]);
    const headingCall = docMock.text.mock.calls.find(
      ([txt]) => typeof txt === 'string' && txt.includes('Kommentare zur sozialen Akzeptanz'),
    );
    expect(headingCall).toBeDefined();
  });

  it('calls autoTable for comments when popularityComment is non-empty', () => {
    exportService.exportPDF([item()]);
    const commentsTable = (autoTable as jest.Mock).mock.calls.find(
      ([, opts]) => opts.head?.[0]?.includes('Kommentar'),
    );
    expect(commentsTable).toBeDefined();
  });

  it('comments table body contains the comment text', () => {
    exportService.exportPDF([item()]);
    const commentsTable = (autoTable as jest.Mock).mock.calls.find(
      ([, opts]) => opts.head?.[0]?.includes('Kommentar'),
    );
    expect(commentsTable?.[1].body[0][2]).toBe('Sehr beliebt');
  });

  it('filters measures with blank popularityComment out of comments table', () => {
    exportService.exportPDF([
      item({ rank: 1, measure: { popularityComment: 'Gut' } }),
      item({ rank: 2, measure: { popularityComment: '   ' } }),
    ]);
    const commentsTable = (autoTable as jest.Mock).mock.calls.find(
      ([, opts]) => opts.head?.[0]?.includes('Kommentar'),
    );
    expect(commentsTable?.[1].body).toHaveLength(1);
  });

  it('shows "Keine Kommentare vorhanden." when all popularityComments are empty', () => {
    exportService.exportPDF([item({ measure: { popularityComment: '' } })]);
    const noCommentText = docMock.text.mock.calls.find(
      ([txt]) => typeof txt === 'string' && txt.includes('Keine Kommentare vorhanden'),
    );
    expect(noCommentText).toBeDefined();
  });

  it('does NOT call autoTable for comments when no comments exist', () => {
    exportService.exportPDF([item({ measure: { popularityComment: '' } })]);
    const commentsTable = (autoTable as jest.Mock).mock.calls.find(
      ([, opts]) => opts.head?.[0]?.includes('Kommentar'),
    );
    expect(commentsTable).toBeUndefined();
  });

  // ── addPage branch ───────────────────────────────────────────────────────

  it('calls doc.addPage() when comments section would overflow the page', () => {
    // currentY = finalY + 15; overflow when currentY > height(210) - 40 → finalY > 155
    docMock = buildDocMock(160);
    (jsPDF as jest.Mock).mockImplementation(() => docMock);
    exportService.exportPDF([item()]);
    expect(docMock.addPage).toHaveBeenCalled();
  });

  it('does NOT call doc.addPage() when finalY leaves enough room', () => {
    docMock = buildDocMock(50);
    (jsPDF as jest.Mock).mockImplementation(() => docMock);
    exportService.exportPDF([item()]);
    expect(docMock.addPage).not.toHaveBeenCalled();
  });

  // ── Table 3: edges ───────────────────────────────────────────────────────

  it('does NOT render edges table when edges is undefined', () => {
    exportService.exportPDF([item()]);
    const edgesTable = (autoTable as jest.Mock).mock.calls.find(
      ([, opts]) => opts.head?.[0]?.includes('Maßnahme (von)'),
    );
    expect(edgesTable).toBeUndefined();
  });

  it('does NOT render edges table when edges array is empty', () => {
    exportService.exportPDF([item()], []);
    const edgesTable = (autoTable as jest.Mock).mock.calls.find(
      ([, opts]) => opts.head?.[0]?.includes('Maßnahme (von)'),
    );
    expect(edgesTable).toBeUndefined();
  });

  it('does NOT render edges table when both edge endpoints are missing from measures', () => {
    exportService.exportPDF([item()], [{ from: 'x', to: 'y', type: 'synergy' }] as any);
    const edgesTable = (autoTable as jest.Mock).mock.calls.find(
      ([, opts]) => opts.head?.[0]?.includes('Maßnahme (von)'),
    );
    expect(edgesTable).toBeUndefined();
  });

  it('does NOT render edges table when only "from" endpoint is in measures list', () => {
    exportService.exportPDF([item()], [{ from: 'm1', to: 'missing', type: 'conflict' }] as any);
    const edgesTable = (autoTable as jest.Mock).mock.calls.find(
      ([, opts]) => opts.head?.[0]?.includes('Maßnahme (von)'),
    );
    expect(edgesTable).toBeUndefined();
  });

  it('renders edges table when both endpoints are in measures list', () => {
    exportService.exportPDF(twoItems(), [{ from: 'a', to: 'b', type: 'synergy' }] as any);
    const edgesTable = (autoTable as jest.Mock).mock.calls.find(
      ([, opts]) => opts.head?.[0]?.includes('Maßnahme (von)'),
    );
    expect(edgesTable).toBeDefined();
  });

  it('edges table body row contains correct "from" title', () => {
    exportService.exportPDF(twoItems(), [{ from: 'a', to: 'b', type: 'synergy' }] as any);
    const edgesTable = (autoTable as jest.Mock).mock.calls.find(
      ([, opts]) => opts.head?.[0]?.includes('Maßnahme (von)'),
    );
    expect(edgesTable?.[1].body[0][1]).toBe('Solar');
  });

  it('edges table body row contains correct "to" title', () => {
    exportService.exportPDF(twoItems(), [{ from: 'a', to: 'b', type: 'synergy' }] as any);
    const edgesTable = (autoTable as jest.Mock).mock.calls.find(
      ([, opts]) => opts.head?.[0]?.includes('Maßnahme (von)'),
    );
    expect(edgesTable?.[1].body[0][3]).toBe('Windkraft');
  });

  it('edges table body row contains "from" rank', () => {
    exportService.exportPDF(twoItems(), [{ from: 'a', to: 'b', type: 'synergy' }] as any);
    const edgesTable = (autoTable as jest.Mock).mock.calls.find(
      ([, opts]) => opts.head?.[0]?.includes('Maßnahme (von)'),
    );
    expect(edgesTable?.[1].body[0][0]).toBe('1');
  });

  it('edges table body row contains "to" rank', () => {
    exportService.exportPDF(twoItems(), [{ from: 'a', to: 'b', type: 'synergy' }] as any);
    const edgesTable = (autoTable as jest.Mock).mock.calls.find(
      ([, opts]) => opts.head?.[0]?.includes('Maßnahme (von)'),
    );
    expect(edgesTable?.[1].body[0][2]).toBe('2');
  });

  it('edges table body row[0][4] contains translated relation type', () => {
    exportService.exportPDF(twoItems(), [{ from: 'a', to: 'b', type: 'conflict' }] as any);
    const edgesTable = (autoTable as jest.Mock).mock.calls.find(
      ([, opts]) => opts.head?.[0]?.includes('Maßnahme (von)'),
    );
    expect(edgesTable?.[1].body[0][4]).toBe('Konflikt');
  });

  it('filters out edges where only "to" is missing', () => {
    exportService.exportPDF(twoItems(), [
      { from: 'a', to: 'b',       type: 'synergy'  },
      { from: 'a', to: 'missing', type: 'conflict' },
    ] as any);
    const edgesTable = (autoTable as jest.Mock).mock.calls.find(
      ([, opts]) => opts.head?.[0]?.includes('Maßnahme (von)'),
    );
    expect(edgesTable?.[1].body).toHaveLength(1);
  });

  // ── PDF save ─────────────────────────────────────────────────────────────

  it('calls doc.save() with correct filename pattern', () => {
    exportService.exportPDF([item()]);
    expect(docMock.save).toHaveBeenCalledWith(
      expect.stringMatching(/^klimaschutz-massnahmen_\d{4}-\d{2}-\d{2}\.pdf$/),
    );
  });

  it('does not throw for an empty measures array', () => {
    expect(() => exportService.exportPDF([])).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getRelationTypeLabel  (tested indirectly via edge table body col[4])
// ═══════════════════════════════════════════════════════════════════════════

describe('getRelationTypeLabel', () => {
  /** Run exportPDF with a single edge of the given type and return the label in col[4]. */
  function labelFor(type: string): string {
    jest.clearAllMocks();
    // Rebuild the doc mock after clearAllMocks
    const freshDoc = buildDocMock();
    (jsPDF as jest.Mock).mockImplementation(() => freshDoc);
    exportService.exportPDF(twoItems(), [{ from: 'a', to: 'b', type }] as any);
    const edgesTable = (autoTable as jest.Mock).mock.calls.find(
      ([, opts]) => opts.head?.[0]?.includes('Maßnahme (von)'),
    );
    return edgesTable?.[1].body[0][4] ?? '';
  }

  it('"prerequisite" → "Voraussetzung"', () => expect(labelFor('prerequisite')).toBe('Voraussetzung'));
  it('"dependency"   → "Abhängigkeit"',  () => expect(labelFor('dependency')).toBe('Abhängigkeit'));
  it('"synergy"      → "Synergie"',      () => expect(labelFor('synergy')).toBe('Synergie'));
  it('"conflict"     → "Konflikt"',      () => expect(labelFor('conflict')).toBe('Konflikt'));
  it('"neutral"      → "Neutral"',       () => expect(labelFor('neutral')).toBe('Neutral'));
  it('unknown type   → raw type string', () => expect(labelFor('custom')).toBe('custom'));
});