/**
 * PDF Annotation Utility
 * 
 * This module provides utilities for applying visual annotations to PDF files
 * using pdf-lib. It supports highlights, underlines, and comment callouts.
 * 
 * Key features:
 * - Locates text snippets with fuzzy/tolerant matching
 * - Draws highlights, underlines, and comment callouts
 * - Handles cases where text is not found with fallback behavior
 * - Comprehensive logging for debugging
 * 
 * Assumptions:
 * - First match per page: When multiple instances of text exist on a page,
 *   only the first occurrence is annotated (configurable via options)
 * - Text search: Uses string matching with configurable tolerance
 * - Coordinate estimation: Since pdf-lib doesn't provide text extraction with
 *   coordinates, we estimate positions based on page layout
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import {
  AnnotationType,
  AnnotationInstruction,
  AnnotationRequest,
  AnnotationResponse,
  AnnotationResult,
  AnnotationColor,
  AnnotationOptions,
  DEFAULT_COLORS,
  DEFAULT_ANNOTATION_OPTIONS,
  TextPosition
} from '../types/annotations';
import { extractTextFromPDF } from './pdfExtractor';

/**
 * Applies annotations to a PDF document
 * 
 * @param pdfBuffer - The original PDF as a Buffer
 * @param request - Annotation instructions and options
 * @returns Promise<AnnotationResponse> - Results and annotated PDF buffer
 * 
 * @example
 * ```typescript
 * const pdfBuffer = fs.readFileSync('input.pdf');
 * const response = await annotatePDF(pdfBuffer, {
 *   instructions: [
 *     { type: AnnotationType.HIGHLIGHT, text: 'Important note', pageNumber: 1 },
 *     { type: AnnotationType.COMMENT, text: 'Key finding', comment: 'This needs review' }
 *   ]
 * });
 * 
 * if (response.success && response.pdfBuffer) {
 *   fs.writeFileSync('output.pdf', response.pdfBuffer);
 * }
 * ```
 */
