# PDF Annotation Utilities

This directory contains reusable server-side modules for PDF text extraction and annotation.

## Overview

The utilities are designed to be modular, type-safe, and easy to test. They provide a clean separation of concerns between text extraction and annotation application.

## Modules

### 1. pdfExtractor.ts

Extracts text content from PDF files with page-level granularity using pdf-parse (built on pdfjs).

#### Key Functions

##### `extractTextFromPDF(pdfBuffer: Buffer): Promise<ExtractedText>`

Extracts all text from a PDF with page numbers.

**Returns:**
```typescript
{
  pages: PageText[],      // Array of page text objects
  totalPages: number,     // Total number of pages
  metadata?: PDFMetadata  // Optional PDF metadata
}
```

**Example:**
```typescript
import { extractTextFromPDF } from './utils/pdfExtractor';

const pdfBuffer = fs.readFileSync('document.pdf');
const extracted = await extractTextFromPDF(pdfBuffer);

console.log(`Document has ${extracted.totalPages} pages`);
extracted.pages.forEach(page => {
  console.log(`Page ${page.pageNumber}:`);
  console.log(page.text);
});
```

##### `extractTextFromPage(pdfBuffer: Buffer, pageNumber: number): Promise<PageText>`

Extracts text from a specific page.

##### `formatForPrompt(extracted: ExtractedText, options?): string`

Formats extracted text for use in AI prompts (e.g., Groq).

**Options:**
- `maxCharsPerPage`: Truncate pages to this length (default: Infinity)
- `includeMetadata`: Include document metadata (default: true)
- `pageDelimiter`: String to separate pages (default: '\n\n---\n\n')

**Example:**
```typescript
const extracted = await extractTextFromPDF(pdfBuffer);
const promptContext = formatForPrompt(extracted, {
  maxCharsPerPage: 500,
  includeMetadata: true
});

// Use with Groq or other AI services
const groqPrompt = `
Analyze this document and suggest annotations:

${promptContext}

Provide highlights for key points and comments for important sections.
`;
```

##### `findTextInPages(extracted: ExtractedText, searchText: string, caseSensitive?: boolean): number[]`

Searches for text across all pages and returns matching page numbers.

### 2. pdfAnnotator.ts

Applies visual annotations to PDF files using pdf-lib.

#### Key Functions

##### `annotatePDF(pdfBuffer: Buffer, request: AnnotationRequest): Promise<AnnotationResponse>`

Applies multiple annotations to a PDF document.

**Request Structure:**
```typescript
{
  instructions: AnnotationInstruction[],
  options?: AnnotationOptions
}
```

**Response Structure:**
```typescript
{
  success: boolean,
  results: AnnotationResult[],
  warnings?: string[],
  pdfBuffer?: Buffer
}
```

**Example:**
```typescript
import { annotatePDF, AnnotationType } from './utils/pdfAnnotator';

const response = await annotatePDF(pdfBuffer, {
  instructions: [
    {
      type: AnnotationType.HIGHLIGHT,
      text: 'Important information',
      pageNumber: 1,
      color: { r: 1, g: 1, b: 0, a: 0.3 }
    },
    {
      type: AnnotationType.UNDERLINE,
      text: 'Key finding',
      pageNumber: 2
    },
    {
      type: AnnotationType.COMMENT,
      text: 'Conclusion',
      comment: 'This needs further review',
      pageNumber: 3
    }
  ],
  options: {
    firstMatchOnly: true,
    skipNotFound: true,
    logNotFound: true
  }
});

if (response.success && response.pdfBuffer) {
  fs.writeFileSync('annotated.pdf', response.pdfBuffer);
}
```

## Type Definitions

All types are defined in `../types/annotations.ts`:

### Annotation Types

```typescript
enum AnnotationType {
  HIGHLIGHT = 'highlight',
  UNDERLINE = 'underline',
  COMMENT = 'comment'
}
```

### AnnotationInstruction

```typescript
interface AnnotationInstruction {
  type: AnnotationType;
  text: string;              // Text to locate and annotate
  pageNumber?: number;       // Optional: limit to specific page
  color?: AnnotationColor;   // Optional: custom color
  comment?: string;          // Required for COMMENT type
  caseSensitive?: boolean;   // Default: false
}
```

### AnnotationOptions

```typescript
interface AnnotationOptions {
  matchTolerance?: number;    // 0-1, default: 0.1 (fuzzy matching)
  firstMatchOnly?: boolean;   // Default: true
  skipNotFound?: boolean;     // Default: true
  logNotFound?: boolean;      // Default: true
}
```

