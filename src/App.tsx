import React, { useState, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ActiveTool,
  PageDescriptor,
  TextEditItem,
  ImageEditItem,
  CustomElement,
  ImportedDocument,
  EditorHistorySnapshot
} from './types';
import { loadPdf, getDocumentPages, createSamplePdf } from './utils/pdfEngine';
import { exportModifiedPdf, downloadPdf } from './utils/pdfExporter';
import { Navbar } from './components/Navbar';
import { Toolbar } from './components/Toolbar';
import { ThumbnailSidebar } from './components/ThumbnailSidebar';
import { PdfPageView } from './components/PdfPageView';
import { LandingView } from './components/LandingView';

export function App() {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Document state
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [fileName, setFileName] = useState<string>('Document.pdf');
  const [pages, setPages] = useState<PageDescriptor[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [importedDocs, setImportedDocs] = useState<Map<string, ImportedDocument>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Editor configuration
  const [zoom, setZoom] = useState<number>(1.0);
  const [activeTool, setActiveTool] = useState<ActiveTool>('editText');
  const [currentColor, setCurrentColor] = useState<string>('#2563eb');
  const [strokeWidth, setStrokeWidth] = useState<number>(2);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Modifications state
  const [textEdits, setTextEdits] = useState<TextEditItem[]>([]);
  const [imageEdits, setImageEdits] = useState<ImageEditItem[]>([]);
  const [customElements, setCustomElements] = useState<CustomElement[]>([]);

  // Undo / Redo History Stacks
  const [undoStack, setUndoStack] = useState<EditorHistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<EditorHistorySnapshot[]>([]);

  // Capture current state snapshot for undo
  const recordHistory = useCallback(() => {
    const snapshot: EditorHistorySnapshot = {
      pages: JSON.parse(JSON.stringify(pages)),
      textEdits: JSON.parse(JSON.stringify(textEdits)),
      imageEdits: JSON.parse(JSON.stringify(imageEdits)),
      customElements: JSON.parse(JSON.stringify(customElements)),
    };
    setUndoStack((prev) => [...prev.slice(-30), snapshot]); // keep last 30 actions
    setRedoStack([]); // clear redo stack on new action
  }, [pages, textEdits, imageEdits, customElements]);

  // Undo action
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;

    const currentSnapshot: EditorHistorySnapshot = {
      pages: JSON.parse(JSON.stringify(pages)),
      textEdits: JSON.parse(JSON.stringify(textEdits)),
      imageEdits: JSON.parse(JSON.stringify(imageEdits)),
      customElements: JSON.parse(JSON.stringify(customElements)),
    };

    const previousSnapshot = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setRedoStack((prev) => [...prev, currentSnapshot]);

    setPages(previousSnapshot.pages);
    setTextEdits(previousSnapshot.textEdits);
    setImageEdits(previousSnapshot.imageEdits);
    setCustomElements(previousSnapshot.customElements);
  }, [undoStack, pages, textEdits, imageEdits, customElements]);

  // Redo action
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;

    const currentSnapshot: EditorHistorySnapshot = {
      pages: JSON.parse(JSON.stringify(pages)),
      textEdits: JSON.parse(JSON.stringify(textEdits)),
      imageEdits: JSON.parse(JSON.stringify(imageEdits)),
      customElements: JSON.parse(JSON.stringify(customElements)),
    };

    const nextSnapshot = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setUndoStack((prev) => [...prev, currentSnapshot]);

    setPages(nextSnapshot.pages);
    setTextEdits(nextSnapshot.textEdits);
    setImageEdits(nextSnapshot.imageEdits);
    setCustomElements(nextSnapshot.customElements);
  }, [redoStack, pages, textEdits, imageEdits, customElements]);

  // Load a PDF file
  const handleOpenFile = async (file: File) => {
    setIsLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const doc = await loadPdf(bytes);
      const initialPages = await getDocumentPages(doc);

      setPdfBytes(bytes);
      setPdfDoc(doc);
      setFileName(file.name.replace(/\.[^/.]+$/, ''));
      setPages(initialPages);
      setCurrentPageIndex(0);
      setTextEdits([]);
      setImageEdits([]);
      setCustomElements([]);
      setUndoStack([]);
      setRedoStack([]);
      setImportedDocs(new Map());
    } catch (err) {
      console.error('Failed to open PDF:', err);
      alert('Unable to load this PDF. Please check the file format.');
    } finally {
      setIsLoading(false);
    }
  };

  // 1-Click Sample PDF loader
  const handleOpenSample = async () => {
    setIsLoading(true);
    try {
      const bytes = await createSamplePdf();
      const doc = await loadPdf(bytes);
      const initialPages = await getDocumentPages(doc);

      setPdfBytes(bytes);
      setPdfDoc(doc);
      setFileName('Sample_Agreement');
      setPages(initialPages);
      setCurrentPageIndex(0);
      setTextEdits([]);
      setImageEdits([]);
      setCustomElements([]);
      setUndoStack([]);
      setRedoStack([]);
      setImportedDocs(new Map());
    } catch (err) {
      console.error('Failed to generate sample PDF:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Close current document
  const handleNewDocument = () => {
    if (textEdits.length > 0 || customElements.length > 0) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to open a new document?')) {
        return;
      }
    }
    setPdfBytes(null);
    setPdfDoc(null);
    setPages([]);
    setTextEdits([]);
    setImageEdits([]);
    setCustomElements([]);
  };

  // Export modified PDF
  const handleExport = async () => {
    if (!pdfBytes) return;
    setIsExporting(true);
    try {
      const exportedBytes = await exportModifiedPdf({
        originalBytes: pdfBytes,
        pages,
        textEdits,
        imageEdits,
        customElements,
        importedDocs,
      });
      downloadPdf(exportedBytes, `${fileName}-edited.pdf`);
    } catch (err) {
      console.error('Export failed:', err);
      alert('An error occurred during export. Please check the console.');
    } finally {
      setIsExporting(false);
    }
  };

  // Page Operations
  const handleMovePage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= pages.length) return;
    recordHistory();
    const newPages = [...pages];
    const [moved] = newPages.splice(fromIndex, 1);
    newPages.splice(toIndex, 0, moved);
    setPages(newPages);
    setCurrentPageIndex(toIndex);
  };

  const handleRotatePage = (pageId: string) => {
    recordHistory();
    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, rotation: (p.rotation + 90) % 360 } : p))
    );
  };

  const handleDuplicatePage = (pageId: string) => {
    recordHistory();
    const idx = pages.findIndex((p) => p.id === pageId);
    if (idx === -1) return;
    const original = pages[idx];
    const duplicated: PageDescriptor = {
      ...original,
      id: `page-dup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    const newPages = [...pages];
    newPages.splice(idx + 1, 0, duplicated);
    setPages(newPages);
    setCurrentPageIndex(idx + 1);
  };

  const handleDeletePage = (pageId: string) => {
    if (pages.length <= 1) return;
    recordHistory();
    const newPages = pages.filter((p) => p.id !== pageId);
    setPages(newPages);
    if (currentPageIndex >= newPages.length) {
      setCurrentPageIndex(Math.max(0, newPages.length - 1));
    }
  };

  const handleAddBlankPage = () => {
    recordHistory();
    const blankPage: PageDescriptor = {
      id: `page-blank-${Date.now()}`,
      source: 'blank',
      sourcePageIndex: 0,
      rotation: 0,
      width: 595.28, // A4 standard
      height: 841.89,
    };
    setPages((prev) => [...prev, blankPage]);
    setCurrentPageIndex(pages.length);
  };

  const handleImportPdf = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const doc = await loadPdf(bytes);
      const docKey = `import-${Date.now()}`;

      setImportedDocs((prev) => {
        const next = new Map(prev);
        next.set(docKey, { id: docKey, name: file.name, bytes });
        return next;
      });

      recordHistory();
      const importedPageDescriptors: PageDescriptor[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const p = await doc.getPage(i);
        const vp = p.getViewport({ scale: 1 });
        importedPageDescriptors.push({
          id: `page-imp-${docKey}-${i}`,
          source: 'imported',
          sourcePageIndex: i - 1,
          importedDocKey: docKey,
          rotation: p.rotate || 0,
          width: vp.width,
          height: vp.height,
        });
      }

      setPages((prev) => [...prev, ...importedPageDescriptors]);
    } catch (err) {
      console.error('Failed to import PDF pages:', err);
      alert('Could not merge the selected PDF.');
    }
  };

  // Add custom image element
  const handleAddImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const currentPage = pages[currentPageIndex];
      if (!currentPage) return;

      const newElem: CustomElement = {
        id: `elem-img-${Date.now()}`,
        pageId: currentPage.id,
        type: 'image',
        x: currentPage.width / 4,
        y: currentPage.height / 2,
        width: 160,
        height: 120,
        imageDataUrl: dataUrl,
      };

      recordHistory();
      setCustomElements((prev) => [...prev, newElem]);
    };
    reader.readAsDataURL(file);
  };

  // Text Edits updater
  const handleUpdateTextEdit = (updatedEdit: TextEditItem) => {
    setTextEdits((prev) => {
      const idx = prev.findIndex((t) => t.id === updatedEdit.id);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = updatedEdit;
        return copy;
      }
      return [...prev, updatedEdit];
    });
  };

  // Custom Elements updater
  const handleAddCustomElement = (elem: CustomElement) => {
    setCustomElements((prev) => [...prev, elem]);
  };

  const handleUpdateCustomElement = (elem: CustomElement) => {
    setCustomElements((prev) => prev.map((el) => (el.id === elem.id ? elem : el)));
  };

  const handleDeleteCustomElement = (id: string) => {
    setCustomElements((prev) => prev.filter((el) => el.id !== id));
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleExport();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '=') {
        e.preventDefault();
        setZoom((z) => Math.min(2.5, z + 0.1));
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        setZoom((z) => Math.max(0.5, z - 0.1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleExport]);

  // Unsaved changes exit protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (textEdits.length > 0 || customElements.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [textEdits, customElements]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* Top Navbar */}
      <Navbar
        fileName={fileName}
        onFileNameChange={setFileName}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        zoom={zoom}
        onZoomChange={setZoom}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onExport={handleExport}
        onNewDocument={handleNewDocument}
        isExporting={isExporting}
      />

      {!pdfDoc ? (
        /* Empty / Landing View */
        <LandingView
          onOpenFile={handleOpenFile}
          onOpenSample={handleOpenSample}
          isLoading={isLoading}
        />
      ) : (
        /* PDF Editor Workspace */
        <>
          {/* Secondary Action Toolbar */}
          <Toolbar
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            currentColor={currentColor}
            onColorChange={setCurrentColor}
            strokeWidth={strokeWidth}
            onStrokeWidthChange={setStrokeWidth}
            onAddImageFile={handleAddImageFile}
          />

          {/* Main Content Area */}
          <div className="flex-1 flex overflow-hidden">
            {/* Page Thumbnail Sidebar */}
            <ThumbnailSidebar
              pages={pages}
              currentPageIndex={currentPageIndex}
              onSelectPage={setCurrentPageIndex}
              onMovePage={handleMovePage}
              onRotatePage={handleRotatePage}
              onDuplicatePage={handleDuplicatePage}
              onDeletePage={handleDeletePage}
              onAddBlankPage={handleAddBlankPage}
              onImportPdf={handleImportPdf}
              isOpen={isSidebarOpen}
              onToggleOpen={() => setIsSidebarOpen(!isSidebarOpen)}
            />

            {/* Document Canvas Workspace */}
            <main className="flex-1 overflow-auto p-8 flex items-center justify-center bg-slate-200/70 dark:bg-slate-950/90 relative">
              {pages[currentPageIndex] && (
                <PdfPageView
                  doc={pdfDoc}
                  page={pages[currentPageIndex]}
                  pageIndex={currentPageIndex}
                  zoom={zoom}
                  activeTool={activeTool}
                  currentColor={currentColor}
                  strokeWidth={strokeWidth}
                  textEdits={textEdits}
                  onUpdateTextEdit={handleUpdateTextEdit}
                  imageEdits={imageEdits}
                  onUpdateImageEdit={(item) =>
                    setImageEdits((prev) => [...prev.filter((i) => i.id !== item.id), item])
                  }
                  customElements={customElements}
                  onAddCustomElement={handleAddCustomElement}
                  onUpdateCustomElement={handleUpdateCustomElement}
                  onDeleteCustomElement={handleDeleteCustomElement}
                  onRecordHistory={recordHistory}
                />
              )}
            </main>
          </div>
        </>
      )}
    </div>
  );
}
