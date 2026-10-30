import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import assert from 'node:assert';

async function testPdfEngine() {
  console.log('Running self-check on PDF manipulation engine...');

  // 1. Create a PDF with text
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([500, 500]);
  page.drawText('Original Price: $100', { x: 50, y: 400, size: 14, font, color: rgb(0, 0, 0) });
  const pdfBytes = await doc.save();
  assert(pdfBytes.length > 500, 'Original PDF creation failed');

  // 2. Modify: Mask and re-stamp
  const loadedDoc = await PDFDocument.load(pdfBytes);
  const outputDoc = await PDFDocument.create();
  const [copiedPage] = await outputDoc.copyPages(loadedDoc, [0]);
  
  // Mask
  copiedPage.drawRectangle({
    x: 48,
    y: 398,
    width: 150,
    height: 18,
    color: rgb(1, 1, 1),
  });

  // Re-stamp new text with multi-line and Times font
  const timesFont = await outputDoc.embedFont(StandardFonts.TimesRomanBold);
  copiedPage.drawText('Rs\n1799_90D\n/D', {
    x: 50,
    y: 350,
    size: 11,
    font: timesFont,
    color: rgb(0, 0, 0),
    lineHeight: 14,
    maxWidth: 80,
  });

  outputDoc.addPage(copiedPage);

  // Add blank page
  outputDoc.addPage([500, 500]);

  const finalBytes = await outputDoc.save();
  assert(finalBytes.length > 500, 'Modified PDF export failed');

  // Verify page count is 2
  const reloaded = await PDFDocument.load(finalBytes);
  assert.strictEqual(reloaded.getPageCount(), 2, 'Page count mismatch');

  console.log('✓ PDF manipulation engine self-check passed successfully!');
}

testPdfEngine().catch((err) => {
  console.error('Self-check failed:', err);
  process.exit(1);
});
