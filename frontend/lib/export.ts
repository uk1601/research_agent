/**
 * Export utilities for downloading analysis results as PDF or Markdown.
 * 
 * Dependencies:
 * - jspdf: PDF generation
 * - jspdf-autotable: Table support for jspdf
 * 
 * Install: npm install jspdf jspdf-autotable @types/jspdf
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ResearchAnalysis, Paper, Theme, ResearchGap } from './types';

// Type augmentation for jspdf-autotable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}

/**
 * Configuration for PDF generation
 */
const PDF_CONFIG = {
  pageWidth: 210, // A4 width in mm
  pageHeight: 297, // A4 height in mm
  margin: 20,
  lineHeight: 7,
  titleSize: 18,
  headingSize: 14,
  subheadingSize: 12,
  bodySize: 10,
  smallSize: 9,
  colors: {
    primary: [249, 115, 22] as [number, number, number], // Orange accent
    heading: [30, 30, 30] as [number, number, number],
    body: [60, 60, 60] as [number, number, number],
    muted: [120, 120, 120] as [number, number, number],
    link: [37, 99, 235] as [number, number, number], // Blue for links
  },
};

/**
 * Sanitize filename for safe download
 */
function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

/**
 * Get current date formatted for filename
 */
function getDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Wrap text to fit within a given width
 */
function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth);
}

/**
 * Add a new page if needed based on current Y position
 */
function checkPageBreak(doc: jsPDF, currentY: number, requiredSpace: number = 30): number {
  const maxY = PDF_CONFIG.pageHeight - PDF_CONFIG.margin;
  if (currentY + requiredSpace > maxY) {
    doc.addPage();
    return PDF_CONFIG.margin;
  }
  return currentY;
}

/**
 * Export analysis results to PDF
 */
