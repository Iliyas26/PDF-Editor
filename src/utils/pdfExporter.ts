import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { PageDescriptor, TextEditItem, ImageEditItem, CustomElement, ImportedDocument } from '../types';

/**
 * Maps a font name to the closest StandardFonts enum matching Adobe PDF Editor Pro typefaces.
 */
export function resolveStandardFont(fontName: string, isBold: boolean = false, isItalic: boolean = false): StandardFonts {
  const name = (fontName || '').toLowerCase();

  // 1. Symbol & Dingbats
  if (name.includes('symbol')) {
    return StandardFonts.Symbol;
  }
  if (name.includes('zapf') || name.includes('dingbat') || name.includes('wingding')) {
    return StandardFonts.ZapfDingbats;
  }

  // 2. Serif fonts (Adobe Minion Pro, Times, Georgia, Garamond, Cambria, Palatino, Caslon, Baskerville)
  // Ensure "sans-serif" does NOT match serif!
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

  // 3. Monospace fonts (Courier, Consolas, Menlo, Monaco, Source Code Pro)
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

  // 4. Default to Helvetica (Adobe Myriad Pro, Arial, Calibri, Segoe UI, Roboto, Helvetica, etc.)
  if (isBold && isItalic) return StandardFonts.HelveticaBoldOblique;
  if (isBold) return StandardFonts.HelveticaBold;
  if (isItalic) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

/**
 * Converts a hex color string to PDF rgb (0-1)
 */
function hexToPdfRgb(hex: string = '#000000') {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;
  return rgb(r, g, b);
}

/**
 * Helper to convert base64 data URL to Uint8Array
 */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const parts = dataUrl.split(',');
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return u8arr;
}

/**
 * Builds and exports the updated PDF document
 */
