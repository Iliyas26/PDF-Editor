# PDF Studio

A private, client-side, in-place PDF editor built with React, TypeScript, Tailwind CSS, PDF.js, and `pdf-lib`.

---

## ✨ Key Features

- **Direct In-Place Text Editing**: Click any text block or paragraph in the PDF to edit it inline with automatic font, size, and color matching.
- **Visual Page Management**: Drag-and-drop page reordering, 90° rotation, page duplication, deletion, and blank page insertion.
- **Merge & Append PDFs**: Import pages from other PDF files into the active document with 1 click.
- **Vector Elements & Shapes**: Insert customizable text boxes, upload images/logos, and draw geometric shapes (rectangles, lines, arrows) with live drag and position controls.
- **Precision Export**: Re-stamps edited text over vector masks using standard fonts, keeping exported PDFs compact, crisp, and searchable.
- **100% Client-Side Privacy**: Runs completely in the browser—files and edits never leave your device.
- **Productivity Hotkeys**:
  - `Ctrl + Z`: Undo
  - `Ctrl + Y` / `Ctrl + Shift + Z`: Redo
  - `Ctrl + S`: Download/Export PDF
  - `Ctrl + =` / `Ctrl + -`: Zoom in / Zoom out
  - `Esc`: Cancel selection / edit

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Local Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Run Self-Check Tests
```bash
npm test
```

### 4. Build for Production / GitHub Pages
```bash
npm run build
```
The output will be in the `dist/` directory, ready to deploy to GitHub Pages, Vercel, or Netlify.

---

## 🔒 Privacy Guarantee
All PDF parsing, text extraction, manipulation, and compilation happen directly inside browser memory via WebAssembly/Canvas and `pdf-lib`. No backend server or cloud upload is used.
