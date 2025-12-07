/**
 * Annotation API Route
 * 
 * This module provides the HTTP endpoint for PDF annotation.
 * It demonstrates how to use the PDF utilities in a clean, type-safe manner.
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { annotatePDF } from '../utils/pdfAnnotator';
import { extractTextFromPDF, formatForPrompt } from '../utils/pdfExtractor';
import { generateAnnotationsWithGroq } from '../utils/groqService';
import { AnnotationRequest } from '../types/annotations';

const router = Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// Error handling middleware for multer
const handleMulterError = (
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        error: 'File too large',
        message: 'PDF file must be smaller than 10MB',
      });
      return;
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({
        error: 'Invalid request',
        message: 'Only one file is allowed',
      });
      return;
    }
    res.status(400).json({
      error: 'Upload error',
      message: err.message,
    });
    return;
  }
  if (err instanceof Error && err.message === 'Only PDF files are allowed') {
    res.status(400).json({
      error: 'Invalid file type',
      message: 'Only PDF files are allowed',
    });
    return;
  }
  next(err);
};

/**
 * POST /api/annotate
 * 
 * Annotates a PDF based on provided instructions or AI-generated annotations via Groq.
 * 
 * Request body (multipart/form-data):
 * - pdf: PDF file (required)
 * - prompt: Optional user prompt for AI-based annotation generation via Groq
 * - instructions: Optional JSON string of AnnotationInstruction[]
 * - timeout: Optional timeout in milliseconds for Groq API (default: 30000)
 * 
 * Response:
 * - Content-Type: application/pdf
 * - Body: Annotated PDF file
 * 
 * Status Codes:
 * - 200: Success
 * - 400: Validation error (missing file, invalid JSON, etc.)
 * - 413: File too large
 * - 500: Server error (API failure, annotation error)
 * - 504: Timeout (Groq API request timeout)
 */
router.post(
  '/annotate',
  upload.single('pdf'),
  handleMulterError,
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate file upload
      if (!req.file) {
        res.status(400).json({
          error: 'Validation error',
          message: 'No PDF file uploaded. Please provide a PDF file.',
        });
        return;
      }

      const pdfBuffer = req.file.buffer;
      const userPrompt = req.body.prompt ? String(req.body.prompt).trim() : '';
      const instructionsJson = req.body.instructions;
      const timeout = req.body.timeout ? parseInt(req.body.timeout, 10) : 30000;

      console.log(
        `[Annotate Route] Processing PDF: ${req.file.originalname} (${req.file.size} bytes)`
      );
      console.log(`[Annotate Route] User prompt provided: ${userPrompt ? 'Yes' : 'No'}`);
      console.log(`[Annotate Route] Request timeout: ${timeout}ms`);

      // Extract text from PDF
      console.log('[Annotate Route] Extracting text from PDF...');
      let extractedText;
      try {
        extractedText = await extractTextFromPDF(pdfBuffer);
      } catch (error) {
        console.error('[Annotate Route] PDF extraction failed:', error);
        res.status(400).json({
          error: 'Invalid PDF',
          message: 'Failed to extract text from PDF. The file may be corrupted or unsupported.',
        });
        return;
      }

      console.log(`[Annotate Route] Extracted text from ${extractedText.totalPages} pages`);

      // Determine annotation instructions
      let annotationRequest: AnnotationRequest;

      if (instructionsJson) {
        // Use provided instructions
        try {
          const instructions = JSON.parse(instructionsJson);
          if (!Array.isArray(instructions)) {
            res.status(400).json({
              error: 'Validation error',
              message: 'instructions must be a JSON array',
            });
            return;
          }
          annotationRequest = { instructions };
          console.log(`[Annotate Route] Using ${instructions.length} provided instructions`);
        } catch (error) {
          res.status(400).json({
            error: 'Validation error',
            message: 'Invalid instructions JSON format',
          });
          return;
        }
      } else if (userPrompt) {
        // Generate annotations using Groq AI
        console.log('[Annotate Route] Generating annotations with Groq AI...');
        try {
          const instructions = await generateAnnotationsWithGroq(
            extractedText,
            userPrompt,
            timeout
          );
          annotationRequest = { instructions };
          console.log(
            `[Annotate Route] Generated ${instructions.length} annotations from Groq AI`
          );
        } catch (error) {
          console.error('[Annotate Route] Groq API error:', error);
          if (error instanceof Error && error.message.includes('timeout')) {
            res.status(504).json({
              error: 'Gateway timeout',
              message: 'Groq API request timed out. Please try again with a shorter prompt.',
            });
            return;
          }
          res.status(500).json({
            error: 'AI annotation failed',
            message: error instanceof Error ? error.message : 'Failed to generate annotations',
          });
          return;
        }
      } else {
        // No instructions and no prompt - return error
        res.status(400).json({
          error: 'Validation error',
          message: 'Either provide a prompt for AI annotation or instructions JSON',
        });
        return;
      }

      // Validate that we have instructions
      if (!annotationRequest.instructions || annotationRequest.instructions.length === 0) {
        console.log('[Annotate Route] No annotations to apply');
        // Return original PDF if no annotations
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="annotated.pdf"',
          'Content-Length': pdfBuffer.length,
        });
        res.send(pdfBuffer);
        return;
      }

      // Apply annotations to PDF
      console.log('[Annotate Route] Applying annotations to PDF...');
      let result;
      try {
        result = await annotatePDF(pdfBuffer, annotationRequest);
      } catch (error) {
        console.error('[Annotate Route] Annotation application failed:', error);
        res.status(500).json({
          error: 'Annotation failed',
          message: error instanceof Error ? error.message : 'Failed to apply annotations to PDF',
        });
        return;
      }

      if (!result.success || !result.pdfBuffer) {
        console.error(`[Annotate Route] Annotation failed:`, result.warnings);
        res.status(500).json({
          error: 'Annotation failed',
          details: result.warnings,
          results: result.results,
        });
        return;
      }

      // Log results
      const successCount = result.results.filter(r => r.success).length;
      console.log(
        `[Annotate Route] Successfully applied ${successCount}/${result.results.length} annotations`
      );

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
      console.error('[Annotate Route] Unexpected error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    }
  }
);

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
 * - Body: ExtractedText object with extracted text and metadata
 * 
 * Status Codes:
 * - 200: Success
 * - 400: Validation error (missing file, invalid PDF, etc.)
 * - 413: File too large
 * - 500: Server error
 */
router.post(
  '/extract',
  upload.single('pdf'),
  handleMulterError,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          error: 'Validation error',
          message: 'No PDF file uploaded. Please provide a PDF file.',
        });
        return;
      }

      const pdfBuffer = req.file.buffer;
      console.log(`[Extract Route] Extracting text from: ${req.file.originalname}`);

      try {
        const extractedText = await extractTextFromPDF(pdfBuffer);

        res.json({
          success: true,
          data: extractedText,
          formatted: formatForPrompt(extractedText, { maxCharsPerPage: 500 }),
        });
      } catch (error) {
        console.error('[Extract Route] PDF extraction failed:', error);
        res.status(400).json({
          error: 'Invalid PDF',
          message: 'Failed to extract text from PDF. The file may be corrupted or unsupported.',
        });
      }
    } catch (error) {
      console.error('[Extract Route] Unexpected error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    }
  }
);

export default router;