export async function annotatePDF(
  pdfBuffer: Buffer,
  request: AnnotationRequest
): Promise<AnnotationResponse> {
  const options: Required<AnnotationOptions> = {
    ...DEFAULT_ANNOTATION_OPTIONS,
    ...request.options
  };

  console.log(`[PDF Annotator] Starting annotation process with ${request.instructions.length} instructions`);

  const results: AnnotationResult[] = [];
  const warnings: string[] = [];

  try {
    // Load the PDF document
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    
    // Extract text for searching
    const extractedText = await extractTextFromPDF(pdfBuffer);
    
    console.log(`[PDF Annotator] PDF loaded: ${pages.length} pages`);

    // Process each annotation instruction
    for (const instruction of request.instructions) {
      const result = await applyAnnotation(
        pdfDoc,
        extractedText,
        instruction,
        options
      );
      
      results.push(result);
      
      if (!result.success && options.logNotFound) {
        const message = `Failed to apply ${instruction.type} annotation for text "${instruction.text}": ${result.error}`;
        console.warn(`[PDF Annotator] ${message}`);
        if (!options.skipNotFound) {
          warnings.push(message);
        }
      } else if (result.success) {
        console.log(
          `[PDF Annotator] Successfully applied ${instruction.type} annotation on page ${result.position?.pageNumber}`
        );
      }
    }

    // Save the modified PDF
    const annotatedPdfBytes = await pdfDoc.save();
    const annotatedPdfBuffer = Buffer.from(annotatedPdfBytes);

    const successCount = results.filter(r => r.success).length;
    console.log(`[PDF Annotator] Annotation complete: ${successCount}/${results.length} successful`);

    return {
      success: successCount > 0,
      results,
      warnings: warnings.length > 0 ? warnings : undefined,
      pdfBuffer: annotatedPdfBuffer
    };
  } catch (error) {
    console.error('[PDF Annotator] Error during annotation process:', error);
    throw new Error(`Failed to annotate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Applies a single annotation instruction to the PDF
 */
async function applyAnnotation(
  pdfDoc: PDFDocument,
  extractedText: any,
  instruction: AnnotationInstruction,
  options: Required<AnnotationOptions>
): Promise<AnnotationResult> {
  try {
    // Find the text in the document
    const textPosition = findTextPosition(
      extractedText,
      instruction,
      options
    );

    if (!textPosition) {
      return {
        instruction,
        success: false,
        error: 'Text not found in document'
      };
    }

    // Get the page
    const page = pdfDoc.getPage(textPosition.pageNumber - 1); // pdf-lib uses 0-based indexing
    const { width, height } = page.getSize();

    // Get color for annotation
    const color = instruction.color || DEFAULT_COLORS[instruction.type];

    // Apply annotation based on type
    switch (instruction.type) {
      case AnnotationType.HIGHLIGHT:
        await drawHighlight(page, textPosition, color, width, height);
        break;
      
      case AnnotationType.UNDERLINE:
        await drawUnderline(page, textPosition, color, width, height);
        break;
      
      case AnnotationType.COMMENT:
        await drawComment(
          page,
          pdfDoc,
          textPosition,
          instruction.comment || 'Comment',
          color,
          width,
          height
        );
        break;
      
      default:
        return {
          instruction,
          success: false,
          error: `Unknown annotation type: ${instruction.type}`
        };
    }

    return {
      instruction,
      success: true,
      matchedText: textPosition.text,
      position: textPosition
    };
  } catch (error) {
    return {
      instruction,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Normalizes text for better matching:
 * - Collapses multiple spaces/newlines to single space
 * - Trims leading/trailing whitespace
 * - Normalizes quotes and dashes
 */
function normalizeText(text: string): string {
  return text
    // Replace all whitespace (including newlines, tabs) with single space
    .replace(/\s+/g, ' ')
    // Normalize quotes
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    // Normalize dashes
    .replace(/[–—]/g, '-')
    .trim();
}

/**
 * Finds the position of text in the document using multiple matching strategies
 * 
 * Strategy order:
 * 1. Exact match (after normalization)
 * 2. Partial match with first 50 chars
 * 3. Partial match with first 30 chars
 * 4. Fuzzy match with Levenshtein distance
 * 
 * Note: This is a simplified implementation that estimates text position.
 * In a production environment, you would want to use a more sophisticated
 * approach with actual text coordinates from PDF parsing.
 */
function findTextPosition(
  extractedText: any,
  instruction: AnnotationInstruction,
  options: Required<AnnotationOptions>
): TextPosition | null {
  const searchText = instruction.caseSensitive
    ? instruction.text
    : instruction.text.toLowerCase();

  // Normalize the search text
  const normalizedSearchText = normalizeText(searchText);
  
  console.log(`[PDF Annotator] Searching for text: "${instruction.text.substring(0, 50)}..."`);
  console.log(`[PDF Annotator] Normalized search text: "${normalizedSearchText.substring(0, 50)}..."`);

  // Determine which pages to search
  const pagesToSearch = instruction.pageNumber
    ? extractedText.pages.filter((p: any) => p.pageNumber === instruction.pageNumber)
    : extractedText.pages;

  console.log(`[PDF Annotator] Searching ${pagesToSearch.length} page(s)`);

  for (const page of pagesToSearch) {
    const pageText = instruction.caseSensitive
      ? page.text
      : page.text.toLowerCase();

    const normalizedPageText = normalizeText(pageText);
    
    console.log(`[PDF Annotator] Checking page ${page.pageNumber} (${normalizedPageText.length} chars)`);

    // Strategy 1: Exact match on normalized text
    let index = normalizedPageText.indexOf(normalizedSearchText);
    if (index !== -1) {
      console.log(`[PDF Annotator] ✓ Found exact match on page ${page.pageNumber} at index ${index}`);
      return createTextPosition(page.pageNumber, instruction.text, index, normalizedSearchText);
    }
    console.log('[PDF Annotator] ✗ Exact match failed, trying partial match (50 chars)');

    // Strategy 2: Partial match with first 50 chars
    if (normalizedSearchText.length > 50) {
      const partialSearch50 = normalizedSearchText.substring(0, 50);
      index = normalizedPageText.indexOf(partialSearch50);
      if (index !== -1) {
        console.log(`[PDF Annotator] ✓ Found partial match (50 chars) on page ${page.pageNumber} at index ${index}`);
        return createTextPosition(page.pageNumber, instruction.text, index, partialSearch50);
      }
      console.log('[PDF Annotator] ✗ Partial match (50 chars) failed, trying partial match (30 chars)');
    }

    // Strategy 3: Partial match with first 30 chars
    if (normalizedSearchText.length > 30) {
      const partialSearch30 = normalizedSearchText.substring(0, 30);
      index = normalizedPageText.indexOf(partialSearch30);
      if (index !== -1) {
        console.log(`[PDF Annotator] ✓ Found partial match (30 chars) on page ${page.pageNumber} at index ${index}`);
        return createTextPosition(page.pageNumber, instruction.text, index, partialSearch30);
      }
      console.log('[PDF Annotator] ✗ Partial match (30 chars) failed, trying fuzzy match');
    }

    // Strategy 4: Fuzzy matching with Levenshtein distance
    if (options.matchTolerance > 0) {
      const fuzzyResult = fuzzySearchWithNormalization(
        normalizedPageText,
        normalizedSearchText,
        options.matchTolerance
      );
      if (fuzzyResult.index !== -1) {
        console.log(
          `[PDF Annotator] ✓ Found fuzzy match on page ${page.pageNumber} at index ${fuzzyResult.index} ` +
          `(distance: ${fuzzyResult.distance}, matched: "${fuzzyResult.matchedText.substring(0, 30)}...")`
        );
        return createTextPosition(page.pageNumber, instruction.text, fuzzyResult.index, fuzzyResult.matchedText);
      }
      console.log('[PDF Annotator] ✗ Fuzzy match failed');
    }

    // Try original exact match as fallback (without normalization)
    index = pageText.indexOf(searchText);
    if (index !== -1) {
      console.log(`[PDF Annotator] ✓ Found exact match (non-normalized) on page ${page.pageNumber} at index ${index}`);
      return createTextPosition(page.pageNumber, instruction.text, index, searchText);
    }

    // If firstMatchOnly is true, we stop after checking all specified pages once
    if (options.firstMatchOnly) {
      break;
    }
  }

  console.log('[PDF Annotator] ✗ Text not found after trying all strategies');
  return null;
}

/**
 * Creates a TextPosition object with estimated coordinates
 */
function createTextPosition(
  pageNumber: number,
  originalText: string,
  charIndex: number,
  matchedText: string
): TextPosition {
  return {
    pageNumber,
    text: originalText,
    // Estimate x, y based on character position in text
    // These are rough estimates and will be refined in the drawing functions
    x: 50, // Start with left margin
    y: 700 - (Math.floor(charIndex / 100) * 20), // Rough vertical position
    width: matchedText.length * 6, // Rough width estimate
    height: 12 // Standard text height
  };
}

/**
 * Performs fuzzy text search with tolerance on normalized text
 * Returns best match with details or -1 if no match within tolerance
 */
function fuzzySearchWithNormalization(
  text: string,
  pattern: string,
  tolerance: number
): { index: number; distance: number; matchedText: string } {
  const maxDistance = Math.floor(pattern.length * tolerance);
  let bestMatch = { index: -1, distance: Infinity, matchedText: '' };
  
  // Limit search scope for performance
  const maxSearchLength = Math.min(text.length, pattern.length * 100);
  
  for (let i = 0; i <= Math.min(text.length - pattern.length, maxSearchLength); i++) {
    const substring = text.substring(i, i + pattern.length);
    const distance = levenshteinDistance(substring, pattern);
    
    // If we find an exact or very close match, return immediately
    if (distance <= maxDistance) {
      if (distance < bestMatch.distance) {
        bestMatch = { index: i, distance, matchedText: substring };
      }
      
      // If we found a very good match, return early
      if (distance <= 2) {
        return bestMatch;
      }
    }
  }
  
  return bestMatch;
}

/**
 * Calculates Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Draws a highlight annotation on the PDF page
 */
async function drawHighlight(
  page: any,
  position: TextPosition,
  color: AnnotationColor,
  _pageWidth: number,
  pageHeight: number
): Promise<void> {
  const x = position.x || 50;
  const y = position.y || pageHeight - 100;
  const width = position.width || 100;
  const height = position.height || 12;

  // Draw a semi-transparent rectangle
  page.drawRectangle({
    x: x - 2,
    y: y - 2,
    width: width + 4,
    height: height + 4,
    color: rgb(color.r, color.g, color.b),
    opacity: color.a || 0.3,
  });
}

/**
 * Draws an underline annotation on the PDF page
 */
async function drawUnderline(
  page: any,
  position: TextPosition,
  color: AnnotationColor,
  _pageWidth: number,
  pageHeight: number
): Promise<void> {
  const x = position.x || 50;
  const y = position.y || pageHeight - 100;
  const width = position.width || 100;

  // Draw a line under the text
  page.drawLine({
    start: { x, y: y - 2 },
    end: { x: x + width, y: y - 2 },
    thickness: 1.5,
    color: rgb(color.r, color.g, color.b),
    opacity: color.a || 1,
  });
}

/**
 * Draws a comment callout on the PDF page
 */
async function drawComment(
  page: any,
  pdfDoc: PDFDocument,
  position: TextPosition,
  comment: string,
  color: AnnotationColor,
  pageWidth: number,
  pageHeight: number
): Promise<void> {
  const x = position.x || 50;
  const y = position.y || pageHeight - 100;
  
  // Position comment in margin
  const commentX = pageWidth - 150;
  const commentY = y;
  const commentWidth = 140;
  const commentHeight = 60;

  // Draw comment box
  page.drawRectangle({
    x: commentX,
    y: commentY - commentHeight,
    width: commentWidth,
    height: commentHeight,
    color: rgb(color.r, color.g, color.b),
    opacity: color.a || 0.8,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  });

  // Draw connector line from text to comment
  page.drawLine({
    start: { x: x + (position.width || 100), y: y + 6 },
    end: { x: commentX, y: commentY - commentHeight / 2 },
    thickness: 0.5,
    color: rgb(0, 0, 0),
    opacity: 0.5,
  });

  // Add comment text
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 8;
  
  // Wrap text to fit in comment box
  const words = comment.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const textWidth = font.widthOfTextAtSize(testLine, fontSize);
    
    if (textWidth < commentWidth - 10) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  // Draw text lines (max 5 lines to fit in box)
  const maxLines = Math.min(lines.length, 5);
  for (let i = 0; i < maxLines; i++) {
    page.drawText(lines[i], {
      x: commentX + 5,
      y: commentY - commentHeight + 45 - (i * 10),
      size: fontSize,
      font: font,
      color: rgb(0, 0, 0),
    });
  }
}

