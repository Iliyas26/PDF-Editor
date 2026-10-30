import React, { useRef } from 'react';
import {
  MousePointer,
  Type,
  FileEdit,
  Image as ImageIcon,
  Square,
  Minus,
  MoveRight,
  Palette,
  Check
} from 'lucide-react';
import { ActiveTool } from '../types';

interface ToolbarProps {
  activeTool: ActiveTool;
  onSelectTool: (tool: ActiveTool) => void;
  currentColor: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  onAddImageFile: (file: File) => void;
}

const COLOR_PRESETS = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#000000', // black
  '#f59e0b', // amber
  '#9333ea', // purple
];

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  onSelectTool,
  currentColor,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  onAddImageFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAddImageFile(file);
      e.target.value = '';
    }
  };

  return (
    <aside className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 flex items-center justify-between z-20 shadow-xs">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Main Tool Selector */}
      <div className="flex items-center space-x-1 sm:space-x-1.5 overflow-x-auto">
        {/* Select Tool */}
        <button
          onClick={() => onSelectTool('select')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTool === 'select'
              ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title="Select / Hand tool"
        >
          <MousePointer className="w-3.5 h-3.5" />
          <span>Select</span>
        </button>

        {/* In-Place Text Edit Tool */}
        <button
          onClick={() => onSelectTool('editText')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTool === 'editText'
              ? 'bg-indigo-600 text-white shadow-xs font-semibold'
              : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/50'
          }`}
          title="Click existing text on the page to edit inline"
        >
          <FileEdit className="w-3.5 h-3.5" />
          <span>Edit In-Place</span>
        </button>

        <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

        {/* Add Text Box */}
        <button
          onClick={() => onSelectTool('addText')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTool === 'addText'
              ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Insert new text box"
        >
          <Type className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add Text</span>
        </button>

        {/* Add Image */}
        <button
          onClick={handleImageUploadClick}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          title="Upload and place new image"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add Image</span>
        </button>

        <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

        {/* Geometric Shapes */}
        <button
          onClick={() => onSelectTool('rect')}
          className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTool === 'rect'
              ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Draw Rectangle"
        >
          <Square className="w-4 h-4" />
        </button>

        <button
          onClick={() => onSelectTool('line')}
          className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTool === 'line'
              ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Draw Line"
        >
          <Minus className="w-4 h-4" />
        </button>

        <button
          onClick={() => onSelectTool('arrow')}
          className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTool === 'arrow'
              ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Draw Arrow"
        >
          <MoveRight className="w-4 h-4" />
        </button>
      </div>

      {/* Formatting & Color Options (Active for creation tools) */}
      <div className="flex items-center space-x-2">
        {/* Color Palette Swatches */}
        <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200 dark:border-slate-700/60">
          {COLOR_PRESETS.map((color) => (
            <button
              key={color}
              onClick={() => onColorChange(color)}
              className="w-4 h-4 rounded-full border border-black/10 dark:border-white/10 flex items-center justify-center transition-transform hover:scale-110"
              style={{ backgroundColor: color }}
              title={color}
            >
              {currentColor.toLowerCase() === color.toLowerCase() && (
                <div className="w-1.5 h-1.5 bg-white rounded-full shadow-xs" />
              )}
            </button>
          ))}
          <input
            type="color"
            value={currentColor}
            onChange={(e) => onColorChange(e.target.value)}
            className="w-4 h-4 rounded cursor-pointer opacity-80 hover:opacity-100 bg-transparent border-none"
            title="Custom Color"
          />
        </div>

        {/* Stroke thickness selector for shapes */}
        {['rect', 'line', 'arrow'].includes(activeTool) && (
          <select
            value={strokeWidth}
            onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
            className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-700 dark:text-slate-300 focus:outline-none"
            title="Stroke Width"
          >
            <option value={1}>1px</option>
            <option value={2}>2px</option>
            <option value={4}>4px</option>
            <option value={6}>6px</option>
          </select>
        )}
      </div>
    </aside>
  );
};
