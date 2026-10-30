import React, { useRef } from 'react';
import {
  RotateCw,
  Copy,
  Trash2,
  Plus,
  FilePlus,
  ChevronUp,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { PageDescriptor } from '../types';

interface ThumbnailSidebarProps {
  pages: PageDescriptor[];
  currentPageIndex: number;
  onSelectPage: (index: number) => void;
  onMovePage: (fromIndex: number, toIndex: number) => void;
  onRotatePage: (pageId: string) => void;
  onDuplicatePage: (pageId: string) => void;
  onDeletePage: (pageId: string) => void;
  onAddBlankPage: () => void;
  onImportPdf: (file: File) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const ThumbnailSidebar: React.FC<ThumbnailSidebarProps> = ({
  pages,
  currentPageIndex,
  onSelectPage,
  onMovePage,
  onRotatePage,
  onDuplicatePage,
  onDeletePage,
  onAddBlankPage,
  onImportPdf,
  isOpen,
  onToggleOpen,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportPdf(file);
      e.target.value = '';
    }
  };

  if (!isOpen) {
    return (
      <div className="border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 flex flex-col items-center z-10">
        <button
          onClick={onToggleOpen}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Open Page Thumbnails"
        >
          <PanelLeftOpen className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex flex-col h-[calc(100vh-3.5rem-2.75rem)] z-10 transition-all">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Sidebar Header */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          <span>Pages ({pages.length})</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={onToggleOpen}
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title="Collapse Sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pages List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {pages.map((page, idx) => {
          const isSelected = idx === currentPageIndex;
          const aspectRatio = page.width && page.height ? page.height / page.width : 1.414;

          return (
            <div
              key={page.id}
              onClick={() => onSelectPage(idx)}
              className={`group relative rounded-xl border-2 p-2 cursor-pointer transition-all ${
                isSelected
                  ? 'border-indigo-600 bg-white dark:bg-slate-800 shadow-md ring-2 ring-indigo-500/20'
                  : 'border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              {/* Thumbnail representation */}
              <div
                className="w-full bg-white dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-700/80 shadow-xs flex flex-col items-center justify-center relative overflow-hidden"
                style={{
                  height: '140px',
                  transform: `rotate(${page.rotation}deg)`,
                  transition: 'transform 0.2s ease',
                }}
              >
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                  {page.source === 'blank'
                    ? 'Blank Page'
                    : page.source === 'imported'
                    ? 'Imported PDF'
                    : `Page ${page.sourcePageIndex + 1}`}
                </div>
                {/* Mock lines */}
                <div className="w-3/4 space-y-1.5 mt-2 opacity-30">
                  <div className="h-1 bg-slate-400 rounded w-full" />
                  <div className="h-1 bg-slate-400 rounded w-5/6" />
                  <div className="h-1 bg-slate-400 rounded w-4/6" />
                </div>
              </div>

              {/* Page Number & Label */}
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className={`font-semibold ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>
                  Page {idx + 1}
                </span>

                {/* Page Quick Actions */}
                <div className="flex items-center space-x-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                  {/* Move Up */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (idx > 0) onMovePage(idx, idx - 1);
                    }}
                    disabled={idx === 0}
                    className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 disabled:opacity-20"
                    title="Move Page Up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>

                  {/* Move Down */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (idx < pages.length - 1) onMovePage(idx, idx + 1);
                    }}
                    disabled={idx === pages.length - 1}
                    className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 disabled:opacity-20"
                    title="Move Page Down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>

                  {/* Rotate 90 deg */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRotatePage(page.id);
                    }}
                    className="p-1 rounded text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                    title="Rotate 90° Clockwise"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>

                  {/* Duplicate */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicatePage(page.id);
                    }}
                    className="p-1 rounded text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                    title="Duplicate Page"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete */}
                  {pages.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePage(page.id);
                      }}
                      className="p-1 rounded text-slate-500 hover:text-red-600"
                      title="Delete Page"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sidebar Footer Operations */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2 bg-white dark:bg-slate-900">
        <button
          onClick={onAddBlankPage}
          className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 text-xs font-medium rounded-lg border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Blank Page</span>
        </button>

        <button
          onClick={handleImportClick}
          className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
        >
          <FilePlus className="w-4 h-4 text-indigo-500" />
          <span>Append Another PDF</span>
        </button>
      </div>
    </aside>
  );
};
