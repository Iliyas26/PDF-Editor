export interface PageDescriptor {
  id: string;
  source: 'original' | 'blank' | 'imported';
  sourcePageIndex: number; // original 0-indexed page in document
  importedDocKey?: string; // key in importedDocs map
  rotation: number; // 0, 90, 180, 270
  width: number;
  height: number;
}

export interface TextEditItem {
  id: string;
  pageId: string; // targets the unique page id
  originalText: string;
  newText: string;
  x: number; // PDF points from left
  y: number; // PDF points from bottom (PDF coords)
  width: number; // PDF points
  height: number; // PDF points
  fontSize: number;
  fontFamily: string;
  color: { r: number; g: number; b: number };
  isDeleted?: boolean;
}

export interface ImageEditItem {
  id: string;
  pageId: string;
  x: number; // PDF points
  y: number; // PDF points
  width: number;
  height: number;
  replacementDataUrl?: string; // base64 image data
  isDeleted?: boolean;
}

export interface CustomElement {
  id: string;
  pageId: string;
  type: 'text' | 'image' | 'rectangle' | 'line' | 'arrow';
  x: number; // PDF points from left
  y: number; // PDF points from bottom
  width: number; // PDF points
  height: number; // PDF points
  text?: string;
  fontSize?: number;
  textColor?: string;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  imageDataUrl?: string;
}

export interface ImportedDocument {
  id: string;
  name: string;
  bytes: Uint8Array;
}

export interface DetectedTextItem {
  id: string;
  str: string;
  x: number; // PDF points
  y: number; // PDF points
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
  transform: number[];
}

export interface DetectedImageItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ActiveTool = 'select' | 'editText' | 'addText' | 'addImage' | 'rect' | 'line' | 'arrow';

export interface EditorHistorySnapshot {
  pages: PageDescriptor[];
  textEdits: TextEditItem[];
  imageEdits: ImageEditItem[];
  customElements: CustomElement[];
}
