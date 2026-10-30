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
    data,
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
 * Extracts text items from a page with their PDF bounding boxes
 */
export async function extractTextItems(
  doc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number
): Promise<DetectedTextItem[]> {
  try {
    const page = await doc.getPage(pageIndex + 1);
    const textContent = await page.getTextContent();
    const items: DetectedTextItem[] = [];

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
      const combined = `${rawFontName} ${styleFamily}`.toLowerCase();

      const isBold =
        combined.includes('bold') ||
        combined.includes('black') ||
        combined.includes('heavy') ||
        combined.includes('-b') ||
        combined.includes('_b');

      const isItalic =
        combined.includes('italic') ||
        combined.includes('oblique');

      let fontFamily = 'Helvetica';
      if (
        combined.includes('times') ||
        combined.includes('serif') ||
        combined.includes('roman') ||
        combined.includes('georgia')
      ) {
        fontFamily = 'Times';
      } else if (
        combined.includes('courier') ||
        combined.includes('mono') ||
        combined.includes('consolas')
      ) {
        fontFamily = 'Courier';
      }

      // PDF coordinates: bounding box bottom edge is baseline minus descent (approx 20% of fontSize)
      const x = tx;
      const y = ty - fontSize * 0.2;
      const width = item.width || item.str.length * fontSize * 0.55;
      const height = Math.max(fontSize * 1.2, item.height || fontSize);

      items.push({
        id: `text-${pageIndex}-${idx}`,
        str: item.str,
        x,
        y,
        width,
        height,
        fontSize: Math.round(fontSize * 10) / 10,
        fontName: rawFontName,
        fontFamily,
        isBold,
        isItalic,
        transform: item.transform,
      });
    });

    return items;
  } catch (err) {
    console.error('Error extracting text items:', err);
    return [];
  }
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

  // Section 2 - Pricing
  page1.drawText('2. Professional Fees & Payment Terms', {
    x: 45,
    y: height - 315,
    size: 13,
    font: fontBold,
    color: rgb(0.12, 0.16, 0.23),
  });

  page1.drawText('Standard Consulting Rate: $175.00 per hour', {
    x: 45,
    y: height - 338,
    size: 11,
    font: fontBold,
    color: rgb(0.15, 0.45, 0.25),
  });

  page1.drawText('Estimated Project Budget: $24,500.00 USD', {
    x: 45,
    y: height - 358,
    size: 11,
    font: fontBold,
    color: rgb(0.15, 0.45, 0.25),
  });

  page1.drawText('Invoices will be submitted bi-weekly and payable within Net 30 days.', {
    x: 45,
    y: height - 380,
    size: 10,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Callout box
  page1.drawRectangle({
    x: 45,
    y: height - 460,
    width: width - 90,
    height: 55,
    color: rgb(0.95, 0.97, 1.0),
    borderColor: rgb(0.7, 0.8, 0.95),
    borderWidth: 1,
  });

  page1.drawText('Tip: Click any text above to edit it in place directly!', {
    x: 60,
    y: height - 435,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.3, 0.7),
  });

  // Signatures
  page1.drawText('Authorized Signature: ___________________________', {
    x: 45,
    y: height - 540,
    size: 11,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
  });

  page1.drawText('Date: _______________', {
    x: 400,
    y: height - 540,
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
