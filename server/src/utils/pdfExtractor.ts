/**
 * PDF Text Extraction Utility
 * 
 * This module provides utilities for extracting text content from PDF files
 * using pdf-parse (which internally uses pdfjs). The extracted text is structured
 * with page indices, making it suitable for use as context in AI prompts (e.g., Groq).
 * 
 * Key features:
 * - Extracts text per page with page numbers
 * - Provides metadata about the PDF document
 * - Returns structured data suitable for prompt engineering
 * - Handles errors gracefully with detailed logging
 */

import pdf from 'pdf-parse';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { ExtractedText, PageText, PDFMetadata } from '../types/annotations';

/**
 * Extracts text content from a PDF buffer with page-level granularity
 * Uses pdfjs-dist for accurate page-by-page text extraction
 * 
 * @param pdfBuffer - The PDF file as a Buffer
 * @returns Promise<ExtractedText> - Structured text data with page information
 * @throws Error if PDF parsing fails
 * 
 * @example
 * ```typescript
 * const pdfBuffer = fs.readFileSync('document.pdf');
 * const extracted = await extractTextFromPDF(pdfBuffer);
 * console.log(`Extracted ${extracted.totalPages} pages`);
 * extracted.pages.forEach(page => {
 *   console.log(`Page ${page.pageNumber}: ${page.text.substring(0, 100)}...`);
 * });
 * ```
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<ExtractedText> {
  try {
    // Extract pages with individual text content using pdfjs-dist for accurate extraction
    const pages: PageText[] = [];
    
    // Use pdfjs-dist for accurate page-by-page extraction
    const uint8Array = new Uint8Array(pdfBuffer);
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;
    
    console.log(`[PDF Extractor] Loading ${numPages} pages with pdfjs-dist`);

    // Extract text from each page
    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      
      // Combine text items into a single string with proper spacing
      let pageText = '';
      let lastY = -1;
      
      textContent.items.forEach((item: any, index: number) => {
        // Handle text items (some items might not have str property)
        if ('str' in item && item.str) {
          const currentY = item.transform ? item.transform[5] : 0;
          
          // Add newline if we've moved to a different Y position (new line)
          if (lastY !== -1 && Math.abs(currentY - lastY) > 5) {
            pageText += '\n';
          } else if (index > 0 && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
            // Add space between items on same line
            pageText += ' ';
          }
          
          pageText += item.str;
          lastY = currentY;
        }
      });
      
      pages.push({
        pageNumber: i,
        text: pageText.trim(),
        lines: pageText.split('\n').filter(line => line.trim().length > 0)
      });
      
      console.log(`[PDF Extractor] Extracted page ${i}: ${pageText.length} chars`);
    }

    // Extract metadata using pdf-parse
    const pdfData = await pdf(pdfBuffer);
    const metadata: PDFMetadata = {
      title: pdfData.info?.Title,
      author: pdfData.info?.Author,
      subject: pdfData.info?.Subject,
      creator: pdfData.info?.Creator,
      producer: pdfData.info?.Producer,
      creationDate: pdfData.info?.CreationDate ? new Date(pdfData.info.CreationDate) : undefined,
      modificationDate: pdfData.info?.ModDate ? new Date(pdfData.info.ModDate) : undefined
    };

    console.log(`[PDF Extractor] Successfully extracted text from ${numPages} pages`);

    return {
      pages,
      totalPages: numPages,
      metadata
    };
  } catch (error) {
    console.error('[PDF Extractor] Error extracting text from PDF:', error);
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extracts text from a specific page
 * 
 * @param pdfBuffer - The PDF file as a Buffer
 * @param pageNumber - The page number to extract (1-based)
 * @returns Promise<PageText> - Text content of the specified page
 * @throws Error if page number is invalid or extraction fails
 */
export async function extractTextFromPage(pdfBuffer: Buffer, pageNumber: number): Promise<PageText> {
  const extracted = await extractTextFromPDF(pdfBuffer);
  
  if (pageNumber < 1 || pageNumber > extracted.totalPages) {
    throw new Error(`Invalid page number: ${pageNumber}. PDF has ${extracted.totalPages} pages.`);
  }
  
  const page = extracted.pages.find(p => p.pageNumber === pageNumber);
  if (!page) {
    throw new Error(`Could not extract text from page ${pageNumber}`);
  }
  
  return page;
}

/**
 * Formats extracted text for use in AI prompts (e.g., Groq)
 * Creates a structured string with clear page demarcations
 * 
 * @param extracted - The extracted text data
 * @param options - Formatting options
 * @returns Formatted string suitable for AI prompts
 * 
 * @example
 * ```typescript
 * const extracted = await extractTextFromPDF(pdfBuffer);
 * const promptContext = formatForPrompt(extracted, { maxCharsPerPage: 500 });
 * const groqPrompt = `Analyze this document:\n\n${promptContext}\n\nProvide key insights.`;
 * ```
 */
export function formatForPrompt(
  extracted: ExtractedText,
  options: {
    maxCharsPerPage?: number;
    includeMetadata?: boolean;
    pageDelimiter?: string;
  } = {}
): string {
  const {
    maxCharsPerPage = Infinity,
    includeMetadata = true,
    pageDelimiter = '\n\n---\n\n'
  } = options;

  let formatted = '';

  // Add metadata if requested
  if (includeMetadata && extracted.metadata) {
    const meta = extracted.metadata;
    formatted += 'Document Metadata:\n';
    if (meta.title) formatted += `Title: ${meta.title}\n`;
    if (meta.author) formatted += `Author: ${meta.author}\n`;
    if (meta.subject) formatted += `Subject: ${meta.subject}\n`;
    formatted += `Total Pages: ${extracted.totalPages}\n`;
    formatted += pageDelimiter;
  }

  // Add page content
  extracted.pages.forEach(page => {
    let pageText = page.text;
    
    // Truncate if needed
    if (maxCharsPerPage < Infinity && pageText.length > maxCharsPerPage) {
      pageText = pageText.substring(0, maxCharsPerPage) + '...';
    }
    
    formatted += `[Page ${page.pageNumber}]\n${pageText}${pageDelimiter}`;
  });

  return formatted.trim();
}

/**
 * Searches for text across all pages and returns matching page numbers
 * 
 * @param extracted - The extracted text data
 * @param searchText - Text to search for
 * @param caseSensitive - Whether search should be case-sensitive (default: false)
 * @returns Array of page numbers where the text was found
 */
export function findTextInPages(
  extracted: ExtractedText,
  searchText: string,
  caseSensitive: boolean = false
): number[] {
  const searchTerm = caseSensitive ? searchText : searchText.toLowerCase();
  
  return extracted.pages
    .filter(page => {
      const pageText = caseSensitive ? page.text : page.text.toLowerCase();
      return pageText.includes(searchTerm);
    })
    .map(page => page.pageNumber);
}