export async function exportModifiedPdf(params: {
  originalBytes: Uint8Array;
  pages: PageDescriptor[];
  textEdits: TextEditItem[];
  imageEdits: ImageEditItem[];
  customElements: CustomElement[];
  importedDocs: Map<string, ImportedDocument>;
}): Promise<Uint8Array> {
  const { originalBytes, pages, textEdits, imageEdits, customElements, importedDocs } = params;

  if (pages.length === 0) {
    throw new Error('Cannot export: document has no pages.');
  }

  // Load primary document
  const mainPdfDoc = await PDFDocument.load(originalBytes);

  // Load any imported documents
  const loadedImportedDocs = new Map<string, PDFDocument>();
  for (const [key, impDoc] of importedDocs.entries()) {
    const doc = await PDFDocument.load(impDoc.bytes);
    loadedImportedDocs.set(key, doc);
  }

  // Create final output document
  const outputDoc = await PDFDocument.create();

  // Pre-embed standard fonts into output document for reuse
  const fontCache = new Map<StandardFonts, any>();
  async function getFont(fontEnum: StandardFonts) {
    if (!fontCache.has(fontEnum)) {
      const embedded = await outputDoc.embedFont(fontEnum);
      fontCache.set(fontEnum, embedded);
    }
    return fontCache.get(fontEnum);
  }

  // Process each page in target order
  for (const pageDesc of pages) {
    let targetPage: any;
    let alreadyAdded = false;

    if (pageDesc.source === 'original') {
      const [copiedPage] = await outputDoc.copyPages(mainPdfDoc, [pageDesc.sourcePageIndex]);
      targetPage = copiedPage;
    } else if (pageDesc.source === 'imported' && pageDesc.importedDocKey) {
      const impDoc = loadedImportedDocs.get(pageDesc.importedDocKey);
      if (impDoc) {
        const [copiedPage] = await outputDoc.copyPages(impDoc, [pageDesc.sourcePageIndex]);
        targetPage = copiedPage;
      } else {
        // fallback: imported doc missing — treat as blank
        targetPage = outputDoc.addPage([pageDesc.width, pageDesc.height]);
        alreadyAdded = true;
      }
    } else {
      // Blank page
      targetPage = outputDoc.addPage([pageDesc.width, pageDesc.height]);
      alreadyAdded = true;
    }

    // Apply rotation
    if (pageDesc.rotation) {
      targetPage.setRotation(degrees(pageDesc.rotation));
    }

    // 1. Apply Text Edits for this page
    const pageTextEdits = textEdits.filter((t) => t.pageId === pageDesc.id);
    for (const edit of pageTextEdits) {
      // Vector whiteout mask over all original text area(s)
      if (edit.origBoxes && edit.origBoxes.length > 0) {
        for (const box of edit.origBoxes) {
          targetPage.drawRectangle({
            x: box.x - 1,
            y: box.y - 1,
            width: box.width + 2,
            height: box.height + 2,
            color: rgb(1, 1, 1),
          });
        }
      } else {
        const maskX = edit.origX ?? edit.x;
        const maskY = edit.origY ?? edit.y;
        const maskW = edit.origWidth ?? edit.width;
        const maskH = edit.origHeight ?? edit.height;
        targetPage.drawRectangle({
          x: maskX - 1,
          y: maskY - 1,
          width: maskW + 2,
          height: maskH + 2,
          color: rgb(1, 1, 1),
        });
      }

      // Re-stamp new text if not deleted and not empty
      if (!edit.isDeleted && edit.newText && edit.newText.trim().length > 0) {
        const hasMoved =
          edit.origX !== undefined &&
          edit.origY !== undefined &&
          (Math.abs(edit.x - edit.origX) > 1 || Math.abs(edit.y - edit.origY) > 1);

        // If moved, also mask the destination bounds to cleanly accept new text
        if (hasMoved) {
          targetPage.drawRectangle({
            x: edit.x - 1,
            y: edit.y - 1,
            width: edit.width + 2,
            height: edit.height + 2,
            color: rgb(1, 1, 1),
          });
        }

        const isBold = edit.isBold ?? edit.fontFamily.toLowerCase().includes('bold');
        const isItalic =
          edit.isItalic ??
          (edit.fontFamily.toLowerCase().includes('italic') ||
            edit.fontFamily.toLowerCase().includes('oblique'));
        const fontEnum = resolveStandardFont(edit.fontFamily, isBold, isItalic);
        const font = await getFont(fontEnum);

        // Position text baseline at top of box minus font ascent, wrap inside box width
        targetPage.drawText(edit.newText.replace(/\u2011/g, '-'), {
          x: edit.x,
          y: edit.y + edit.height - edit.fontSize * 0.85,
          size: edit.fontSize,
          font,
          color: rgb(edit.color.r, edit.color.g, edit.color.b),
          maxWidth: Math.max(edit.width, 40),
          lineHeight: edit.fontSize * 1.25,
        });
      }
    }

    // 2. Apply Image Edits for this page
    const pageImgEdits = imageEdits.filter((img) => img.pageId === pageDesc.id);
    for (const imgEdit of pageImgEdits) {
      // Mask original area
      targetPage.drawRectangle({
        x: imgEdit.x,
        y: imgEdit.y,
        width: imgEdit.width,
        height: imgEdit.height,
        color: rgb(1, 1, 1),
      });

      // If replacement image provided, embed and draw
      if (!imgEdit.isDeleted && imgEdit.replacementDataUrl) {
        try {
          const imageBytes = dataUrlToBytes(imgEdit.replacementDataUrl);
          const isPng = imgEdit.replacementDataUrl.startsWith('data:image/png');
          const embeddedImage = isPng
            ? await outputDoc.embedPng(imageBytes)
            : await outputDoc.embedJpg(imageBytes);

          targetPage.drawImage(embeddedImage, {
            x: imgEdit.x,
            y: imgEdit.y,
            width: imgEdit.width,
            height: imgEdit.height,
          });
        } catch (imgErr) {
          console.error('Failed to embed replacement image:', imgErr);
        }
      }
    }

    // 3. Apply Custom Elements (new text, image, shapes)
    const pageCustomElements = customElements.filter((elem) => elem.pageId === pageDesc.id);
    for (const elem of pageCustomElements) {
      if (elem.type === 'text' && elem.text) {
        const font = await getFont(StandardFonts.Helvetica);
        const color = hexToPdfRgb(elem.textColor || '#000000');
        targetPage.drawText(elem.text.replace(/\u2011/g, '-'), {
          x: elem.x,
          y: elem.y,
          size: elem.fontSize || 14,
          font,
          color,
        });
      } else if (elem.type === 'image' && elem.imageDataUrl) {
        try {
          const imageBytes = dataUrlToBytes(elem.imageDataUrl);
          const isPng = elem.imageDataUrl.startsWith('data:image/png');
          const embeddedImage = isPng
            ? await outputDoc.embedPng(imageBytes)
            : await outputDoc.embedJpg(imageBytes);

          targetPage.drawImage(embeddedImage, {
            x: elem.x,
            y: elem.y,
            width: elem.width,
            height: elem.height,
          });
        } catch (err) {
          console.error('Failed to draw custom image element:', err);
        }
      } else if (elem.type === 'rectangle') {
        const strokeColor = elem.strokeColor ? hexToPdfRgb(elem.strokeColor) : undefined;
        const fillColor = elem.fillColor && elem.fillColor !== 'transparent' ? hexToPdfRgb(elem.fillColor) : undefined;

        targetPage.drawRectangle({
          x: elem.x,
          y: elem.y,
          width: elem.width,
          height: elem.height,
          borderColor: strokeColor,
          borderWidth: elem.strokeWidth || 2,
          color: fillColor,
        });
      } else if (elem.type === 'line') {
        const strokeColor = hexToPdfRgb(elem.strokeColor || '#2563eb');
        targetPage.drawLine({
          start: { x: elem.x, y: elem.y },
          end: { x: elem.x + elem.width, y: elem.y + elem.height },
          thickness: elem.strokeWidth || 2,
          color: strokeColor,
        });
      } else if (elem.type === 'arrow') {
        const strokeColor = hexToPdfRgb(elem.strokeColor || '#2563eb');
        const startX = elem.x;
        const startY = elem.y;
        const endX = elem.x + elem.width;
        const endY = elem.y + elem.height;

        targetPage.drawLine({
          start: { x: startX, y: startY },
          end: { x: endX, y: endY },
          thickness: elem.strokeWidth || 2,
          color: strokeColor,
        });

        // Arrowhead calculations
        const angle = Math.atan2(endY - startY, endX - startX);
        const headLength = 10;
        const arrowAngle = Math.PI / 7;

        targetPage.drawLine({
          start: { x: endX, y: endY },
          end: {
            x: endX - headLength * Math.cos(angle - arrowAngle),
            y: endY - headLength * Math.sin(angle - arrowAngle),
          },
          thickness: elem.strokeWidth || 2,
          color: strokeColor,
        });

        targetPage.drawLine({
          start: { x: endX, y: endY },
          end: {
            x: endX - headLength * Math.cos(angle + arrowAngle),
            y: endY - headLength * Math.sin(angle + arrowAngle),
          },
          thickness: elem.strokeWidth || 2,
          color: strokeColor,
        });
      }
    }

    // Add configured page to output document if not already added
    if (!alreadyAdded) {
      outputDoc.addPage(targetPage);
    }
  }

  return await outputDoc.save();
}

/**
 * Triggers a browser download of the generated PDF bytes
 */
export function downloadPdf(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes as any], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