## Assumptions and Behavior

### Text Matching

1. **First Match Per Page**: By default, only the first occurrence of text on each page is annotated. This can be changed via `options.firstMatchOnly = false`.

2. **Case Insensitive**: Text matching is case-insensitive by default. Set `caseSensitive: true` on individual instructions to override.

3. **Fuzzy Matching**: Uses Levenshtein distance to handle minor text variations (OCR errors, formatting differences). Controlled by `matchTolerance` option (default: 0.1 = 10% difference allowed).

### Text Not Found Behavior

When text cannot be located:

1. **Default**: Annotation is skipped, warning is logged
2. **Configurable**: Set `skipNotFound: false` to include in warnings array
3. **Logging**: Controlled by `logNotFound` option (default: true)

### Position Estimation

Since pdf-lib doesn't provide text extraction with precise coordinates, positions are estimated:

1. Text is located using the extracted text from pdf-parse
2. Position is estimated based on character index in the text
3. Annotations are drawn at estimated positions

**Note**: For production use with complex layouts, consider integrating a more sophisticated PDF parsing library that provides text coordinates (e.g., pdfjs-dist directly with text layer data).

### Coordinate System

- PDF coordinate system: origin (0,0) is bottom-left
- Y-axis increases upward
- All measurements in points (1/72 inch)

## Testing

The utilities are designed to be unit-testable:

```typescript
import { extractTextFromPDF } from './utils/pdfExtractor';
import { annotatePDF, AnnotationType } from './utils/pdfAnnotator';

describe('PDF Utilities', () => {
  let testPdfBuffer: Buffer;

  beforeAll(() => {
    testPdfBuffer = fs.readFileSync('test.pdf');
  });

  test('extractTextFromPDF returns structured data', async () => {
    const result = await extractTextFromPDF(testPdfBuffer);
    
    expect(result.pages).toBeDefined();
    expect(result.totalPages).toBeGreaterThan(0);
    expect(result.pages[0].pageNumber).toBe(1);
  });

  test('annotatePDF applies highlights', async () => {
    const response = await annotatePDF(testPdfBuffer, {
      instructions: [{
        type: AnnotationType.HIGHLIGHT,
        text: 'test',
        pageNumber: 1
      }]
    });

    expect(response.success).toBe(true);
    expect(response.pdfBuffer).toBeDefined();
  });
});
```

## Integration Example

Complete example using both utilities:

```typescript
import express from 'express';
import multer from 'multer';
import { extractTextFromPDF, formatForPrompt } from './utils/pdfExtractor';
import { annotatePDF, AnnotationType } from './utils/pdfAnnotator';

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/annotate', upload.single('pdf'), async (req, res) => {
  try {
    const pdfBuffer = req.file.buffer;
    
    // 1. Extract text
    const extracted = await extractTextFromPDF(pdfBuffer);
    
    // 2. Format for AI prompt
    const promptContext = formatForPrompt(extracted);
    
    // 3. Get AI annotations (e.g., from Groq)
    // const aiResponse = await getGroqAnnotations(promptContext);
    
    // 4. Apply annotations
    const response = await annotatePDF(pdfBuffer, {
      instructions: [
        {
          type: AnnotationType.HIGHLIGHT,
          text: 'important text',
          pageNumber: 1
        }
      ]
    });
    
    // 5. Return annotated PDF
    res.contentType('application/pdf');
    res.send(response.pdfBuffer);
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

## Performance Considerations

1. **Memory**: PDFs are loaded entirely into memory. For large files (>50MB), consider streaming approaches.

2. **Processing Time**: 
   - Text extraction: ~100-500ms for typical documents
   - Annotation: ~50-200ms per annotation
   - Total: Generally <2 seconds for documents <20 pages

3. **Concurrency**: Both utilities are async and can handle concurrent requests.

## Limitations

1. **Complex Layouts**: Multi-column layouts may have text extraction order issues
2. **Scanned PDFs**: OCR text layer must exist (utilities don't perform OCR)
3. **Position Accuracy**: Text position estimation may be imprecise for complex layouts
4. **Protected PDFs**: Password-protected PDFs are not supported

## Future Enhancements

1. Integration with pdfjs-dist for precise text coordinates
2. OCR support for scanned documents
3. Support for more annotation types (arrows, shapes, etc.)
4. Batch annotation processing
5. Position caching for better performance
6. Support for existing PDF annotations (read/modify)

## License

MIT
