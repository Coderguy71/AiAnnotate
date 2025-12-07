/**
 * Annotation API Route
 * 
 * This module provides the HTTP endpoint for PDF annotation.
 * It demonstrates how to use the PDF utilities in a clean, type-safe manner.
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { annotatePDF } from '../utils/pdfAnnotator';
import { extractTextFromPDF, formatForPrompt } from '../utils/pdfExtractor';
import { AnnotationType, AnnotationRequest } from '../types/annotations';

const router = Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

/**
 * POST /api/annotate
 * 
 * Annotates a PDF based on provided instructions or AI-generated annotations.
 * 
 * Request body (multipart/form-data):
 * - pdf: PDF file (required)
 * - prompt: Optional user prompt for AI-based annotation generation
 * - instructions: Optional JSON string of AnnotationInstruction[]
 * 
 * Response:
 * - Content-Type: application/pdf
 * - Body: Annotated PDF file
 */
router.post('/annotate', upload.single('pdf'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const pdfBuffer = req.file.buffer;
    const userPrompt = req.body.prompt || '';
    const instructionsJson = req.body.instructions;

    console.log(`[Annotate Route] Processing PDF: ${req.file.originalname} (${req.file.size} bytes)`);
    console.log(`[Annotate Route] User prompt: ${userPrompt || 'None'}`);

    // Extract text from PDF
    const extractedText = await extractTextFromPDF(pdfBuffer);
    console.log(`[Annotate Route] Extracted text from ${extractedText.totalPages} pages`);

    // Determine annotation instructions
    let annotationRequest: AnnotationRequest;

    if (instructionsJson) {
      // Use provided instructions
      try {
        const instructions = JSON.parse(instructionsJson);
        annotationRequest = { instructions };
        console.log(`[Annotate Route] Using ${instructions.length} provided instructions`);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid instructions JSON' });
      }
    } else {
      // Generate sample annotations or use AI (Groq integration would go here)
      // For now, we'll create demo annotations based on the document content
      annotationRequest = await generateAnnotations(extractedText, userPrompt);
      console.log(`[Annotate Route] Generated ${annotationRequest.instructions.length} annotations`);
    }

    // Apply annotations to PDF
    const result = await annotatePDF(pdfBuffer, annotationRequest);

    if (!result.success || !result.pdfBuffer) {
      console.error(`[Annotate Route] Annotation failed:`, result.warnings);
      return res.status(500).json({
        error: 'Failed to annotate PDF',
        details: result.warnings,
        results: result.results,
      });
    }

    // Log results
    const successCount = result.results.filter(r => r.success).length;
    console.log(`[Annotate Route] Successfully applied ${successCount}/${result.results.length} annotations`);
    
    if (result.warnings && result.warnings.length > 0) {
      console.warn(`[Annotate Route] Warnings:`, result.warnings);
    }

    // Return annotated PDF
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="annotated.pdf"',
      'Content-Length': result.pdfBuffer.length,
    });

    res.send(result.pdfBuffer);

  } catch (error) {
    console.error('[Annotate Route] Error processing request:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/extract
 * 
 * Extracts text from a PDF for preview or analysis.
 * 
 * Request body (multipart/form-data):
 * - pdf: PDF file (required)
 * 
 * Response:
 * - Content-Type: application/json
 * - Body: ExtractedText object
 */
router.post('/extract', upload.single('pdf'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const pdfBuffer = req.file.buffer;
    console.log(`[Extract Route] Extracting text from: ${req.file.originalname}`);

    const extractedText = await extractTextFromPDF(pdfBuffer);
    
    res.json({
      success: true,
      data: extractedText,
      formatted: formatForPrompt(extractedText, { maxCharsPerPage: 500 }),
    });

  } catch (error) {
    console.error('[Extract Route] Error processing request:', error);
    res.status(500).json({
      error: 'Failed to extract text from PDF',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Helper function to generate sample annotations
 * In a real application, this would call Groq API to generate intelligent annotations
 */
async function generateAnnotations(extractedText: any, userPrompt: string): Promise<AnnotationRequest> {
  // This is a placeholder for AI-generated annotations
  // In production, you would:
  // 1. Format the extracted text for Groq
  // 2. Send a prompt to Groq API
  // 3. Parse Groq's response to generate annotation instructions
  
  const instructions = [];

  // Demo: Create some sample annotations based on common patterns
  for (const page of extractedText.pages) {
    const text = page.text.toLowerCase();
    
    // Look for common patterns to highlight
    if (text.includes('important') || text.includes('note')) {
      const match = page.text.match(/(important|note)[^.!?]*/i);
      if (match) {
        instructions.push({
          type: AnnotationType.HIGHLIGHT,
          text: match[0].substring(0, 50),
          pageNumber: page.pageNumber,
        });
      }
    }
    
    // Look for conclusions or summaries
    if (text.includes('conclusion') || text.includes('summary')) {
      const match = page.text.match(/(conclusion|summary)[^.!?]*/i);
      if (match) {
        instructions.push({
          type: AnnotationType.UNDERLINE,
          text: match[0].substring(0, 50),
          pageNumber: page.pageNumber,
        });
      }
    }
  }

  // If user provided a prompt, add a comment about it
  if (userPrompt) {
    instructions.push({
      type: AnnotationType.COMMENT,
      text: extractedText.pages[0]?.text.substring(0, 20) || 'Document',
      comment: `User request: ${userPrompt.substring(0, 50)}`,
      pageNumber: 1,
    });
  }

  // If no annotations were generated, add a default one
  if (instructions.length === 0 && extractedText.pages.length > 0) {
    const firstPageText = extractedText.pages[0].text;
    const snippet = firstPageText.substring(0, Math.min(30, firstPageText.length));
    
    instructions.push({
      type: AnnotationType.HIGHLIGHT,
      text: snippet,
      pageNumber: 1,
    });
  }

  return { instructions };
}

export default router;
