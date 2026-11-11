import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { DetectedTextItem, PageDescriptor } from '../types';

// Use unpkg worker or dynamic import for Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Loads a PDF document from Uint8Array
 */
export async function loadPdf(data: Uint8Array): Promise<pdfjsLib.PDFDocumentProxy> {
  const loadingTask = pdfjsLib.getDocument({
    // PDF.js transfers its input buffer to the worker; keep the caller's bytes for export.
    data: data.slice(),
    cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
  });
  return await loadingTask.promise;
}

/**
 * Extracts initial page descriptors from a loaded PDF document
 */
export async function getDocumentPages(doc: pdfjsLib.PDFDocumentProxy): Promise<PageDescriptor[]> {
  const pages: PageDescriptor[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    pages.push({
      id: `page-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      source: 'original',
      sourcePageIndex: i - 1, // 0-indexed
      rotation: page.rotate || 0,
      width: viewport.width,
      height: viewport.height,
    });
  }
  return pages;
}

/**
 * Renders a PDF page to an HTML canvas
 */
export async function renderPage(
  doc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number,
  canvas: HTMLCanvasElement,
  scale: number,
  rotation: number
): Promise<void> {
  try {
    const page = await doc.getPage(pageIndex + 1); // 1-indexed in pdfjs
    const viewport = page.getViewport({ scale, rotation });

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
  } catch (err) {
    console.error('Error rendering page:', err);
  }
}

/**
 * Extracts text items from a page with their PDF bounding boxes,
 * accurately detecting real font names and clustering multi-line blocks/cells.
 */
export async function extractTextItems(
  doc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number
): Promise<DetectedTextItem[]> {
  try {
    const page = await doc.getPage(pageIndex + 1);
    const textContent = await page.getTextContent();
    const rawItems: DetectedTextItem[] = [];

    // Ensure commonObjs is populated with font dictionaries
    try {
      await page.getOperatorList();
    } catch (opErr) {
      // Non-fatal if operator list is already cached
    }

    textContent.items.forEach((item: any, idx: number) => {
      if (!item.str || item.str.trim() === '') return;

      const tx = item.transform[4];
      const ty = item.transform[5];
      const scaleX = item.transform[0];
      const scaleY = item.transform[3];
      const fontSize = Math.sqrt(scaleX * scaleX + scaleY * scaleY) || item.height || 12;

      const rawFontName = item.fontName || '';
      const style = textContent.styles ? (textContent.styles as any)[rawFontName] : null;
      const styleFamily = style?.fontFamily || '';

      // Inspect font object from page.commonObjs or page.objs if available
      let fontObj: any = null;
      try {
        if ((page as any).commonObjs && (page as any).commonObjs.has(rawFontName)) {
          fontObj = (page as any).commonObjs.get(rawFontName);
        } else if ((page as any).objs && (page as any).objs.has(rawFontName)) {
          fontObj = (page as any).objs.get(rawFontName);
        }
      } catch (fErr) {
        // fallback to style dictionary
      }

      const realFontName = fontObj?.name || fontObj?.loadedName || rawFontName;
      const fallbackName = fontObj?.fallbackName || styleFamily;
      const combined = `${realFontName} ${fallbackName} ${rawFontName}`.toLowerCase();

      const isBold =
        Boolean(fontObj?.bold || fontObj?.black) ||
        combined.includes('bold') ||
        combined.includes('black') ||
        combined.includes('heavy') ||
        combined.includes('semibold') ||
        combined.includes('demi') ||
        combined.includes('medium') ||
        combined.includes('-b') ||
        combined.includes('_b');

      const isItalic =
        Boolean(fontObj?.italic) ||
        combined.includes('italic') ||
        combined.includes('oblique') ||
        combined.includes('-i') ||
        combined.includes('_i');

      const fontFamily = cleanFontFamily(realFontName, fallbackName);

      // PDF coordinates: bounding box bottom edge is baseline minus descent (approx 20% of fontSize)
      const x = tx;
      const y = ty - fontSize * 0.22;
      const width = item.width || item.str.length * fontSize * 0.55;
      const height = Math.max(fontSize * 1.2, item.height || fontSize);

      rawItems.push({
        id: `raw-${pageIndex}-${idx}`,
        str: item.str,
        x,
        y,
        width,
        height,
        origBoxes: [{ x, y, width, height }],
        fontSize: Math.round(fontSize * 10) / 10,
        fontName: realFontName,
        fontFamily,
        isBold,
        isItalic,
        transform: item.transform,
      });
    });

    // Cluster text items into coherent paragraphs and multi-line sections while preserving tables
    return smartClusterSections(rawItems, pageIndex);
  } catch (err) {
    console.error('Error extracting text items:', err);
    return [];
  }
}

/**
 * Normalizes raw font name into a recognized CSS/Standard font family.
 * Supports Adobe PDF Editor Pro typefaces, standard PostScript base 14 fonts,
 * and high-fidelity platform fallbacks.
 */
export function cleanFontFamily(rawName: string, fallback: string): string {
  // Strip PDF 6-character subset prefix (e.g. ABCDEF+Calibri -> Calibri)
  const clean = (rawName || '').replace(/^[A-Z]{6}\+/, '').trim();
  const lower = `${clean} ${fallback}`.toLowerCase();

  // Adobe Pro & standard typefaces
  if (lower.includes('myriad')) return 'Myriad Pro';
  if (lower.includes('minion')) return 'Minion Pro';
  if (lower.includes('source sans') || lower.includes('sourcesans')) return 'Source Sans 3';
  if (lower.includes('source serif') || lower.includes('sourceserif')) return 'Source Serif 4';
  if (lower.includes('source code') || lower.includes('sourcecode')) return 'Source Code Pro';
  if (lower.includes('palatino') || lower.includes('book antiqua')) return 'Palatino';
  if (lower.includes('century gothic')) return 'Century Gothic';
  if (lower.includes('futura')) return 'Futura';
  if (lower.includes('baskerville')) return 'Baskerville';
  if (lower.includes('caslon')) return 'Adobe Caslon Pro';
  if (lower.includes('symbol')) return 'Symbol';
  if (lower.includes('zapf') || lower.includes('dingbat') || lower.includes('wingding')) return 'ZapfDingbats';

  if (lower.includes('calibri')) return 'Calibri';
  if (lower.includes('arial')) return 'Arial';
  if (lower.includes('times') || lower.includes('roman')) return 'Times New Roman';
  if (lower.includes('segoe')) return 'Segoe UI';
  if (lower.includes('roboto')) return 'Roboto';
  if (lower.includes('georgia')) return 'Georgia';
  if (lower.includes('garamond')) return 'Garamond';
  if (lower.includes('cambria')) return 'Cambria';
  if (lower.includes('verdana')) return 'Verdana';
  if (lower.includes('tahoma')) return 'Tahoma';
  if (lower.includes('trebuchet')) return 'Trebuchet MS';
  if (lower.includes('courier')) return 'Courier New';
  if (lower.includes('consolas')) return 'Consolas';
  if (lower.includes('menlo')) return 'Menlo';
  if (lower.includes('helvetica')) return 'Helvetica';

  // Generic fallbacks (ensure 'sans' is checked before 'serif' to prevent sans-serif matching serif)
  if (lower.includes('sans')) return 'Arial';
  if (fallback === 'serif' || lower.includes('serif')) return 'Times New Roman';
  if (fallback === 'monospace' || lower.includes('mono') || lower.includes('code')) return 'Courier New';

  const stripped = clean
    .replace(/-(Bold|Italic|Regular|Roman|Light|Medium|Black|SemiBold|Oblique|BoldItalic)$/i, '')
    .replace(/(MT|PSMT|PS)$/i, '')
    .trim();

  return stripped || 'Arial';
}

/**
 * Generates high-fidelity CSS font-family stack with Adobe Pro & platform fallbacks.
 */
export function getFontCss(family: string): string {
  const f = (family || '').toLowerCase();

  // Adobe Pro & specialty typefaces
  if (f.includes('myriad')) return '"Myriad Pro", "Source Sans 3", "Segoe UI", Arial, sans-serif';
  if (f.includes('minion')) return '"Minion Pro", "Source Serif 4", "Times New Roman", Times, Georgia, serif';
  if (f.includes('source sans')) return '"Source Sans 3", "Source Sans Pro", "Segoe UI", Arial, sans-serif';
  if (f.includes('source serif')) return '"Source Serif 4", "Source Serif Pro", "Times New Roman", serif';
  if (f.includes('source code')) return '"Source Code Pro", Consolas, "Courier New", monospace';
  if (f.includes('palatino') || f.includes('book antiqua')) return '"Palatino Linotype", "Book Antiqua", Palatino, serif';
  if (f.includes('century gothic')) return '"Century Gothic", "Segoe UI", Arial, sans-serif';
  if (f.includes('futura')) return 'Futura, "Trebuchet MS", Arial, sans-serif';
  if (f.includes('baskerville')) return 'Baskerville, "Times New Roman", serif';
  if (f.includes('caslon')) return '"Adobe Caslon Pro", "Big Caslon", Georgia, serif';
  if (f.includes('symbol')) return 'Symbol, "Times New Roman", serif';
  if (f.includes('zapf') || f.includes('dingbat') || f.includes('wingding')) return '"Zapf Dingbats", Wingdings, sans-serif';

  // Standard typefaces
  if (f.includes('calibri')) return 'Calibri, "Segoe UI", Arial, sans-serif';
  if (f.includes('arial')) return 'Arial, Helvetica, sans-serif';
  if (f.includes('times') || f.includes('roman')) return '"Times New Roman", Times, Georgia, serif';
  if (f.includes('segoe')) return '"Segoe UI", Tahoma, Arial, sans-serif';
  if (f.includes('roboto')) return 'Roboto, "Segoe UI", Arial, sans-serif';
  if (f.includes('georgia')) return 'Georgia, "Times New Roman", serif';
  if (f.includes('garamond')) return 'Garamond, "Times New Roman", serif';
  if (f.includes('cambria')) return 'Cambria, Georgia, serif';
  if (f.includes('verdana')) return 'Verdana, Geneva, sans-serif';
  if (f.includes('tahoma')) return 'Tahoma, Arial, sans-serif';
  if (f.includes('trebuchet')) return '"Trebuchet MS", Helvetica, sans-serif';
  if (f.includes('courier')) return '"Courier New", Courier, monospace';
  if (f.includes('consolas')) return 'Consolas, "Courier New", monospace';
  if (f.includes('menlo')) return 'Menlo, Monaco, monospace';
  if (f.includes('helvetica')) return 'Helvetica, Arial, sans-serif';

  // Generic fallback: check 'sans' before 'serif'
  if (f.includes('sans')) return 'Arial, Helvetica, sans-serif';
  if (f.includes('serif')) return '"Times New Roman", Times, Georgia, serif';
  if (f.includes('mono')) return '"Courier New", Courier, monospace';
  return `"${family}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
}

/**
 * Smartly clusters individual text fragments and multi-line sections so that
 * paragraphs are edited as coherent units while preserving distinct table rows and columns.
 */
export function smartClusterSections(rawItems: DetectedTextItem[], pageIndex: number): DetectedTextItem[] {
  if (!rawItems || rawItems.length === 0) return [];

  // Step 1: Group items into horizontal rows using vertical baseline tolerance
  const sorted = [...rawItems].sort((a, b) => b.y - a.y);
  const rows: { y: number; fontSize: number; items: DetectedTextItem[] }[] = [];

  for (const item of sorted) {
    let placed = false;
    for (const r of rows) {
      if (Math.abs(r.y - item.y) <= Math.min(r.fontSize, item.fontSize) * 0.4) {
        r.items.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows.push({ y: item.y, fontSize: item.fontSize, items: [item] });
    }
  }

  // Sort rows top-to-bottom
  rows.sort((a, b) => b.y - a.y);

  // Step 2: On each row, sort left-to-right, merge words, and detect multi-column table rows
  interface RowData {
    y: number;
    isMultiColumn: boolean;
    segments: (DetectedTextItem & { isTable?: boolean; origBoxes: { x: number; y: number; width: number; height: number }[] })[];
  }

  const rowLinesList: RowData[] = [];
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
    const lineSegments: RowData['segments'] = [];

    for (const item of row.items) {
      let merged = false;
      for (const seg of lineSegments) {
        const sameFont = Math.abs(seg.fontSize - item.fontSize) <= 1.5;
        const gap = item.x - (seg.x + seg.width);
        const isWordGap = gap >= -2 && gap <= Math.max(6, seg.fontSize * 0.85);

        if (sameFont && isWordGap) {
          const needsSpace = gap > 0.5 && !seg.str.endsWith(' ') && !item.str.startsWith(' ');
          seg.str += (needsSpace ? ' ' : '') + item.str;
          seg.width = item.x + item.width - seg.x;
          seg.height = Math.max(seg.height, item.height);
          seg.isBold = seg.isBold || item.isBold;
          seg.isItalic = seg.isItalic || item.isItalic;
          seg.origBoxes.push({ x: item.x, y: item.y, width: item.width, height: item.height });
          merged = true;
          break;
        }
      }
      if (!merged) {
        lineSegments.push({
          ...item,
          origBoxes: [{ x: item.x, y: item.y, width: item.width, height: item.height }],
        });
      }
    }

    const isMultiColumn = lineSegments.length > 1;
    // Calculate column separation and widths for table cells so text doesn't prematurely wrap
    if (isMultiColumn) {
      for (let i = 0; i < lineSegments.length; i++) {
        const seg = lineSegments[i];
        seg.isTable = true;
        if (i < lineSegments.length - 1) {
          const nextSeg = lineSegments[i + 1];
          const availableColWidth = nextSeg.x - seg.x - 8;
          seg.width = Math.max(seg.width, availableColWidth);
        } else {
          seg.width = Math.max(seg.width, 50);
        }
      }
    }

    rowLinesList.push({
      y: row.y,
      isMultiColumn,
      segments: lineSegments,
    });
  }

  // Step 3: Cluster paragraphs while preserving table cells and handling intra-cell line wraps
  interface ClusterItem extends DetectedTextItem {
    isTable?: boolean;
    origYTop?: number;
    origBoxes: { x: number; y: number; width: number; height: number }[];
  }

  const clusters: ClusterItem[] = [];
  for (const rowData of rowLinesList) {
    if (rowData.isMultiColumn) {
      // Each cell in a multi-column table row is kept as an independent unit to preserve row layout & vertical alignment
      for (const seg of rowData.segments) {
        clusters.push({
          ...seg,
          origYTop: seg.y + seg.height,
        });
      }
      continue;
    }

    // Single segment row: could be paragraph continuation or intra-cell wrap
    const line = rowData.segments[0];
    let merged = false;

    for (let cIdx = clusters.length - 1; cIdx >= 0; cIdx--) {
      const cluster = clusters[cIdx];
      const sameFont =
        Math.abs(cluster.fontSize - line.fontSize) <= 1.5 &&
        cluster.fontFamily === line.fontFamily;
      if (!sameFont) continue;

      if (cluster.isTable) {
        // Table cell wrap: only merge if strictly in the same column and directly below
        const columnAligned = Math.abs(cluster.x - line.x) < 8;
        const lineDirectlyBelow =
          cluster.y - line.y > 0 &&
          cluster.y - line.y <= cluster.fontSize * 1.8;

        if (columnAligned && lineDirectlyBelow) {
          cluster.str += '\n' + line.str;
          cluster.y = line.y;
          cluster.height = (cluster.origYTop || cluster.y + cluster.height) - line.y;
          cluster.width = Math.max(cluster.width, line.width);
          cluster.origBoxes.push(...line.origBoxes);
          merged = true;
          break;
        }
        continue;
      }

      // Paragraph / Section merging for standard body text
      const verticalDist = cluster.y - line.y;
      const isLineDirectlyBelow =
        verticalDist > 0 && verticalDist <= cluster.fontSize * 2.2;

      const leftAligned = Math.abs(cluster.x - line.x) <= Math.max(15, cluster.fontSize * 1.5);
      const isIndented = line.x >= cluster.x && line.x <= cluster.x + 30;
      const xOverlap = Math.max(
        0,
        Math.min(cluster.x + cluster.width, line.x + line.width) - Math.max(cluster.x, line.x)
      );
      const hasSignificantOverlap = xOverlap >= Math.min(cluster.width, line.width) * 0.5;

      if (isLineDirectlyBelow && (leftAligned || isIndented || hasSignificantOverlap)) {
        const topY = cluster.origYTop ?? (cluster.y + cluster.height);
        const newY = line.y;
        const minX = Math.min(cluster.x, line.x);
        const maxX = Math.max(cluster.x + cluster.width, line.x + line.width);

        cluster.str += '\n' + line.str;
        cluster.x = minX;
        cluster.y = newY;
        cluster.origYTop = topY;
        cluster.width = maxX - minX;
        cluster.height = topY - newY;
        cluster.origBoxes.push(...line.origBoxes);
        merged = true;
        break;
      }
    }

    if (!merged) {
      clusters.push({
        ...line,
        origYTop: line.y + line.height,
        origBoxes: [...line.origBoxes],
      });
    }
  }

  return clusters.map((c, idx) => ({
    id: `text-${pageIndex}-${idx}`,
    str: c.str,
    x: c.x,
    y: c.y,
    width: c.width,
    height: c.height,
    origBoxes: c.origBoxes,
    fontSize: c.fontSize,
    fontName: c.fontName,
    fontFamily: c.fontFamily,
    isBold: c.isBold,
    isItalic: c.isItalic,
    transform: c.transform,
  }));
}

/**
 * Creates a sample demo PDF for instant testing
 */
export async function createSamplePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Page 1: Agreement
  const page1 = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page1.getSize();

  // Header banner
  page1.drawRectangle({
    x: 40,
    y: height - 100,
    width: width - 80,
    height: 60,
    color: rgb(0.12, 0.16, 0.23),
  });

  page1.drawText('PROPOSAL & SERVICE AGREEMENT', {
    x: 60,
    y: height - 68,
    size: 20,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page1.drawText('Client: Acme Innovations Inc.', {
    x: 45,
    y: height - 135,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  page1.drawText('Prepared By: Apex Engineering Solutions', {
    x: 45,
    y: height - 155,
    size: 11,
    font: fontRegular,
    color: rgb(0.35, 0.35, 0.35),
  });

  page1.drawText('Date: November 15, 2026', {
    x: 45,
    y: height - 172,
    size: 11,
    font: fontRegular,
    color: rgb(0.35, 0.35, 0.35),
  });

  // Section 1
  page1.drawText('1. Scope of Work', {
    x: 45,
    y: height - 215,
    size: 13,
    font: fontBold,
    color: rgb(0.12, 0.16, 0.23),
  });

  const scopeLines = [
    'The consultant shall provide full-lifecycle architectural review, cloud migration planning,',
    'and custom software development services as specified in Exhibit A.',
    'All deliverables will adhere to industry best practices for security and maintainability.',
  ];
  let currentY = height - 235;
  for (const line of scopeLines) {
    page1.drawText(line, {
      x: 45,
      y: currentY,
      size: 11,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2),
    });
    currentY -= 18;
  }

  // Section 2 - Pricing Table
  page1.drawText('2. Professional Fees & Deliverables Breakdown', {
    x: 45,
    y: height - 315,
    size: 13,
    font: fontBold,
    color: rgb(0.12, 0.16, 0.23),
  });

  // Table Header Background
  page1.drawRectangle({
    x: 45,
    y: height - 346,
    width: width - 90,
    height: 22,
    color: rgb(0.92, 0.94, 0.97),
  });

  page1.drawText('Deliverable / Item Description', {
    x: 52,
    y: height - 338,
    size: 10,
    font: fontBold,
    color: rgb(0.15, 0.2, 0.3),
  });

  page1.drawText('Hours', {
    x: 310,
    y: height - 338,
    size: 10,
    font: fontBold,
    color: rgb(0.15, 0.2, 0.3),
  });

  page1.drawText('Rate', {
    x: 375,
    y: height - 338,
    size: 10,
    font: fontBold,
    color: rgb(0.15, 0.2, 0.3),
  });

  page1.drawText('Amount', {
    x: 445,
    y: height - 338,
    size: 10,
    font: fontBold,
    color: rgb(0.15, 0.2, 0.3),
  });

  // Table Row 1
  page1.drawText('Cloud Architecture & Infrastructure Review', {
    x: 52,
    y: height - 364,
    size: 10,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
  });
  page1.drawText('40', {
    x: 310,
    y: height - 364,
    size: 10,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
  });
  page1.drawText('$175.00', {
    x: 375,
    y: height - 364,
    size: 10,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
  });
  page1.drawText('$7,000.00', {
    x: 445,
    y: height - 364,
    size: 10,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
  });

  // Table Row 2
  page1.drawText('Full-Stack Application Development', {
    x: 52,
    y: height - 384,
    size: 10,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
  });
  page1.drawText('80', {
    x: 310,
    y: height - 384,
    size: 10,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
  });
  page1.drawText('$175.00', {
    x: 375,
    y: height - 384,
    size: 10,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
  });
  page1.drawText('$14,000.00', {
    x: 445,
    y: height - 384,
    size: 10,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
  });

  // Table Row 3
  page1.drawText('Security Audit & Compliance Hardening', {
    x: 52,
    y: height - 404,
    size: 10,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
  });
  page1.drawText('20', {
    x: 310,
    y: height - 404,
    size: 10,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
  });
  page1.drawText('$175.00', {
    x: 375,
    y: height - 404,
    size: 10,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
  });
  page1.drawText('$3,500.00', {
    x: 445,
    y: height - 404,
    size: 10,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
  });

  // Total summary
  page1.drawText('Total Estimated Budget:', {
    x: 310,
    y: height - 428,
    size: 10,
    font: fontBold,
    color: rgb(0.12, 0.16, 0.23),
  });
  page1.drawText('$24,500.00 USD', {
    x: 445,
    y: height - 428,
    size: 10,
    font: fontBold,
    color: rgb(0.15, 0.45, 0.25),
  });

  page1.drawText('Invoices will be submitted bi-weekly and payable within Net 30 days.', {
    x: 45,
    y: height - 452,
    size: 10,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Callout box
  page1.drawRectangle({
    x: 45,
    y: height - 520,
    width: width - 90,
    height: 48,
    color: rgb(0.95, 0.97, 1.0),
    borderColor: rgb(0.7, 0.8, 0.95),
    borderWidth: 1,
  });

  page1.drawText('Tip: Click any cell or text in the table above to edit inline!', {
    x: 60,
    y: height - 498,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.3, 0.7),
  });

  // Signatures
  page1.drawText('Authorized Signature: ___________________________', {
    x: 45,
    y: height - 580,
    size: 11,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
  });

  page1.drawText('Date: _______________', {
    x: 400,
    y: height - 580,
    size: 11,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
  });

  // Page 2: Terms
  const page2 = doc.addPage([595.28, 841.89]);
  page2.drawText('TERMS & CONDITIONS', {
    x: 45,
    y: height - 70,
    size: 16,
    font: fontBold,
    color: rgb(0.12, 0.16, 0.23),
  });

  page2.drawText('Confidentiality & Non-Disclosure', {
    x: 45,
    y: height - 110,
    size: 12,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });

  page2.drawText(
    'Both parties agree to protect all proprietary and confidential trade secrets.',
    {
      x: 45,
      y: height - 130,
      size: 10,
      font: fontRegular,
      color: rgb(0.3, 0.3, 0.3),
    }
  );

  return await doc.save();
}
