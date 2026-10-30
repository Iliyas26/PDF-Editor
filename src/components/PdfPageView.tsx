import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ActiveTool,
  PageDescriptor,
  TextEditItem,
  ImageEditItem,
  CustomElement,
  DetectedTextItem
} from '../types';
import { renderPage, extractTextItems } from '../utils/pdfEngine';
import {
  Trash2,
  Check,
  Bold,
  Italic,
  Minus,
  Plus
} from 'lucide-react';

interface PdfPageViewProps {
  doc: pdfjsLib.PDFDocumentProxy | null;
  page: PageDescriptor;
  pageIndex: number;
  zoom: number;
  activeTool: ActiveTool;
  currentColor: string;
  strokeWidth: number;
  textEdits: TextEditItem[];
  onUpdateTextEdit: (item: TextEditItem) => void;
  imageEdits: ImageEditItem[];
  onUpdateImageEdit: (item: ImageEditItem) => void;
  customElements: CustomElement[];
  onAddCustomElement: (elem: CustomElement) => void;
  onUpdateCustomElement: (elem: CustomElement) => void;
  onDeleteCustomElement: (id: string) => void;
  onRecordHistory: () => void;
}

export const PdfPageView: React.FC<PdfPageViewProps> = ({
  doc,
  page,
  pageIndex,
  zoom,
  activeTool,
  currentColor,
  strokeWidth,
  textEdits,
  onUpdateTextEdit,
  imageEdits,
  onUpdateImageEdit,
  customElements,
  onAddCustomElement,
  onUpdateCustomElement,
  onDeleteCustomElement,
  onRecordHistory,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [detectedTexts, setDetectedTexts] = useState<DetectedTextItem[]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [activeTextEdit, setActiveTextEdit] = useState<TextEditItem | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Drawing state for shapes
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDraw, setCurrentDraw] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Dragging / Moving custom elements
  const [draggedElement, setDraggedElement] = useState<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // Resizing text box handles
  const [resizingText, setResizingText] = useState<{
    handle: 'right' | 'bottom' | 'corner';
    startX: number;
    startY: number;
    origWidth: number;
    origHeight: number;
    origY: number;
  } | null>(null);

  // Load and render page canvas
  useEffect(() => {
    let isCancelled = false;
    async function load() {
      if (page.source === 'blank') {
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = page.width * zoom;
          canvas.height = page.height * zoom;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        }
        return;
      }

      if (!doc || !canvasRef.current) return;

      await renderPage(doc, page.sourcePageIndex, canvasRef.current, zoom, page.rotation);

      if (!isCancelled) {
        const items = await extractTextItems(doc, page.sourcePageIndex);
        setDetectedTexts(items);
      }
    }

    load();
    return () => {
      isCancelled = true;
    };
  }, [doc, page.id, page.sourcePageIndex, page.rotation, page.source, zoom]);

  // Handle click on canvas for adding text or shapes
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // If clicking outside active text box, commit it
    if (activeTextEdit && editingTextId) {
      commitActiveTextEdit();
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const pdfX = clientX / zoom;
    const pdfY = (rect.height - clientY) / zoom;

    if (activeTool === 'addText') {
      const newElem: CustomElement = {
        id: `elem-text-${Date.now()}`,
        pageId: page.id,
        type: 'text',
        x: pdfX,
        y: pdfY - 14,
        width: 150,
        height: 24,
        text: 'Type text here...',
        fontSize: 14,
        textColor: currentColor,
      };
      onRecordHistory();
      onAddCustomElement(newElem);
      setSelectedElementId(newElem.id);
      return;
    }

    if (['rect', 'line', 'arrow'].includes(activeTool)) {
      setIsDrawing(true);
      setDrawStart({ x: pdfX, y: pdfY });
      setCurrentDraw({ x: pdfX, y: pdfY, w: 0, h: 0 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const pdfX = clientX / zoom;
    const pdfY = (rect.height - clientY) / zoom;

    // Handle Text Box Resizing
    if (resizingText && activeTextEdit) {
      const deltaX = (e.clientX - resizingText.startX) / zoom;
      const deltaY = (e.clientY - resizingText.startY) / zoom;

      let newWidth = activeTextEdit.width;
      let newHeight = activeTextEdit.height;
      let newY = activeTextEdit.y;

      if (resizingText.handle === 'right' || resizingText.handle === 'corner') {
        newWidth = Math.max(25, resizingText.origWidth + deltaX);
      }
      if (resizingText.handle === 'bottom' || resizingText.handle === 'corner') {
        newHeight = Math.max(12, resizingText.origHeight + deltaY);
        newY = resizingText.origY - deltaY;
      }

      setActiveTextEdit((prev) =>
        prev
          ? {
              ...prev,
              width: Math.round(newWidth * 10) / 10,
              height: Math.round(newHeight * 10) / 10,
              y: Math.round(newY * 10) / 10,
            }
          : null
      );
      return;
    }

    // Handle Shape Drawing
    if (isDrawing && drawStart) {
      setCurrentDraw({
        x: Math.min(drawStart.x, pdfX),
        y: Math.min(drawStart.y, pdfY),
        w: Math.abs(pdfX - drawStart.x),
        h: Math.abs(pdfY - drawStart.y),
      });
    }

    // Handle Element Dragging
    if (draggedElement) {
      const deltaX = (e.clientX - draggedElement.startX) / zoom;
      const deltaY = (draggedElement.startY - e.clientY) / zoom;

      const elem = customElements.find((el) => el.id === draggedElement.id);
      if (elem) {
        onUpdateCustomElement({
          ...elem,
          x: Math.max(0, draggedElement.origX + deltaX),
          y: Math.max(0, draggedElement.origY + deltaY),
        });
      }
    }
  };

  const handleMouseUp = () => {
    if (resizingText) {
      setResizingText(null);
    }

    if (isDrawing && drawStart && currentDraw) {
      if (currentDraw.w > 5 || currentDraw.h > 5) {
        const elemType: 'rectangle' | 'line' | 'arrow' =
          activeTool === 'rect' ? 'rectangle' : (activeTool as 'line' | 'arrow');

        const newElem: CustomElement = {
          id: `elem-shape-${Date.now()}`,
          pageId: page.id,
          type: elemType,
          x: activeTool === 'rect' ? currentDraw.x : drawStart.x,
          y: activeTool === 'rect' ? currentDraw.y : drawStart.y,
          width: activeTool === 'rect' ? currentDraw.w : (currentDraw.x + currentDraw.w) - drawStart.x,
          height: activeTool === 'rect' ? currentDraw.h : (currentDraw.y + currentDraw.h) - drawStart.y,
          strokeColor: currentColor,
          fillColor: 'transparent',
          strokeWidth,
        };
        onRecordHistory();
        onAddCustomElement(newElem);
        setSelectedElementId(newElem.id);
      }
      setIsDrawing(false);
      setDrawStart(null);
      setCurrentDraw(null);
    }

    if (draggedElement) {
      onRecordHistory();
      setDraggedElement(null);
    }
  };

  // Start inline text editing with floating toolbar & resize controls
  const handleStartEditText = (item: DetectedTextItem, existingEdit?: TextEditItem) => {
    setEditingTextId(item.id);

    if (existingEdit) {
      setActiveTextEdit({ ...existingEdit });
    } else {
      setActiveTextEdit({
        id: `edit-${item.id}`,
        pageId: page.id,
        originalText: item.str,
        newText: item.str,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        fontSize: item.fontSize,
        fontFamily: item.fontFamily,
        isBold: item.isBold,
        isItalic: item.isItalic,
        color: { r: 0.1, g: 0.1, b: 0.1 },
      });
    }
  };

  // Commit text editing changes
  const commitActiveTextEdit = () => {
    if (!activeTextEdit) return;

    if (
      activeTextEdit.newText !== activeTextEdit.originalText ||
      activeTextEdit.isDeleted ||
      activeTextEdit.isBold ||
      activeTextEdit.isItalic ||
      activeTextEdit.fontSize
    ) {
      onRecordHistory();
      onUpdateTextEdit(activeTextEdit);
    }

    setEditingTextId(null);
    setActiveTextEdit(null);
  };

  // Delete / Whiteout selected text box
  const handleDeleteText = () => {
    if (!activeTextEdit) return;
    onRecordHistory();
    onUpdateTextEdit({
      ...activeTextEdit,
      isDeleted: true,
      newText: '',
    });
    setEditingTextId(null);
    setActiveTextEdit(null);
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="relative shadow-2xl bg-white select-none transition-shadow"
      style={{
        width: `${page.width * zoom}px`,
        height: `${page.height * zoom}px`,
      }}
    >
      {/* 1. Underlying Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      />

      {/* 2. Detected PDF Text Layer */}
      {detectedTexts.map((item) => {
        const existingEdit = textEdits.find(
          (t) => t.pageId === page.id && t.id === `edit-${item.id}`
        );

        const currentEdit = editingTextId === item.id ? activeTextEdit : existingEdit;
        const isEditing = editingTextId === item.id;
        const isDeleted = currentEdit?.isDeleted;

        // Current coordinates (uses edited box dimensions if adjusted)
        const curX = currentEdit ? currentEdit.x : item.x;
        const curY = currentEdit ? currentEdit.y : item.y;
        const curW = currentEdit ? currentEdit.width : item.width;
        const curH = currentEdit ? currentEdit.height : item.height;

        const left = (curX / page.width) * 100;
        const top = ((page.height - curY - curH) / page.height) * 100;
        const width = (curW / page.width) * 100;
        const height = (curH / page.height) * 100;

        if (isDeleted) {
          return (
            <div
              key={item.id}
              className="absolute bg-white z-10 border border-transparent hover:border-red-300"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height: `${height}%`,
              }}
              title="Deleted / Whiteout text area"
            />
          );
        }

        // Active inline editing with floating toolbar & resize handles
        if (isEditing && activeTextEdit) {
          const fontCss =
            activeTextEdit.fontFamily === 'Times'
              ? 'serif'
              : activeTextEdit.fontFamily === 'Courier'
              ? 'monospace'
              : 'sans-serif';

          return (
            <div
              key={item.id}
              className="absolute z-30 flex flex-col items-start bg-white shadow-xl ring-2 ring-indigo-500 rounded-sm"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                minHeight: `${height}%`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Floating Toolbar above the text box */}
              <div
                className="absolute -top-10 left-0 flex items-center space-x-1 bg-slate-900 text-white px-2 py-1 rounded-lg shadow-xl text-xs z-40 whitespace-nowrap"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {/* Font Family selector */}
                <select
                  value={activeTextEdit.fontFamily}
                  onChange={(e) =>
                    setActiveTextEdit({ ...activeTextEdit, fontFamily: e.target.value })
                  }
                  className="bg-slate-800 text-slate-100 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] focus:outline-none"
                >
                  <option value="Helvetica">Sans (Helvetica)</option>
                  <option value="Times">Serif (Times)</option>
                  <option value="Courier">Mono (Courier)</option>
                </select>

                <div className="h-3.5 w-[1px] bg-slate-700" />

                {/* Font Size decrease */}
                <button
                  type="button"
                  onClick={() =>
                    setActiveTextEdit({
                      ...activeTextEdit,
                      fontSize: Math.max(6, activeTextEdit.fontSize - 1),
                    })
                  }
                  className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
                  title="Decrease Font Size"
                >
                  <Minus className="w-3 h-3" />
                </button>

                <span className="font-mono text-[11px] px-1 text-slate-200">
                  {activeTextEdit.fontSize}pt
                </span>

                {/* Font Size increase */}
                <button
                  type="button"
                  onClick={() =>
                    setActiveTextEdit({
                      ...activeTextEdit,
                      fontSize: Math.min(72, activeTextEdit.fontSize + 1),
                    })
                  }
                  className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
                  title="Increase Font Size"
                >
                  <Plus className="w-3 h-3" />
                </button>

                <div className="h-3.5 w-[1px] bg-slate-700" />

                {/* Bold toggle */}
                <button
                  type="button"
                  onClick={() =>
                    setActiveTextEdit({ ...activeTextEdit, isBold: !activeTextEdit.isBold })
                  }
                  className={`p-1 rounded ${
                    activeTextEdit.isBold
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'hover:bg-slate-800 text-slate-300'
                  }`}
                  title="Toggle Bold"
                >
                  <Bold className="w-3 h-3" />
                </button>

                {/* Italic toggle */}
                <button
                  type="button"
                  onClick={() =>
                    setActiveTextEdit({ ...activeTextEdit, isItalic: !activeTextEdit.isItalic })
                  }
                  className={`p-1 rounded ${
                    activeTextEdit.isItalic
                      ? 'bg-indigo-600 text-white'
                      : 'hover:bg-slate-800 text-slate-300'
                  }`}
                  title="Toggle Italic"
                >
                  <Italic className="w-3 h-3" />
                </button>

                <div className="h-3.5 w-[1px] bg-slate-700" />

                {/* Delete / Whiteout */}
                <button
                  type="button"
                  onClick={handleDeleteText}
                  className="p-1 hover:bg-red-600 text-red-400 hover:text-white rounded transition-colors"
                  title="Delete Text & Mask Whiteout"
                >
                  <Trash2 className="w-3 h-3" />
                </button>

                {/* Save / Done button */}
                <button
                  type="button"
                  onClick={commitActiveTextEdit}
                  className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors"
                  title="Save Edit"
                >
                  <Check className="w-3 h-3" />
                </button>
              </div>

              {/* Multi-line Text Area wrapping inside the box */}
              <textarea
                autoFocus
                value={activeTextEdit.newText}
                onChange={(e) =>
                  setActiveTextEdit({ ...activeTextEdit, newText: e.target.value })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setEditingTextId(null);
                    setActiveTextEdit(null);
                  }
                }}
                className="w-full h-full bg-white text-slate-900 border-none outline-none p-0.5 resize-none overflow-hidden"
                style={{
                  fontSize: `${activeTextEdit.fontSize * zoom}px`,
                  fontFamily: fontCss,
                  fontWeight: activeTextEdit.isBold ? 'bold' : 'normal',
                  fontStyle: activeTextEdit.isItalic ? 'italic' : 'normal',
                  lineHeight: 1.25,
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}
              />

              {/* Resize Handle: Right (Width) */}
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setResizingText({
                    handle: 'right',
                    startX: e.clientX,
                    startY: e.clientY,
                    origWidth: activeTextEdit.width,
                    origHeight: activeTextEdit.height,
                    origY: activeTextEdit.y,
                  });
                }}
                className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-5 bg-indigo-600 border border-white rounded-xs cursor-ew-resize shadow-xs"
                title="Drag to resize box width"
              />

              {/* Resize Handle: Bottom (Height) */}
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setResizingText({
                    handle: 'bottom',
                    startX: e.clientX,
                    startY: e.clientY,
                    origWidth: activeTextEdit.width,
                    origHeight: activeTextEdit.height,
                    origY: activeTextEdit.y,
                  });
                }}
                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-3 w-5 bg-indigo-600 border border-white rounded-xs cursor-ns-resize shadow-xs"
                title="Drag to resize box height"
              />

              {/* Resize Handle: Bottom-Right Corner (Width & Height) */}
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setResizingText({
                    handle: 'corner',
                    startX: e.clientX,
                    startY: e.clientY,
                    origWidth: activeTextEdit.width,
                    origHeight: activeTextEdit.height,
                    origY: activeTextEdit.y,
                  });
                }}
                className="absolute -right-1.5 -bottom-1.5 w-3.5 h-3.5 bg-indigo-600 border border-white rounded-xs cursor-nwse-resize shadow-xs"
                title="Drag corner to resize box"
              />
            </div>
          );
        }

        // If previously edited, mask original on canvas and render updated text wrapped in box
        if (existingEdit && (existingEdit.newText !== item.str || existingEdit.fontSize !== item.fontSize || existingEdit.width !== item.width)) {
          const fontCss =
            existingEdit.fontFamily === 'Times'
              ? 'serif'
              : existingEdit.fontFamily === 'Courier'
              ? 'monospace'
              : 'sans-serif';

          return (
            <div
              key={item.id}
              onClick={() => activeTool === 'editText' && handleStartEditText(item, existingEdit)}
              className={`absolute z-10 bg-white flex flex-col justify-start cursor-pointer transition-all ${
                activeTool === 'editText'
                  ? 'hover:ring-1 hover:ring-indigo-400 hover:bg-indigo-50/20'
                  : ''
              }`}
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height: `${height}%`,
                fontSize: `${existingEdit.fontSize * zoom}px`,
                fontFamily: fontCss,
                fontWeight: existingEdit.isBold ? 'bold' : 'normal',
                fontStyle: existingEdit.isItalic ? 'italic' : 'normal',
                color: '#1a1a1a',
                lineHeight: 1.25,
                overflow: 'hidden',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
              }}
              title="Click to edit or adjust box size"
            >
              {existingEdit.newText}
            </div>
          );
        }

        // Unedited text hover box when "Edit In-Place" tool is active
        return (
          <div
            key={item.id}
            onClick={() => activeTool === 'editText' && handleStartEditText(item)}
            className={`absolute z-10 transition-colors ${
              activeTool === 'editText'
                ? 'cursor-text hover:bg-indigo-500/15 hover:border hover:border-dashed hover:border-indigo-500 rounded-xs'
                : 'pointer-events-none'
            }`}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${width}%`,
              height: `${height}%`,
            }}
            title={activeTool === 'editText' ? `Click to edit: "${item.str}"` : undefined}
          />
        );
      })}

      {/* 3. Custom Elements Layer (Text boxes, Shapes, Images) */}
      {customElements
        .filter((el) => el.pageId === page.id)
        .map((elem) => {
          const isSelected = selectedElementId === elem.id;

          const left = (elem.x / page.width) * 100;
          const top = ((page.height - elem.y - elem.height) / page.height) * 100;
          const width = (elem.width / page.width) * 100;
          const height = (elem.height / page.height) * 100;

          return (
            <div
              key={elem.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedElementId(elem.id);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                setSelectedElementId(elem.id);
                setDraggedElement({
                  id: elem.id,
                  startX: e.clientX,
                  startY: e.clientY,
                  origX: elem.x,
                  origY: elem.y,
                });
              }}
              className={`absolute group cursor-move transition-shadow z-20 ${
                isSelected
                  ? 'ring-2 ring-indigo-500 ring-offset-1 shadow-sm'
                  : 'hover:ring-1 hover:ring-indigo-300'
              }`}
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height: `${height}%`,
              }}
            >
              {/* Render Type: Text */}
              {elem.type === 'text' && (
                <input
                  type="text"
                  value={elem.text || ''}
                  onChange={(e) => onUpdateCustomElement({ ...elem, text: e.target.value })}
                  className="w-full h-full bg-transparent outline-none font-medium px-1"
                  style={{
                    fontSize: `${(elem.fontSize || 14) * zoom}px`,
                    color: elem.textColor || '#000000',
                  }}
                />
              )}

              {/* Render Type: Rectangle */}
              {elem.type === 'rectangle' && (
                <div
                  className="w-full h-full"
                  style={{
                    borderWidth: `${(elem.strokeWidth || 2) * zoom}px`,
                    borderColor: elem.strokeColor || '#2563eb',
                    backgroundColor: elem.fillColor || 'transparent',
                    borderStyle: 'solid',
                  }}
                />
              )}

              {/* Render Type: Line */}
              {elem.type === 'line' && (
                <svg className="w-full h-full overflow-visible pointer-events-none">
                  <line
                    x1="0"
                    y1="100%"
                    x2="100%"
                    y2="0"
                    stroke={elem.strokeColor || '#2563eb'}
                    strokeWidth={(elem.strokeWidth || 2) * zoom}
                  />
                </svg>
              )}

              {/* Render Type: Arrow */}
              {elem.type === 'arrow' && (
                <svg className="w-full h-full overflow-visible pointer-events-none">
                  <defs>
                    <marker
                      id={`arrow-${elem.id}`}
                      viewBox="0 0 10 10"
                      refX="5"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={elem.strokeColor || '#2563eb'} />
                    </marker>
                  </defs>
                  <line
                    x1="0"
                    y1="100%"
                    x2="100%"
                    y2="0"
                    stroke={elem.strokeColor || '#2563eb'}
                    strokeWidth={(elem.strokeWidth || 2) * zoom}
                    markerEnd={`url(#arrow-${elem.id})`}
                  />
                </svg>
              )}

              {/* Render Type: Image */}
              {elem.type === 'image' && elem.imageDataUrl && (
                <img
                  src={elem.imageDataUrl}
                  alt="Custom inserted"
                  className="w-full h-full object-contain pointer-events-none"
                />
              )}

              {/* Delete button on selection */}
              {isSelected && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRecordHistory();
                    onDeleteCustomElement(elem.id);
                  }}
                  className="absolute -top-3 -right-3 p-1 rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 z-30"
                  title="Delete element"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

      {/* 4. Active drawing preview */}
      {isDrawing && currentDraw && (
        <div
          className="absolute border-2 border-dashed border-indigo-500 bg-indigo-50/20 pointer-events-none z-30"
          style={{
            left: `${(currentDraw.x / page.width) * 100}%`,
            top: `${((page.height - currentDraw.y - currentDraw.h) / page.height) * 100}%`,
            width: `${(currentDraw.w / page.width) * 100}%`,
            height: `${(currentDraw.h / page.height) * 100}%`,
          }}
        />
      )}
    </div>
  );
};
