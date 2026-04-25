/**
 * ExportService.ts
 *
 * Singleton service that handles exporting ranked measure data to PDF and CSV formats.
 *
 * PDF output (landscape A4) contains three tables:
 *  1. Main measures table with scores and costs.
 *  2. Social-acceptance comments (measures with a non-empty popularityComment).
 *  3. Dependency-graph relationships between exported measures (optional).
 *
 * CSV output is semicolon-delimited and UTF-8 BOM encoded for Excel compatibility.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GraphEdge } from '../types/graphTypes';

class ExportService {

  /**
   * Maps a raw graph-edge type to a human-readable German label.
   *
   * @param type  'prerequisite' | 'dependency' | 'synergy' | 'conflict' | 'neutral'
   */
  private getRelationTypeLabel(type: string): string {
    switch (type) {
      case 'prerequisite': return 'Voraussetzung';
      case 'dependency':   return 'Abhängigkeit';
      case 'synergy':      return 'Synergie';
      case 'conflict':     return 'Konflikt';
      case 'neutral':      return 'Neutral';
      default:             return type;
    }
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
    // Fixed column widths: 13+18+15+25+23+25+22+22 = 163 mm fixed; Maßnahme gets 104 mm
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
      // Column widths: Rang=15, Maßnahme=70, Kommentar=182 → 267 mm
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
      const idToRank  = new Map<string, string>();
      measures.forEach((item) => {
        idToTitle.set(item.measure.id, item.measure.title);
        idToRank.set(item.measure.id, item.rank.toString());
      });

      // Only include edges where both endpoints appear in the exported measures
      const relevantEdges = edges.filter(
        (edge) => idToTitle.has(edge.from) && idToTitle.has(edge.to),
      );

      if (relevantEdges.length > 0) {
        // Column widths: RangVon=15, MaßnahmeVon=90, RangZu=15, MaßnahmeZu=90, Beziehung=57 → 267 mm
        const edgesData = relevantEdges.map((edge) => [
          idToRank.get(edge.from)!,
          idToTitle.get(edge.from)!,
          idToRank.get(edge.to)!,
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
        });
      }
    }

    doc.save(`klimaschutz-massnahmen_${new Date().toISOString().split('T')[0]}.pdf`);
  }
}

/** Singleton instance shared across the application. */
export const exportService = new ExportService();
export default exportService;