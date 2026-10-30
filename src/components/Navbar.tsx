import React from 'react';
import {
  FileText,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Download,
  Sun,
  Moon,
  FolderOpen,
  Check,
  Maximize2
} from 'lucide-react';

interface NavbarProps {
  fileName: string;
  onFileNameChange: (name: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onExport: () => void;
  onNewDocument: () => void;
  isExporting: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  fileName,
  onFileNameChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomChange,
  isDarkMode,
  onToggleDarkMode,
  onExport,
  onNewDocument,
  isExporting,
}) => {
  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 flex items-center justify-between select-none z-30">
      {/* Left: Brand & File Name */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-bold text-lg tracking-tight">
          <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60">
            <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <span className="hidden sm:inline">PDF Studio</span>
        </div>

        <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

        <input
          type="text"
          value={fileName}
          onChange={(e) => onFileNameChange(e.target.value)}
          className="text-xs sm:text-sm font-medium bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded border border-transparent hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-200 max-w-[160px] sm:max-w-[240px] truncate focus:outline-none focus:ring-1 focus:ring-indigo-500"
          title="Click to rename document"
        />
      </div>

      {/* Center: History & Zoom */}
      <div className="flex items-center space-x-1 sm:space-x-2">
        {/* Undo/Redo */}
        <div className="flex items-center space-x-0.5 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800/80 px-1 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
          <button
            onClick={() => onZoomChange(Math.max(0.5, zoom - 0.1))}
            title="Zoom Out (Ctrl+-)"
            className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => onZoomChange(1.0)}
            title="Reset Zoom (100%)"
            className="text-xs font-semibold px-1.5 py-0.5 text-slate-700 dark:text-slate-300 hover:text-indigo-600 min-w-[45px] text-center"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => onZoomChange(Math.min(2.5, zoom + 0.1))}
            title="Zoom In (Ctrl+=)"
            className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center space-x-2">
        {/* Dark/Light mode toggle */}
        <button
          onClick={onToggleDarkMode}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Open Another PDF */}
        <button
          onClick={onNewDocument}
          title="Open another PDF"
          className="hidden sm:flex items-center space-x-1 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
        >
          <FolderOpen className="w-4 h-4" />
          <span>Open</span>
        </button>

        {/* Download PDF button */}
        <button
          onClick={onExport}
          disabled={isExporting}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow transition-all disabled:opacity-60"
        >
          {isExporting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span>{isExporting ? 'Exporting...' : 'Download PDF'}</span>
        </button>
      </div>
    </header>
  );
};
