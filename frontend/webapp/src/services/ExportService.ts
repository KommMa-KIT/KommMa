/**
 * ExportService.ts
 * @author FladYannic
 *
 * Singleton service that handles exporting ranked measure data to PDF, DOCX,
 * and CSV formats.
 *
 * PDF and DOCX output both contain three sections:
 *  1. Main measures table with scores and costs.
 *  2. Social-acceptance comments (measures with a non-empty popularityComment).
 *  3. Dependency-graph relationships between exported measures (optional). Rows are
 *     ordered by the rank of the source measure and, for ties, by the rank of the
 *     target measure, so the table reads top-to-bottom in the same order as the main
 *     measures table. The "Beziehung" text is coloured to match the edge colours used
 *     in the interactive graph view, so the exported report stays visually consistent
 *     with the on-screen legend.
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
import { GraphEdge } from '../types/graphTypes';

/** Text alignment options accepted by docx table cells. */
type CellAlignment = (typeof AlignmentType)[keyof typeof AlignmentType];

class ExportService {

  /**
   * Maps a raw graph-edge type to a human-readable German label.
   */
  private getRelationTypeLabel(type: string): string {
    switch (type) {
      case 'prerequisite': return 'Voraussetzung';
      case 'dependency':   return 'Abhängigkeit';
      case 'synergy':      return 'Synergie';
      case 'conflict':     return 'Konflikt';
      case 'neutral':      return 'Neutral';
      case 'contribution': return 'Beitrag';
      default:             return type;
    }
  }

  /**
   * Maps a raw graph-edge type to the RGB colour used for that relationship
   * type in the interactive graph (GraphViewCanvas / GraphView legend), so
   * exported relationship tables can render their "Beziehung" text in
   * matching colours. Falls back to neutral grey for any unrecognised type.
   */
  private getRelationTypeColor(type: string): [number, number, number] {
    const colors: Record<string, [number, number, number]> = {
      synergy:      [34, 197, 94],   // #22c55e
      conflict:     [239, 68, 68],   // #ef4444
      contribution: [202, 138, 4],   // #ca8a04
      dependency:   [59, 130, 246],  // #3b82f6
      prerequisite: [168, 85, 247],  // #a855f7
      neutral:      [156, 163, 175], // #9ca3af
    };

    return colors[type] || colors.neutral;
  }

  /**
   * Converts an [r, g, b] triple into a 6-digit uppercase hex string
   * (without a leading '#'), the format expected by docx's `color` /
   * `shading.fill` properties.
   */
  private rgbToHex([r, g, b]: [number, number, number]): string {
    return [r, g, b]
      .map((channel) => channel.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }

  /**
   * Hex-string variant of {@link getRelationTypeColor}, used by the DOCX
   * export so both output formats derive their relationship colours from
   * the same single source of truth.
   */
  private getRelationTypeColorHex(type: string): string {
    return this.rgbToHex(this.getRelationTypeColor(type));
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
   *  2. **Comments table** – measures that include a social-acceptance comment.
   *  3. **Relationships table** – graph edges between exported measures (only when `edges` is provided).
   *     Rows are sorted primarily by the rank of the source measure and secondarily by the
   *     rank of the target measure. The relationship label of each row is coloured to match
   *     the corresponding edge colour from the interactive graph.
   *
   * Page numbers are added in the footer of each page.
   *
   * @param measures Array of ranked measure objects.
   * @param edges    Optional graph edges; when supplied a relationship table is appended.
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
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.text('Keine Kommentare vorhanden.', marginLeft, currentY + 10);
    }

    // --- Table 3: measure relationships (optional) ---
    if (edges && edges.length > 0) {
      currentY = (doc as any).lastAutoTable?.finalY + 15 || currentY + 20;
      if (currentY > doc.internal.pageSize.height - 40) {
        doc.addPage();
        currentY = 15;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Beziehungen zwischen Maßnahmen', marginLeft, currentY);

      // Build lookup maps from measure data
      const idToTitle = new Map<string, string>();
      const idToRank  = new Map<string, number>();
      measures.forEach((item) => {
        idToTitle.set(item.measure.id, item.measure.title);
        idToRank.set(item.measure.id, item.rank);
      });

      // Only include edges where both endpoints appear in the exported measures
      const relevantEdges = edges.filter(
        (edge) => idToTitle.has(edge.from) && idToTitle.has(edge.to),
      );

      // Sort primarily by the rank of the source measure and secondarily by
      // the rank of the target measure, so the table follows the same
      // top-to-bottom order as the main measures table.
      const sortedEdges = [...relevantEdges].sort((a, b) => {
        const rankFromDiff = idToRank.get(a.from)! - idToRank.get(b.from)!;
        if (rankFromDiff !== 0) return rankFromDiff;
        return idToRank.get(a.to)! - idToRank.get(b.to)!;
      });

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
   * @param edges    Optional graph edges; when supplied a relationship table is appended.
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

    // --- Measure relationships (optional) ---
    if (edges && edges.length > 0) {
      const idToTitle = new Map<string, string>();
      const idToRank  = new Map<string, number>();
      measures.forEach((item) => {
        idToTitle.set(item.measure.id, item.measure.title);
        idToRank.set(item.measure.id, item.rank);
      });

      const relevantEdges = edges.filter(
        (edge) => idToTitle.has(edge.from) && idToTitle.has(edge.to),
      );

      // Sorted primarily by the rank of the source measure and secondarily by
      // the rank of the target measure, matching the main table's order.
      const sortedEdges = [...relevantEdges].sort((a, b) => {
        const rankFromDiff = idToRank.get(a.from)! - idToRank.get(b.from)!;
        if (rankFromDiff !== 0) return rankFromDiff;
        return idToRank.get(a.to)! - idToRank.get(b.to)!;
      });

      if (sortedEdges.length > 0) {
        children.push(new Paragraph({
          text: 'Beziehungen zwischen Maßnahmen',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        }));
        children.push(this.buildRelationshipsTable(sortedEdges, idToTitle, idToRank));
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