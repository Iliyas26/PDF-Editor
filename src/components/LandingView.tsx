import React, { useRef, useState } from 'react';
import {
  FileUp,
  FileText,
  Sparkles,
  ShieldCheck,
  Edit3,
  Layers,
  ArrowRight
} from 'lucide-react';

interface LandingViewProps {
  onOpenFile: (file: File) => void;
  onOpenSample: () => void;
  isLoading: boolean;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onOpenFile,
  onOpenSample,
  isLoading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') {
      onOpenFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onOpenFile(file);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 overflow-y-auto">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="max-w-2xl w-full text-center space-y-6">
        {/* Title & Badge */}
        <div className="space-y-3">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>100% Client-Side In-Place PDF Editor</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Edit PDFs Directly In Your Browser
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
            Click existing text to modify wording in-place with auto font matching, organize & merge pages, and insert vector shapes.
          </p>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 transition-all cursor-pointer flex flex-col items-center justify-center space-y-4 bg-white dark:bg-slate-900/60 ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 scale-[1.01]'
              : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:shadow-lg'
          }`}
        >
          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <FileUp className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
              Drag & Drop your PDF document here
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              or click to browse from your device
            </p>
          </div>

          <button
            type="button"
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs sm:text-sm shadow-sm transition-all"
          >
            {isLoading ? 'Opening PDF...' : 'Choose PDF File'}
          </button>
        </div>

        {/* 1-Click Demo / Sample PDF */}
        <div className="flex items-center justify-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Want to test immediately?</span>
          <button
            onClick={onOpenSample}
            disabled={isLoading}
            className="inline-flex items-center space-x-1 font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <span>Try Sample Agreement</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Feature Pills */}
        <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-xs flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">In-Place Editing</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Click any paragraph or number to edit inline with automatic font matching.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-xs flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Page Management</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Reorder, rotate, duplicate, delete, and merge pages from multiple PDFs.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-xs flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">100% Private</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Zero uploads. All parsing and export happen in browser memory.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
