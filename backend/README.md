# PDF Annotation Backend

This is the backend server for the PDF Annotation Service, providing reusable utilities for PDF text extraction and annotation.

## Architecture

The backend is organized into modular, testable components:

```
backend/
├── src/
│   ├── types/
│   │   └── annotations.ts      # TypeScript type definitions
│   ├── utils/
│   │   ├── pdfExtractor.ts     # Text extraction utilities
│   │   ├── pdfAnnotator.ts     # Annotation utilities
│   │   ├── index.ts            # Main export point
│   │   └── README.md           # Utilities documentation
│   ├── routes/
│   │   └── annotate.ts         # API routes
│   ├── examples/
│   │   └── usage-example.ts    # Usage examples
│   └── index.ts                # Server entry point
├── package.json
├── tsconfig.json
└── README.md
```

## Features

### 1. PDF Text Extraction (`pdfExtractor.ts`)

- Extracts text with page indices using pdf-parse (built on pdfjs)
- Returns structured data suitable for AI prompts (Groq)
- Provides metadata extraction
- Includes search functionality across pages

### 2. PDF Annotation (`pdfAnnotator.ts`)

- Applies visual annotations using pdf-lib
- Supports three annotation types:
  - **Highlight**: Semi-transparent colored rectangles
  - **Underline**: Lines beneath text
  - **Comment**: Callout boxes with text
- Features:
  - Fuzzy text matching with configurable tolerance
  - Custom colors for annotations
  - First-match-per-page (configurable)
  - Comprehensive error handling and logging

### 3. Type Safety

All utilities are fully typed with TypeScript interfaces defined in `types/annotations.ts`:

- `AnnotationType`: Enum for annotation types
- `AnnotationInstruction`: Single annotation definition
- `AnnotationRequest`: Complete annotation request
- `AnnotationResponse`: Annotation results
- `ExtractedText`: Text extraction results
- And more...

## Installation

```bash
cd backend
npm install
```

## Environment Setup

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Configure the following variables:

```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
MAX_FILE_SIZE=10485760
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=mixtral-8x7b-32768
```

## Running the Server

### Development Mode

```bash
npm run dev
```

The server will start on `http://localhost:3001` with hot-reloading.

### Production Mode

```bash
# Build
npm run build

# Start
npm start
```

## API Endpoints

### POST /api/annotate

Annotates a PDF with provided instructions or AI-generated annotations.

**Request:**
- Content-Type: `multipart/form-data`
- Fields:
  - `pdf`: PDF file (required)
  - `prompt`: User instructions for AI annotation (optional)
  - `instructions`: JSON array of `AnnotationInstruction[]` (optional)

**Response:**
- Content-Type: `application/pdf`
- Body: Annotated PDF file

**Example:**

```bash
curl -X POST http://localhost:3001/api/annotate \
  -F "pdf=@document.pdf" \
  -F "prompt=Highlight all key findings" \
  -o annotated.pdf
```

### POST /api/extract

Extracts text from a PDF.

**Request:**
- Content-Type: `multipart/form-data`
- Fields:
  - `pdf`: PDF file (required)

**Response:**
- Content-Type: `application/json`
- Body: `ExtractedText` object with page-by-page text

**Example:**

```bash
curl -X POST http://localhost:3001/api/extract \
  -F "pdf=@document.pdf"
```

## Using the Utilities

### Quick Start

```typescript
import {
  extractTextFromPDF,
  annotatePDF,
  AnnotationType
} from './utils';

// Extract text
const pdfBuffer = fs.readFileSync('document.pdf');
const extracted = await extractTextFromPDF(pdfBuffer);

// Annotate
const response = await annotatePDF(pdfBuffer, {
  instructions: [
    {
      type: AnnotationType.HIGHLIGHT,
      text: 'Important text',
      pageNumber: 1
    }
  ]
});

// Save result
if (response.success && response.pdfBuffer) {
  fs.writeFileSync('annotated.pdf', response.pdfBuffer);
}
```

### Detailed Examples

