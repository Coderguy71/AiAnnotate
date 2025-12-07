/**
 * PDF Annotation Type Definitions
 * 
 * This module defines TypeScript interfaces for PDF annotations and related structures.
 * These types ensure type safety throughout the annotation pipeline.
 */

/**
 * Supported annotation action types
 */
export enum AnnotationType {
  HIGHLIGHT = 'highlight',
  UNDERLINE = 'underline',
  COMMENT = 'comment'
}

/**
 * Color options for annotations
 */
export interface AnnotationColor {
  r: number; // Red (0-1)
  g: number; // Green (0-1)
  b: number; // Blue (0-1)
  a?: number; // Alpha/opacity (0-1), optional
}

/**
 * Position information for text in a PDF
 */
export interface TextPosition {
  pageNumber: number; // 1-based page number
  text: string; // The text to annotate
  x?: number; // X coordinate (if known)
  y?: number; // Y coordinate (if known)
  width?: number; // Width of text (if known)
  height?: number; // Height of text (if known)
}

/**
 * Single annotation instruction
 * Represents one annotation to be applied to the PDF
 */
export interface AnnotationInstruction {
  type: AnnotationType;
  text: string; // Text snippet to locate and annotate
  pageNumber?: number; // Optional: limit search to specific page
  color?: AnnotationColor; // Optional: custom color (defaults provided)
  comment?: string; // Required for COMMENT type, optional for others
  caseSensitive?: boolean; // Whether text matching should be case-sensitive (default: false)
}

/**
 * Complete annotation request
 * Contains all annotations to be applied to a PDF
 */
export interface AnnotationRequest {
  instructions: AnnotationInstruction[];
  options?: AnnotationOptions;
}

/**
 * Options for annotation processing
 */
export interface AnnotationOptions {
  matchTolerance?: number; // Character difference tolerance for fuzzy matching (0-1, default: 0.1)
  firstMatchOnly?: boolean; // Only annotate first occurrence per page (default: true)
  skipNotFound?: boolean; // Skip annotations if text not found (default: true)
  logNotFound?: boolean; // Log when text is not found (default: true)
}

/**
 * Result of a single annotation operation
 */
export interface AnnotationResult {
  instruction: AnnotationInstruction;
  success: boolean;
  matchedText?: string; // Actual text that was matched (may differ slightly due to tolerance)
  position?: TextPosition; // Where the annotation was applied
  error?: string; // Error message if unsuccessful
}

/**
 * Complete annotation response
 */
export interface AnnotationResponse {
  success: boolean;
  results: AnnotationResult[];
  warnings?: string[];
  pdfBuffer?: Buffer; // The annotated PDF data
}

/**
 * Extracted text from a PDF page
 */
export interface PageText {
  pageNumber: number; // 1-based page number
  text: string; // Full text content of the page
  lines?: string[]; // Optional: text split by lines
}

/**
 * Complete text extraction result
 */
export interface ExtractedText {
  pages: PageText[];
  totalPages: number;
  metadata?: PDFMetadata;
}

/**
 * PDF document metadata
 */
export interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
}

/**
 * Default colors for different annotation types
 */
export const DEFAULT_COLORS: Record<AnnotationType, AnnotationColor> = {
  [AnnotationType.HIGHLIGHT]: { r: 1, g: 1, b: 0, a: 0.3 }, // Yellow with 30% opacity
  [AnnotationType.UNDERLINE]: { r: 1, g: 0, b: 0, a: 1 }, // Red, fully opaque
  [AnnotationType.COMMENT]: { r: 0, g: 0.5, b: 1, a: 0.8 } // Blue with 80% opacity
};

/**
 * Default annotation options
 */
export const DEFAULT_ANNOTATION_OPTIONS: Required<AnnotationOptions> = {
  matchTolerance: 0.1,
  firstMatchOnly: true,
  skipNotFound: true,
  logNotFound: true
};
