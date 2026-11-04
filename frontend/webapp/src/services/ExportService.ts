/**
 * ExportService.ts
 *
 * Singleton service that handles exporting ranked measure data to PDF, DOCX,
 * and CSV formats.
 *
 * PDF and DOCX output both contain three sections:
 *  1. Main measures table with scores and costs.
 *  2. Social-acceptance comments (measures with a non-empty popularityComment).
 *  3. Dependency-graph relationships between exported measures (only when graph
 *     edges are supplied). Rows are ordered by the rank of the source measure and,
 *     for ties, by the rank of the target measure, so the table reads top-to-bottom
 *     in the same order as the main measures table. Labels and the colour of the
 *     "Beziehung" text come from RELATION_TYPE_CONFIG, so the exported report stays
 *     visually consistent with the interactive graph view. Sections 2 and 3 show a
 *     short notice instead of a table when they have no entries.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  WidthType,
} from 'docx';
import { GraphEdge, RELATION_TYPE_CONFIG, RelationTypeConfig } from '../types/graphTypes';

// --- Types ---

/** Text alignment options accepted by docx table cells. */
type CellAlignment = (typeof AlignmentType)[keyof typeof AlignmentType];

/** Relationship data prepared for the relationships table of an export. */
interface ExportedRelationships {
  /** Edges between exported measures, sorted by source rank, then target rank. */
  sortedEdges: GraphEdge[];
  /** Maps an exported measure ID to its title. */
  idToTitle: Map<string, string>;
  /** Maps an exported measure ID to its rank. */
  idToRank: Map<string, number>;
}

class ExportService {

  // --- Relationship type helpers ---

  /**
   * Looks up the display config of a raw graph-edge type.
   *
   * @param type Raw edge type string.
   * @returns The matching config, or undefined for a type that is not registered.
   */
  private findRelationConfig(type: string): RelationTypeConfig | undefined {
    return (RELATION_TYPE_CONFIG as Record<string, RelationTypeConfig | undefined>)[type];
  }

  /**
   * Maps a raw graph-edge type to its human-readable German label.
   * Falls back to the raw type string for any unregistered type.
   */
  private getRelationTypeLabel(type: string): string {
    return this.findRelationConfig(type)?.label ?? type;
  }

  /**
   * Maps a raw graph-edge type to the RGB colour used for that relationship
   * type in the interactive graph, so exported relationship tables can render
   * their "Beziehung" text in matching colours. Falls back to the neutral
   * colour for any unregistered type.
   */
  private getRelationTypeColor(type: string): [number, number, number] {
    const { edgeColor } = this.findRelationConfig(type) ?? RELATION_TYPE_CONFIG.neutral;
    return this.hexToRgb(edgeColor);
  }

  /**
   * Hex-string variant of {@link getRelationTypeColor}: six uppercase hex digits
   * without a leading '#', the format expected by docx's `color` / `shading.fill`
   * properties. Both output formats derive their colours from the same config.
   */
  private getRelationTypeColorHex(type: string): string {
    const { edgeColor } = this.findRelationConfig(type) ?? RELATION_TYPE_CONFIG.neutral;
    return edgeColor.slice(1).toUpperCase();
  }

  /**
   * Converts a six-digit hex colour with a leading '#' into an [r, g, b] triple.
   */
  private hexToRgb(hex: string): [number, number, number] {
    const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
    return [r, g, b];
  }

  /**
   * Prepares the data of the relationships table shared by the PDF and DOCX export.
   *
   * Only edges whose endpoints are both part of the exported measures are kept.
   * They are sorted primarily by the rank of the source measure and secondarily by
   * the rank of the target measure, so the table follows the same top-to-bottom
   * order as the main measures table.
   *
   * @param measures Array of ranked measure objects.
   * @param edges    All graph edges.
   */
  private getExportedRelationships(measures: any[], edges: GraphEdge[]): ExportedRelationships {
    const idToTitle = new Map<string, string>();
    const idToRank  = new Map<string, number>();
    measures.forEach((item) => {
      idToTitle.set(item.measure.id, item.measure.title);
      idToRank.set(item.measure.id, item.rank);
    });

    const sortedEdges = edges
      .filter((edge) => idToTitle.has(edge.from) && idToTitle.has(edge.to))
      .sort((a, b) => {
        const rankFromDiff = idToRank.get(a.from)! - idToRank.get(b.from)!;
        if (rankFromDiff !== 0) return rankFromDiff;
        return idToRank.get(a.to)! - idToRank.get(b.to)!;
      });

    return { sortedEdges, idToTitle, idToRank };
  }