See `src/examples/usage-example.ts` for comprehensive usage examples including:

1. Basic text extraction
2. Formatting text for AI prompts
3. Simple annotations
4. Multiple annotations with custom colors
5. Search and annotate
6. AI-powered annotation (Groq integration pattern)
7. Error handling
8. Fuzzy text matching

## Type Definitions

All types are exported from `src/types/annotations.ts`:

```typescript
import {
  AnnotationType,
  AnnotationInstruction,
  AnnotationRequest,
  AnnotationResponse,
  ExtractedText,
  PageText
} from './types/annotations';
```

### Key Types

**AnnotationInstruction:**
```typescript
{
  type: AnnotationType;
  text: string;              // Text to find and annotate
  pageNumber?: number;       // Optional: limit to specific page
  color?: AnnotationColor;   // Optional: custom color
  comment?: string;          // Required for COMMENT type
  caseSensitive?: boolean;   // Default: false
}
```

**AnnotationRequest:**
```typescript
{
  instructions: AnnotationInstruction[];
  options?: {
    matchTolerance?: number;    // 0-1, default: 0.1
    firstMatchOnly?: boolean;   // Default: true
    skipNotFound?: boolean;     // Default: true
    logNotFound?: boolean;      // Default: true
  }
}
```

## Testing

The utilities are designed to be unit-testable. Example test files are provided:

- `src/utils/pdfExtractor.test.ts`
- `src/utils/pdfAnnotator.test.ts`

Run tests (when configured):

```bash
npm test
```

## Key Assumptions & Behavior

### Text Matching

1. **First Match Per Page**: By default, only the first occurrence of text on each page is annotated
2. **Case Insensitive**: Matching is case-insensitive by default
3. **Fuzzy Matching**: Supports Levenshtein distance-based fuzzy matching (configurable tolerance)

### Text Not Found

When text cannot be located:
- Annotation is skipped by default
- Warning is logged (configurable)
- Error details included in response
- Processing continues with other annotations

### Position Estimation

Since pdf-lib doesn't provide text extraction with coordinates:
- Text position is estimated based on character index
- Works well for simple layouts
- May be less accurate for complex multi-column layouts

For production use with complex PDFs, consider integrating pdfjs-dist directly for precise text coordinates.

## Performance

- Text extraction: ~100-500ms for typical documents
- Annotation: ~50-200ms per annotation
- Memory: PDFs loaded entirely into memory
- Concurrent requests: Fully async, supports concurrency

## Limitations

1. **Complex Layouts**: Multi-column layouts may have text extraction order issues
2. **Scanned PDFs**: Requires OCR text layer (no built-in OCR)
3. **Position Accuracy**: Text position estimation may be imprecise
4. **Protected PDFs**: Password-protected PDFs not supported
5. **Memory**: Large files (>50MB) may cause memory issues

## Groq Integration

The utilities are designed to work seamlessly with Groq for AI-powered annotations:

1. Extract text using `extractTextFromPDF()`
2. Format for prompt using `formatForPrompt()`
3. Send to Groq API with instructions
4. Parse Groq response into `AnnotationInstruction[]`
5. Apply using `annotatePDF()`

Example pattern:

```typescript
// 1. Extract text
const extracted = await extractTextFromPDF(pdfBuffer);
const context = formatForPrompt(extracted, { maxCharsPerPage: 1000 });

// 2. Call Groq
const groqResponse = await groqClient.chat.completions.create({
  messages: [{
    role: 'user',
    content: `Analyze this document and suggest annotations:\n\n${context}`
  }],
  model: 'mixtral-8x7b-32768'
});

// 3. Parse response to annotations
const instructions = parseGroqResponse(groqResponse);

// 4. Apply annotations
const result = await annotatePDF(pdfBuffer, { instructions });
```

## Contributing

When adding features:

1. Maintain type safety - all functions should have proper TypeScript types
2. Add comprehensive error handling
3. Include logging for debugging
4. Write unit tests
5. Update this README

## License

MIT
