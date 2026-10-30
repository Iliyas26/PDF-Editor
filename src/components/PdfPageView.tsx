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
import { Trash2, Move, RotateCw, Check, X, Image as ImageIcon } from 'lucide-react';

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
  const [editingValue, setEditingValue] = useState<string>('');
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

  // Load and render page canvas
  useEffect(() => {
    let isCancelled = false;
    async function load() {
      if (page.source === 'blank') {
        // Just clear canvas to pure white
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
    if (editingTextId) return; // currently editing inline text

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Relative coordinates in PDF points (unscaled by zoom)
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const pdfX = clientX / zoom;
    const pdfY = (rect.height - clientY) / zoom; // PDF coordinates: bottom-up

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
      const deltaY = (draggedElement.startY - e.clientY) / zoom; // PDF Y is inverted

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

  // Start inline text editing
  const handleStartEditText = (item: DetectedTextItem, existingEdit?: TextEditItem) => {
    setEditingTextId(item.id);
    setEditingValue(existingEdit ? existingEdit.newText : item.str);
  };

  // Commit inline text editing
  const handleFinishEditText = (item: DetectedTextItem) => {
    if (editingTextId !== item.id) return;

    if (editingValue !== item.str) {
      onRecordHistory();
      const updatedEdit: TextEditItem = {
        id: `edit-${item.id}`,
        pageId: page.id,
        originalText: item.str,
        newText: editingValue,
        x: item.x,
        y: item.y,
        width: Math.max(item.width, editingValue.length * item.fontSize * 0.6),
        height: item.height,
        fontSize: item.fontSize,
        fontFamily: item.fontName,
        color: { r: 0.1, g: 0.1, b: 0.1 },
      };
      onUpdateTextEdit(updatedEdit);
    }
    setEditingTextId(null);
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

      {/* 2. Detected PDF Text Layer (for Click-to-Edit Inline) */}
      {detectedTexts.map((item) => {
        const existingEdit = textEdits.find(
          (t) => t.pageId === page.id && t.x === item.x && t.y === item.y
        );

        const displayText = existingEdit ? existingEdit.newText : item.str;
        const isEditing = editingTextId === item.id;
        const isDeleted = existingEdit?.isDeleted;

        // Convert PDF coordinates to DOM top/left percentages
        const left = (item.x / page.width) * 100;
        const top = ((page.height - item.y - item.height) / page.height) * 100;
        const width = (Math.max(item.width, (displayText?.length || 1) * item.fontSize * 0.55) / page.width) * 100;
        const height = (item.height / page.height) * 100;

        if (isDeleted) {
          return (
            <div
              key={item.id}
              className="absolute bg-white z-10"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height: `${height}%`,
              }}
            />
          );
        }

        // Active inline editing input
        if (isEditing) {
          return (
            <div
              key={item.id}
              className="absolute z-30 flex items-center bg-white shadow-lg border-2 border-indigo-500 rounded px-1"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                minWidth: `${width}%`,
                height: `${Math.max(height * (page.height * zoom / 100), 24)}px`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                autoFocus
                type="text"
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFinishEditText(item);
                  if (e.key === 'Escape') setEditingTextId(null);
                }}
                onBlur={() => handleFinishEditText(item)}
                className="w-full bg-transparent outline-none text-slate-900 font-sans"
                style={{
                  fontSize: `${item.fontSize * zoom}px`,
                  lineHeight: 1,
                }}
              />
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleFinishEditText(item);
                }}
                className="p-0.5 text-indigo-600 hover:text-indigo-800"
                title="Save Edit (Enter)"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        }

        // If previously edited, mask original on canvas and render updated text
        if (existingEdit && existingEdit.newText !== item.str) {
          return (
            <div
              key={item.id}
              onClick={() => activeTool === 'editText' && handleStartEditText(item, existingEdit)}
              className={`absolute z-10 bg-white flex items-center cursor-text transition-all ${
                activeTool === 'editText'
                  ? 'hover:ring-1 hover:ring-indigo-400 hover:bg-indigo-50/20'
                  : ''
              }`}
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height: `${height}%`,
                fontSize: `${item.fontSize * zoom}px`,
                color: '#1a1a1a',
                lineHeight: 1,
              }}
            >
              <span className="truncate w-full">{existingEdit.newText}</span>
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
