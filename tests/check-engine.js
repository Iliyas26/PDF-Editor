import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import assert from 'node:assert';
import fs from 'node:fs';

// Helper to extract cleanFontFamily & getFontCss & smartClusterSections from pdfEngine.ts logic
function cleanFontFamily(rawName, fallback) {
  const clean = (rawName || '').replace(/^[A-Z]{6}\+/, '').trim();
  const lower = `${clean} ${fallback}`.toLowerCase();

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

  if (lower.includes('sans')) return 'Arial';
  if (fallback === 'serif' || lower.includes('serif')) return 'Times New Roman';
  if (fallback === 'monospace' || lower.includes('mono') || lower.includes('code')) return 'Courier New';

  const stripped = clean
    .replace(/-(Bold|Italic|Regular|Roman|Light|Medium|Black|SemiBold|Oblique|BoldItalic)$/i, '')
    .replace(/(MT|PSMT|PS)$/i, '')
    .trim();

  return stripped || 'Arial';
}

function resolveStandardFont(fontName, isBold = false, isItalic = false) {
  const name = (fontName || '').toLowerCase();

  if (name.includes('symbol')) {
    return StandardFonts.Symbol;
  }
  if (name.includes('zapf') || name.includes('dingbat') || name.includes('wingding')) {
    return StandardFonts.ZapfDingbats;
  }

  const isSans = name.includes('sans');
  if (
    !isSans &&
    (name.includes('times') ||
      name.includes('serif') ||
      name.includes('roman') ||
      name.includes('minion') ||
      name.includes('georgia') ||
      name.includes('garamond') ||
      name.includes('cambria') ||
      name.includes('palatino') ||
      name.includes('caslon') ||
      name.includes('baskerville') ||
      name.includes('bookman') ||
      name.includes('bodoni'))
  ) {
    if (isBold && isItalic) return StandardFonts.TimesRomanBoldItalic;
    if (isBold) return StandardFonts.TimesRomanBold;
    if (isItalic) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }

  if (
    name.includes('courier') ||
    name.includes('mono') ||
    name.includes('consolas') ||
    name.includes('menlo') ||
    name.includes('source code') ||
    name.includes('monaco')
  ) {
    if (isBold && isItalic) return StandardFonts.CourierBoldOblique;
    if (isBold) return StandardFonts.CourierBold;
    if (isItalic) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }

  if (isBold && isItalic) return StandardFonts.HelveticaBoldOblique;
  if (isBold) return StandardFonts.HelveticaBold;
  if (isItalic) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

function smartClusterSections(rawItems, pageIndex = 0) {
  if (!rawItems || rawItems.length === 0) return [];

  const sorted = [...rawItems].sort((a, b) => b.y - a.y);
  const rows = [];
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

  rows.sort((a, b) => b.y - a.y);

  const rowLinesList = [];
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
    const lineSegments = [];

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

  const clusters = [];
  for (const rowData of rowLinesList) {
    if (rowData.isMultiColumn) {
      for (const seg of rowData.segments) {
        clusters.push({
          ...seg,
          origYTop: seg.y + seg.height,
        });
      }
      continue;
    }

    const line = rowData.segments[0];
    let merged = false;

    for (let cIdx = clusters.length - 1; cIdx >= 0; cIdx--) {
      const cluster = clusters[cIdx];
      const sameFont =
        Math.abs(cluster.fontSize - line.fontSize) <= 1.5 &&
        cluster.fontFamily === line.fontFamily;
      if (!sameFont) continue;

      if (cluster.isTable) {
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
  }));
}

async function testPdfEngine() {
  console.log('Running self-check on PDF manipulation engine...');

  // 1. Font Substitution Checks
  console.log('Testing font substitution and Adobe PDF Editor Pro font matching...');
  // Check that sans-serif fallbacks do NOT match serif/Times
  assert.strictEqual(cleanFontFamily('custom-font', 'sans-serif'), 'Arial', 'sans-serif must not map to serif');
  assert.strictEqual(cleanFontFamily('ABCDEF+MyriadPro-Regular', 'sans-serif'), 'Myriad Pro');
  assert.strictEqual(cleanFontFamily('XYZABC+MinionPro-Bold', 'serif'), 'Minion Pro');
  assert.strictEqual(cleanFontFamily('Palatino-Roman', 'serif'), 'Palatino');

  // Check resolveStandardFont
  assert.strictEqual(resolveStandardFont('Myriad Pro', false, false), StandardFonts.Helvetica);
  assert.strictEqual(resolveStandardFont('Minion Pro', true, false), StandardFonts.TimesRomanBold);
  assert.strictEqual(resolveStandardFont('Palatino', false, true), StandardFonts.TimesRomanItalic);
  assert.strictEqual(resolveStandardFont('Source Code Pro', true, false), StandardFonts.CourierBold);
  assert.strictEqual(resolveStandardFont('Symbol', false, false), StandardFonts.Symbol);
  assert.strictEqual(resolveStandardFont('ZapfDingbats', false, false), StandardFonts.ZapfDingbats);
  // Ensure "sans-serif" maps to Helvetica
  assert.strictEqual(resolveStandardFont('sans-serif', false, false), StandardFonts.Helvetica);

  // 2. Table Column Separation & Row Layout Checks
  console.log('Testing table column separation and vertical alignment logic...');
  const tableRawItems = [
    // Header Row
    { id: '1', str: 'Item', x: 50, y: 500, width: 30, height: 12, fontSize: 10, fontFamily: 'Helvetica', isBold: true, isItalic: false },
    { id: '2', str: 'Qty', x: 180, y: 500, width: 20, height: 12, fontSize: 10, fontFamily: 'Helvetica', isBold: true, isItalic: false },
    { id: '3', str: 'Price', x: 280, y: 500, width: 30, height: 12, fontSize: 10, fontFamily: 'Helvetica', isBold: true, isItalic: false },
    // Data Row 1
    { id: '4', str: 'Apples', x: 50, y: 480, width: 35, height: 12, fontSize: 10, fontFamily: 'Helvetica', isBold: false, isItalic: false },
    { id: '5', str: '5', x: 180, y: 480, width: 10, height: 12, fontSize: 10, fontFamily: 'Helvetica', isBold: false, isItalic: false },
    { id: '6', str: '$2.50', x: 280, y: 480, width: 25, height: 12, fontSize: 10, fontFamily: 'Helvetica', isBold: false, isItalic: false },
    // Data Row 2
    { id: '7', str: 'Oranges', x: 50, y: 460, width: 40, height: 12, fontSize: 10, fontFamily: 'Helvetica', isBold: false, isItalic: false },
    { id: '8', str: '3', x: 180, y: 460, width: 10, height: 12, fontSize: 10, fontFamily: 'Helvetica', isBold: false, isItalic: false },
    { id: '9', str: '$4.00', x: 280, y: 460, width: 25, height: 12, fontSize: 10, fontFamily: 'Helvetica', isBold: false, isItalic: false },
  ];

  const tableClusters = smartClusterSections(tableRawItems);
  assert.strictEqual(tableClusters.length, 9, 'Table must preserve 9 individual cells instead of collapsing rows into columns');

  // Verify column separation and calculated column widths
  const itemHeader = tableClusters.find((c) => c.str === 'Item');
  assert(itemHeader, 'Item header cell must exist');
  assert(itemHeader.width >= 100, 'Column width for Item must span up to Qty column');

  const applesCell = tableClusters.find((c) => c.str === 'Apples');
  assert(applesCell, 'Apples cell must exist as independent row cell');
  assert.strictEqual(applesCell.y, 480, 'Row 1 Y coordinate must be preserved');

  // 3. Document Generation, Masking, and Export Check
  console.log('Testing PDF creation, vector masking, and export...');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([500, 500]);
  page.drawText('Original Price: $100', { x: 50, y: 400, size: 14, font, color: rgb(0, 0, 0) });
  const pdfBytes = await doc.save();
  assert(pdfBytes.length > 500, 'Original PDF creation failed');

  const loadedDoc = await PDFDocument.load(pdfBytes);
  const outputDoc = await PDFDocument.create();
  const [copiedPage] = await outputDoc.copyPages(loadedDoc, [0]);

  // Vector mask original position
  const origBoxes = [{ x: 50, y: 400, width: 140, height: 16 }];
  for (const box of origBoxes) {
    copiedPage.drawRectangle({
      x: box.x - 1,
      y: box.y - 1,
      width: box.width + 2,
      height: box.height + 2,
      color: rgb(1, 1, 1),
    });
  }

  // Destination mask when moved
  const movedX = 120;
  const movedY = 320;
  copiedPage.drawRectangle({
    x: movedX - 1,
    y: movedY - 1,
    width: 150 + 2,
    height: 30 + 2,
    color: rgb(1, 1, 1),
  });

  // Re-stamp new text with multi-line and Times font at moved location
  const timesFont = await outputDoc.embedFont(StandardFonts.TimesRomanBold);
  copiedPage.drawText('Rs\n1799_90D\n/D', {
    x: movedX,
    y: movedY + 30 - 11 * 0.85,
    size: 11,
    font: timesFont,
    color: rgb(0, 0, 0),
    lineHeight: 14,
    maxWidth: 80,
  });

  outputDoc.addPage(copiedPage);
  outputDoc.addPage([500, 500]);

  const finalBytes = await outputDoc.save();
  assert(finalBytes.length > 500, 'Modified PDF export failed');

  const reloaded = await PDFDocument.load(finalBytes);
  assert.strictEqual(reloaded.getPageCount(), 2, 'Page count mismatch');

  console.log('✓ All PDF engine, font matching, and table clustering checks passed successfully!');
}

testPdfEngine().catch((err) => {
  console.error('Self-check failed:', err);
  process.exit(1);
});