export function exportToPDF(
  topic: string,
  answer: ResearchAnalysis | Record<string, any> | string | null,
  filename?: string
): void {
  // Early validation
  if (!topic || !answer) {
    console.error('Export failed: topic or answer is missing');
    throw new Error('Cannot export: missing topic or answer content');
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const contentWidth = PDF_CONFIG.pageWidth - 2 * PDF_CONFIG.margin;
  let y = PDF_CONFIG.margin;

  // Helper to add text with automatic page breaks
  const addText = (
    text: string,
    fontSize: number,
    color: [number, number, number],
    isBold: boolean = false,
    maxWidth: number = contentWidth
  ): void => {
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    
    const lines = wrapText(doc, text, maxWidth);
    const lineHeight = fontSize * 0.4;
    
    for (const line of lines) {
      y = checkPageBreak(doc, y, lineHeight);
      doc.text(line, PDF_CONFIG.margin, y);
      y += lineHeight;
    }
  };

  // Helper to add a section heading
  const addHeading = (text: string, level: 1 | 2 | 3 = 2): void => {
    y = checkPageBreak(doc, y, 20);
    y += level === 1 ? 8 : 5;
    
    const fontSize = level === 1 ? PDF_CONFIG.headingSize : level === 2 ? PDF_CONFIG.subheadingSize : PDF_CONFIG.bodySize;
    addText(text, fontSize, PDF_CONFIG.colors.heading, true);
    y += 3;
  };

  // Helper to add a horizontal line
  const addHorizontalLine = (): void => {
    y = checkPageBreak(doc, y, 10);
    doc.setDrawColor(...PDF_CONFIG.colors.muted);
    doc.setLineWidth(0.3);
    doc.line(PDF_CONFIG.margin, y, PDF_CONFIG.pageWidth - PDF_CONFIG.margin, y);
    y += 5;
  };

  // ===== HEADER =====
  // Title
  doc.setFontSize(PDF_CONFIG.titleSize);
  doc.setTextColor(...PDF_CONFIG.colors.primary);
  doc.setFont('helvetica', 'bold');
  doc.text('Research Analysis Report', PDF_CONFIG.margin, y);
  y += 10;

  // Topic
  doc.setFontSize(PDF_CONFIG.headingSize);
  doc.setTextColor(...PDF_CONFIG.colors.heading);
  doc.setFont('helvetica', 'normal');
  const topicLines = wrapText(doc, `Topic: ${topic}`, contentWidth);
  for (const line of topicLines) {
    doc.text(line, PDF_CONFIG.margin, y);
    y += 6;
  }

  // Date
  doc.setFontSize(PDF_CONFIG.smallSize);
  doc.setTextColor(...PDF_CONFIG.colors.muted);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`, PDF_CONFIG.margin, y);
  y += 5;

  addHorizontalLine();

  // ===== CONTENT =====
  
  // Handle string answer (plain text/markdown)
  if (typeof answer === 'string') {
    addHeading('Analysis', 1);
    addText(answer, PDF_CONFIG.bodySize, PDF_CONFIG.colors.body);
  }
  // Handle structured answer
  else if (answer && typeof answer === 'object') {
    const analysis = answer as ResearchAnalysis;

    // Summary
    if (analysis.summary) {
      addHeading('Executive Summary', 1);
      addText(analysis.summary, PDF_CONFIG.bodySize, PDF_CONFIG.colors.body);
    }

    // Papers
    if (analysis.papers && analysis.papers.length > 0) {
      addHeading('Key Papers', 1);
      
      const tableData = analysis.papers.map((paper: Paper, idx: number) => [
        `${idx + 1}`,
        paper.title || 'Untitled',
        paper.authors?.join(', ') || 'Unknown',
        paper.year?.toString() || '-',
        paper.source || '-',
      ]);

      y = checkPageBreak(doc, y, 40);
      
      autoTable(doc, {
        startY: y,
        head: [['#', 'Title', 'Authors', 'Year', 'Source']],
        body: tableData,
        margin: { left: PDF_CONFIG.margin, right: PDF_CONFIG.margin },
        headStyles: {
          fillColor: PDF_CONFIG.colors.primary,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: PDF_CONFIG.smallSize,
        },
        bodyStyles: {
          fontSize: PDF_CONFIG.smallSize - 1,
          textColor: PDF_CONFIG.colors.body,
        },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 60 },
          2: { cellWidth: 45 },
          3: { cellWidth: 15 },
          4: { cellWidth: 25 },
        },
        alternateRowStyles: {
          fillColor: [248, 248, 248],
        },
      });

      y = doc.lastAutoTable.finalY + 5;

      // Paper details
      analysis.papers.forEach((paper: Paper, idx: number) => {
        y = checkPageBreak(doc, y, 30);
        
        addHeading(`${idx + 1}. ${paper.title}`, 3);
        
        if (paper.summary) {
          addText(paper.summary, PDF_CONFIG.smallSize, PDF_CONFIG.colors.body);
        }
        
        if (paper.relevance) {
          y += 2;
          doc.setFontSize(PDF_CONFIG.smallSize);
          doc.setTextColor(...PDF_CONFIG.colors.muted);
          doc.setFont('helvetica', 'italic');
          const relevanceLines = wrapText(doc, `Relevance: ${paper.relevance}`, contentWidth);
          for (const line of relevanceLines) {
            y = checkPageBreak(doc, y, 5);
            doc.text(line, PDF_CONFIG.margin, y);
            y += 4;
          }
        }
        
        if (paper.url) {
          y = checkPageBreak(doc, y, 5);
          doc.setFontSize(PDF_CONFIG.smallSize - 1);
          doc.setTextColor(...PDF_CONFIG.colors.link);
          doc.textWithLink(paper.url, PDF_CONFIG.margin, y, { url: paper.url });
          y += 5;
        }
        
        y += 3;
      });
    }

    // Themes
    if (analysis.themes && analysis.themes.length > 0) {
      addHeading('Research Themes', 1);
      
      analysis.themes.forEach((theme: Theme, idx: number) => {
        y = checkPageBreak(doc, y, 20);
        
        addHeading(`${idx + 1}. ${theme.name}`, 3);
        addText(theme.description, PDF_CONFIG.smallSize, PDF_CONFIG.colors.body);
        
        if (theme.key_papers && theme.key_papers.length > 0) {
          y += 2;
          doc.setFontSize(PDF_CONFIG.smallSize - 1);
          doc.setTextColor(...PDF_CONFIG.colors.muted);
          doc.text(`Key papers: ${theme.key_papers.join(', ')}`, PDF_CONFIG.margin, y);
          y += 5;
        }
        
        y += 3;
      });
    }

    // Research Gaps
    if (analysis.gaps && analysis.gaps.length > 0) {
      addHeading('Research Gaps', 1);
      
      analysis.gaps.forEach((gap: ResearchGap, idx: number) => {
        y = checkPageBreak(doc, y, 20);
        
        addHeading(`${idx + 1}. ${gap.area}`, 3);
        addText(gap.description, PDF_CONFIG.smallSize, PDF_CONFIG.colors.body);
        
        if (gap.potential_impact) {
          y += 2;
          doc.setFontSize(PDF_CONFIG.smallSize);
          doc.setTextColor(34, 197, 94); // Green
          doc.setFont('helvetica', 'italic');
          const impactLines = wrapText(doc, `Potential Impact: ${gap.potential_impact}`, contentWidth);
          for (const line of impactLines) {
            y = checkPageBreak(doc, y, 5);
            doc.text(line, PDF_CONFIG.margin, y);
            y += 4;
          }
        }
        
        y += 3;
      });
    }

    // Future Directions
    if (analysis.future_directions && analysis.future_directions.length > 0) {
      addHeading('Future Directions', 1);
      
      analysis.future_directions.forEach((direction: string, idx: number) => {
        y = checkPageBreak(doc, y, 10);
        addText(`${idx + 1}. ${direction}`, PDF_CONFIG.smallSize, PDF_CONFIG.colors.body);
        y += 2;
      });
    }
  }

  // ===== FOOTER =====
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(PDF_CONFIG.smallSize - 1);
    doc.setTextColor(...PDF_CONFIG.colors.muted);
    doc.text(
      `Page ${i} of ${pageCount}`,
      PDF_CONFIG.pageWidth / 2,
      PDF_CONFIG.pageHeight - 10,
      { align: 'center' }
    );
    doc.text(
      'Generated by Research Paper Analyzer • Powered by Subconscious',
      PDF_CONFIG.pageWidth / 2,
      PDF_CONFIG.pageHeight - 6,
      { align: 'center' }
    );
  }

  // Save the PDF
  const safeFilename = filename || `research-analysis-${sanitizeFilename(topic)}-${getDateString()}.pdf`;
  doc.save(safeFilename);
}

/**
 * Export analysis results to Markdown
 */
export function exportToMarkdown(
  topic: string,
  answer: ResearchAnalysis | Record<string, any> | string | null,
  filename?: string
): void {
  let markdown = '';

  // Header
  markdown += `# Research Analysis Report\n\n`;
  markdown += `**Topic:** ${topic}\n\n`;
  markdown += `**Generated:** ${new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}\n\n`;
  markdown += `---\n\n`;

  // Handle string answer
  if (typeof answer === 'string') {
    markdown += `## Analysis\n\n`;
    markdown += `${answer}\n\n`;
  }
  // Handle structured answer
  else if (answer && typeof answer === 'object') {
    const analysis = answer as ResearchAnalysis;

    // Summary
    if (analysis.summary) {
      markdown += `## Executive Summary\n\n`;
      markdown += `${analysis.summary}\n\n`;
    }

    // Papers
    if (analysis.papers && analysis.papers.length > 0) {
      markdown += `## Key Papers\n\n`;
      
      // Table header
      markdown += `| # | Title | Authors | Year | Source |\n`;
      markdown += `|---|-------|---------|------|--------|\n`;
      
      analysis.papers.forEach((paper: Paper, idx: number) => {
        const title = paper.url ? `[${paper.title}](${paper.url})` : paper.title;
        markdown += `| ${idx + 1} | ${title || 'Untitled'} | ${paper.authors?.join(', ') || 'Unknown'} | ${paper.year || '-'} | ${paper.source || '-'} |\n`;
      });
      
      markdown += `\n`;

      // Paper details
      markdown += `### Paper Details\n\n`;
      analysis.papers.forEach((paper: Paper, idx: number) => {
        markdown += `#### ${idx + 1}. ${paper.title}\n\n`;
        
        if (paper.authors && paper.authors.length > 0) {
          markdown += `**Authors:** ${paper.authors.join(', ')}\n\n`;
        }
        
        if (paper.summary) {
          markdown += `${paper.summary}\n\n`;
        }
        
        if (paper.relevance) {
          markdown += `*Relevance: ${paper.relevance}*\n\n`;
        }
        
        if (paper.url) {
          markdown += `**Link:** ${paper.url}\n\n`;
        }
        
        markdown += `---\n\n`;
      });
    }

    // Themes
    if (analysis.themes && analysis.themes.length > 0) {
      markdown += `## Research Themes\n\n`;
      
      analysis.themes.forEach((theme: Theme, idx: number) => {
        markdown += `### ${idx + 1}. ${theme.name}\n\n`;
        markdown += `${theme.description}\n\n`;
        
        if (theme.key_papers && theme.key_papers.length > 0) {
          markdown += `**Key papers:** ${theme.key_papers.join(', ')}\n\n`;
        }
      });
    }

    // Research Gaps
    if (analysis.gaps && analysis.gaps.length > 0) {
      markdown += `## Research Gaps\n\n`;
      
      analysis.gaps.forEach((gap: ResearchGap, idx: number) => {
        markdown += `### ${idx + 1}. ${gap.area}\n\n`;
        markdown += `${gap.description}\n\n`;
        
        if (gap.potential_impact) {
          markdown += `**Potential Impact:** ${gap.potential_impact}\n\n`;
        }
      });
    }

    // Future Directions
    if (analysis.future_directions && analysis.future_directions.length > 0) {
      markdown += `## Future Directions\n\n`;
      
      analysis.future_directions.forEach((direction: string, idx: number) => {
        markdown += `${idx + 1}. ${direction}\n`;
      });
      
      markdown += `\n`;
    }
  }

  // Footer
  markdown += `---\n\n`;
  markdown += `*Generated by Research Paper Analyzer • Powered by [Subconscious](https://subconscious.dev)*\n`;

  // Download the file
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `research-analysis-${sanitizeFilename(topic)}-${getDateString()}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Check if export is available (answer exists)
 */
export function canExport(answer: ResearchAnalysis | Record<string, any> | string | null): boolean {
  if (!answer) return false;
  if (typeof answer === 'string') return answer.trim().length > 0;
  if (typeof answer === 'object') {
    const a = answer as ResearchAnalysis;
    return !!(a.summary || a.papers?.length || a.themes?.length || a.gaps?.length || a.future_directions?.length);
  }
  return false;
}