  // --- CSV export ---

  /**
   * Generates and triggers a browser download of a semicolon-delimited CSV file
   * containing one row per measure with all key metrics.
   *
   * Columns: Rank, Name, Social Acceptance, Comment, Time, Investment Cost,
   *          Ongoing Cost, Total Cost, One-time CO₂ Savings, Annual CO₂ Savings.
   *
   * @param measures Array of ranked measure objects (each must include `measure`, `rank`,
   *                 and metric fields).
   */
  exportCSV(measures: any[]): void {
    const headers = [
      'Rang', 'Maßnahme', 'Soziale Akzeptanz', 'Kommentar zur sozialen Akzeptanz',
      'Umsetzungszeit (Monate)', 'Investitionskosten (€)', 'Laufende Kosten (€/Jahr)',
      'Gesamtkosten (€)', 'CO2-Einsparung einmalig (kg)', 'CO2-Einsparung jährlich (kg/Jahr)',
    ];

    const rows = measures.map((item) => [
      item.rank,
      item.measure.title,
      item.measure.popularity,
      item.measure.popularityComment || '-',
      item.time,
      item.investmentCost.toLocaleString('de-DE'),
      item.ongoingCost.toLocaleString('de-DE'),
      item.totalCost.toLocaleString('de-DE'),
      item.onetimeEmissionSavings.toLocaleString('de-DE'),
      item.ongoingEmissionSavings.toLocaleString('de-DE'),
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(';')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `klimaschutz-massnahmen_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // --- PDF export ---

  /**
   * Generates and triggers a browser download of a landscape A4 PDF report.
   *
   * The report contains:
   *  1. **Main table** – all measures with rank, name, social acceptance, time, and costs.
   *  2. **Comments table** – measures that include a social-acceptance comment; a notice
   *     replaces the table when there are none.
   *  3. **Relationships table** – graph edges between exported measures (only when `edges` is
   *     provided; a notice replaces the table when no edge connects two exported measures).
   *     Rows are sorted primarily by the rank of the source measure and secondarily by the
   *     rank of the target measure. The relationship label of each row is coloured to match
   *     the corresponding edge colour from the interactive graph.
   *
   * Page numbers are added in the footer of each page.
   *
   * @param measures Array of ranked measure objects.
   * @param edges    Optional graph edges; when supplied a relationship section is appended.
   */
  exportPDF(measures: any[], edges?: GraphEdge[]): void {
    const doc = new jsPDF('l', 'mm', 'a4');

    // A4 landscape: 297 mm wide; 15 mm margins each side → 267 mm usable width
    const pageWidth   = doc.internal.pageSize.width;
    const marginLeft  = 15;
    const marginRight = 15;
    const usableWidth = pageWidth - marginLeft - marginRight;

    // --- Document header ---
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Klimaschutzmaßnahmen - Empfehlungen', marginLeft, 15);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE',{
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })}`, marginLeft, 22);
    doc.setFontSize(11);
    doc.text(`Anzahl Maßnahmen: ${measures.length}`, marginLeft, 28);

    // --- Table 1: main measures ---
    const tableData = measures.map((item) => [
      item.rank.toString(),
      item.measure.title,
      item.measure.popularity,
      item.time.toString(),
      item.investmentCost.toLocaleString('de-DE') + ' €',
      item.ongoingCost.toLocaleString('de-DE') + ' €',
      item.totalCost.toLocaleString('de-DE') + ' €',
      item.onetimeEmissionSavings.toLocaleString('de-DE') + ' kg',
      item.ongoingEmissionSavings.toLocaleString('de-DE') + ' kg/J',
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Rang', 'Maßnahme', 'Soziale\nAkzept.', 'Zeit\n(Mon.)', 'Invest.\nkosten',
              'Lauf.\nKosten', 'Gesamt-\nkosten', 'CO2\n(einm.)', 'CO2\n(jährl.)']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 9, halign: 'center' },
      bodyStyles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 13,  halign: 'center' },
        1: { cellWidth: 104 },
        2: { cellWidth: 18,  halign: 'center' },
        3: { cellWidth: 15,  halign: 'right'  },
        4: { cellWidth: 25,  halign: 'right'  },
        5: { cellWidth: 23,  halign: 'right'  },
        6: { cellWidth: 25,  halign: 'right'  },
        7: { cellWidth: 22,  halign: 'right'  },
        8: { cellWidth: 22,  halign: 'right'  },
      },
      tableWidth: usableWidth,
      margin: { left: marginLeft, right: marginRight },
      didDrawPage: (data) => {
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.text(
          `Seite ${data.pageNumber} von ${doc.getNumberOfPages()}`,
          pageWidth / 2, doc.internal.pageSize.height - 10,
          { align: 'center' },
        );
      },
    });

    // --- Table 2: social-acceptance comments ---
    let currentY = (doc as any).lastAutoTable.finalY + 15;
    if (currentY > doc.internal.pageSize.height - 40) {
      doc.addPage();
      currentY = 15;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Kommentare zur sozialen Akzeptanz', marginLeft, currentY);

    const commentsData = measures
      .filter((item) => item.measure.popularityComment?.trim())
      .map((item) => [item.rank.toString(), item.measure.title, item.measure.popularityComment]);

    if (commentsData.length > 0) {
      autoTable(doc, {
        startY: currentY + 5,
        head: [['Rang', 'Maßnahme', 'Kommentar']],
        body: commentsData,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 15,  halign: 'center' },
          1: { cellWidth: 70  },
          2: { cellWidth: 182 },
        },
        tableWidth: usableWidth,
        margin: { left: marginLeft, right: marginRight },
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.text('Keine Kommentare vorhanden.', marginLeft, currentY + 10);
      currentY += 25;
    }

    // --- Table 3: measure relationships ---
    if (edges) {
      const { sortedEdges, idToTitle, idToRank } = this.getExportedRelationships(measures, edges);

      if (currentY > doc.internal.pageSize.height - 40) {
        doc.addPage();
        currentY = 15;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Beziehungen zwischen Maßnahmen', marginLeft, currentY);

      if (sortedEdges.length > 0) {
        // The relationship colour for each row is precomputed alongside the
        // row data so it can be looked up by row index in didParseCell below,
        // without re-deriving the edge type from the printed German label.
        const rowColors = sortedEdges.map((edge) => this.getRelationTypeColor(edge.type));

        const edgesData = sortedEdges.map((edge) => [
          idToRank.get(edge.from)!.toString(),
          idToTitle.get(edge.from)!,
          idToRank.get(edge.to)!.toString(),
          idToTitle.get(edge.to)!,
          this.getRelationTypeLabel(edge.type),
        ]);

        autoTable(doc, {
          startY: currentY + 5,
          head: [['Rang\n(von)', 'Maßnahme (von)', 'Rang\n(zu)', 'Maßnahme (zu)', 'Beziehung']],
          body: edgesData,
          theme: 'striped',
          headStyles: { fillColor: [139, 92, 246], textColor: 255, fontStyle: 'bold', fontSize: 9, halign: 'center' },
          bodyStyles: { fontSize: 8, cellPadding: 3 },
          columnStyles: {
            0: { cellWidth: 15, halign: 'center' },
            1: { cellWidth: 90 },
            2: { cellWidth: 15, halign: 'center' },
            3: { cellWidth: 90 },
            4: { cellWidth: 57, halign: 'center' },
          },
          tableWidth: usableWidth,
          margin: { left: marginLeft, right: marginRight },
          // Colours the "Beziehung" cell text with the same colour used for
          // that relationship type's edges in the interactive graph, so the
          // printed table visually matches the on-screen legend.
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 4) {
              data.cell.styles.textColor = rowColors[data.row.index];
            }
          },
        });
      } else {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.text('Keine Beziehungen zwischen den exportierten Maßnahmen.', marginLeft, currentY + 10);
      }
    }

    doc.save(`klimaschutz-massnahmen_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  // --- DOCX export ---

  /**
   * Builds a single-row docx table header with a coloured background and
   * bold white centred labels, evenly distributing the given column labels
   * across the table width.
   */
  private buildDocxHeaderRow(labels: string[], fillHex: string): TableRow {
    return new TableRow({
      tableHeader: true,
      children: labels.map((label) => new TableCell({
        width: { size: 100 / labels.length, type: WidthType.PERCENTAGE },
        shading: { fill: fillHex },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: label, bold: true, color: 'FFFFFF', size: 18 })],
        })],
      })),
    });
  }

  /**
   * Builds a single docx table cell containing one line of plain text, with
   * optional alignment, colour, and bold styling.
   */
  private buildDocxCell(
    text: string,
    options?: { align?: CellAlignment; color?: string; bold?: boolean },
  ): TableCell {
    return new TableCell({
      children: [new Paragraph({
        alignment: options?.align ?? AlignmentType.LEFT,
        children: [new TextRun({ text, color: options?.color, bold: options?.bold, size: 18 })],
      })],
    });
  }

  /**
   * Builds the main measures table (rank, name, social acceptance, time,
   * costs, CO2 savings) — the docx equivalent of the PDF's first table.
   */
  private buildMainMeasuresTable(measures: any[]): Table {
    const rows = [
      this.buildDocxHeaderRow(
        ['Rang', 'Maßnahme', 'Soziale Akzeptanz', 'Zeit (Mon.)', 'Investitionskosten',
         'Laufende Kosten', 'Gesamtkosten', 'CO2 (einmalig)', 'CO2 (jährlich)'],
        '3B82F6',
      ),
      ...measures.map((item) => new TableRow({
        children: [
          this.buildDocxCell(item.rank.toString(), { align: AlignmentType.CENTER }),
          this.buildDocxCell(item.measure.title),
          this.buildDocxCell(item.measure.popularity, { align: AlignmentType.CENTER }),
          this.buildDocxCell(item.time.toString(), { align: AlignmentType.RIGHT }),
          this.buildDocxCell(`${item.investmentCost.toLocaleString('de-DE')} €`, { align: AlignmentType.RIGHT }),
          this.buildDocxCell(`${item.ongoingCost.toLocaleString('de-DE')} €`, { align: AlignmentType.RIGHT }),
          this.buildDocxCell(`${item.totalCost.toLocaleString('de-DE')} €`, { align: AlignmentType.RIGHT }),
          this.buildDocxCell(`${item.onetimeEmissionSavings.toLocaleString('de-DE')} kg`, { align: AlignmentType.RIGHT }),
          this.buildDocxCell(`${item.ongoingEmissionSavings.toLocaleString('de-DE')} kg/J`, { align: AlignmentType.RIGHT }),
        ],
      })),
    ];

    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
  }

  /**
   * Builds the social-acceptance comments table (rank, name, comment) — the
   * docx equivalent of the PDF's second table. Expects a pre-filtered list
   * of measures that all have a non-empty `popularityComment`.
   */
  private buildCommentsTable(measuresWithComments: any[]): Table {
    const rows = [
      this.buildDocxHeaderRow(['Rang', 'Maßnahme', 'Kommentar'], '10B981'),
      ...measuresWithComments.map((item) => new TableRow({
        children: [
          this.buildDocxCell(item.rank.toString(), { align: AlignmentType.CENTER }),
          this.buildDocxCell(item.measure.title),
          this.buildDocxCell(item.measure.popularityComment),
        ],
      })),
    ];

    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
  }

  /**
   * Builds the measure-relationships table (source rank/name, target
   * rank/name, relationship label) — the docx equivalent of the PDF's third
   * table. The relationship label is coloured to match the edge colours
   * used in the interactive graph. Expects edges already filtered to
   * exported measures and sorted by source/target rank.
   */
  private buildRelationshipsTable(
    sortedEdges: GraphEdge[],
    idToTitle: Map<string, string>,
    idToRank: Map<string, number>,
  ): Table {
    const rows = [
      this.buildDocxHeaderRow(['Rang (von)', 'Maßnahme (von)', 'Rang (zu)', 'Maßnahme (zu)', 'Beziehung'], '8B5CF6'),
      ...sortedEdges.map((edge) => new TableRow({
        children: [
          this.buildDocxCell(idToRank.get(edge.from)!.toString(), { align: AlignmentType.CENTER }),
          this.buildDocxCell(idToTitle.get(edge.from)!),
          this.buildDocxCell(idToRank.get(edge.to)!.toString(), { align: AlignmentType.CENTER }),
          this.buildDocxCell(idToTitle.get(edge.to)!),
          this.buildDocxCell(this.getRelationTypeLabel(edge.type), {
            align: AlignmentType.CENTER,
            color: this.getRelationTypeColorHex(edge.type)
          }),
        ],
      })),
    ];

    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
  }

  /**
   * Generates and triggers a browser download of a Word (.docx) report.
   *
   * Mirrors {@link exportPDF} in content and structure — main measures table,
   * social-acceptance comments table, and an optional relationships table —
   * but as an editable Word document instead of a fixed-layout PDF.
   *
   * @param measures Array of ranked measure objects.
   * @param edges    Optional graph edges; when supplied a relationship section is appended.
   */
  async exportDOCX(measures: any[], edges?: GraphEdge[]): Promise<void> {
    const children: (Paragraph | Table)[] = [
      new Paragraph({ text: 'Klimaschutzmaßnahmen - Empfehlungen', heading: HeadingLevel.HEADING_1 }),
      new Paragraph({
        children: [new TextRun({
          text: `Erstellt am: ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
          size: 20,
        })],
      }),
      new Paragraph({
        children: [new TextRun({ text: `Anzahl Maßnahmen: ${measures.length}`, size: 20 })],
        spacing: { after: 200 },
      }),
      new Paragraph({ text: 'Maßnahmenübersicht', heading: HeadingLevel.HEADING_2, spacing: { after: 100 } }),
      this.buildMainMeasuresTable(measures),
    ];

    // --- Social-acceptance comments ---
    const measuresWithComments = measures.filter((item) => item.measure.popularityComment?.trim());
    children.push(new Paragraph({
      text: 'Kommentare zur sozialen Akzeptanz',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 100 },
    }));
    if (measuresWithComments.length > 0) {
      children.push(this.buildCommentsTable(measuresWithComments));
    } else {
      children.push(new Paragraph({ children: [new TextRun({ text: 'Keine Kommentare vorhanden.', italics: true })] }));
    }

    // --- Measure relationships ---
    if (edges) {
      const { sortedEdges, idToTitle, idToRank } = this.getExportedRelationships(measures, edges);

      children.push(new Paragraph({
        text: 'Beziehungen zwischen Maßnahmen',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
      }));
      if (sortedEdges.length > 0) {
        children.push(this.buildRelationshipsTable(sortedEdges, idToTitle, idToRank));
      } else {
        children.push(new Paragraph({
          children: [new TextRun({ text: 'Keine Beziehungen zwischen den exportierten Maßnahmen.', italics: true })],
        }));
      }
    }

    const wordDocument = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(wordDocument);

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `klimaschutz-massnahmen_${new Date().toISOString().split('T')[0]}.docx`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/** Singleton instance shared across the application. */
export const exportService = new ExportService();
export default exportService;