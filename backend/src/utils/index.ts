/**
 * PDF Annotation Utilities - Main Export
 * 
 * This file provides a convenient single import point for all PDF utilities.
 */

// Export all types
export * from '../types/annotations';

// Export text extraction utilities
export {
  extractTextFromPDF,
  extractTextFromPage,
  formatForPrompt,
  findTextInPages
} from './pdfExtractor';

// Export annotation utilities
export {
  annotatePDF
} from './pdfAnnotator';
