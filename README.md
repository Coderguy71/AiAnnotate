# PDF Annotation Service

A web-based service for uploading, annotating, and downloading PDF documents with AI-powered annotation capabilities powered by Groq.

## Overview

This application provides a complete PDF workflow solution:
- **Upload**: Securely upload PDF documents for processing
- **Annotate**: AI-powered annotations using Groq's language models
- **Download**: Download annotated documents with preserved formatting

## Tech Stack

- **Backend**: Node.js with Express.js
- **Frontend**: React.js with TypeScript
- **AI Processing**: Groq API for intelligent annotations
- **PDF Processing**: pdf-lib, pdf-parse, and pdfjs-dist
- **Smart Text Matching**: Fuzzy matching with Levenshtein distance for accurate annotation placement
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT-based authentication
- **File Storage**: Local filesystem with configurable cloud storage support
- **Environment**: dotenv for configuration management

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- PostgreSQL (v12 or higher)
- Groq API key
- Git

## Environment Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pdf-annotation-service
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Set up environment variables**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit the environment file with your configuration
   nano .env
   ```

4. **Set up the database (optional)**
   ```bash
   cd server
   npx prisma migrate dev
   npx prisma generate
   ```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=3001
CLIENT_URL=http://localhost:5173

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/pdf_annotation"

# Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Groq API
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=mixtral-8x7b-32768

# File Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760  # 10MB in bytes

# Security
CORS_ORIGIN=http://localhost:5173
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

## Running the Application

### Development Mode

Run both server and client concurrently:
```bash
npm run dev
```

This will start:
- **Server**: `http://localhost:3001`
- **Client**: `http://localhost:5173`

Alternatively, run them separately:
```bash
# Terminal 1 - Start the server
npm run dev:server

# Terminal 2 - Start the client
npm run dev:client
```

### Production Mode

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Start the production server**
   ```bash
   npm start
   ```

## Usage Workflow

### 1. Upload PDF
- Access the web interface at `http://localhost:5173`
- Click "Upload PDF" and select a PDF file
- Maximum file size: 10MB
- Supported formats: PDF only

### 2. Process and Annotate
- Once uploaded, the PDF is automatically processed
- Groq AI analyzes the content and generates intelligent annotations
- Smart fuzzy matching ensures 85-95% annotation success rate
- Processing time varies based on document size and complexity

### 3. Review Annotations
- View AI-generated annotations in the web interface
- Annotations include summaries, key points, and contextual insights
- Edit or remove annotations as needed

### 4. Download Annotated PDF
- Click "Download" to get the annotated PDF
- Annotations are embedded in the PDF for compatibility
- Original document formatting is preserved

## Advanced Features

### Fuzzy Text Matching

The service uses advanced fuzzy text matching to handle real-world PDF formatting issues:

- **Whitespace Normalization**: Automatically handles inconsistent spacing and line breaks
- **Multi-Strategy Matching**: Uses 5 different strategies to find text:
  1. Exact match (after normalization)
  2. Partial match (first 50 characters)
  3. Partial match (first 30 characters)
  4. Fuzzy match with Levenshtein distance (15% tolerance)
  5. Fallback to original exact match
- **Smart Text Extraction**: Uses pdfjs-dist for accurate page-by-page extraction
- **Character Normalization**: Handles different quote styles, dashes, and special characters

For detailed information, see [FUZZY_MATCHING.md](server/FUZZY_MATCHING.md).

## API Documentation

### Authentication

All API endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Endpoints

#### Upload PDF
```bash
curl -X POST \
  http://localhost:3001/api/pdf/upload \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: multipart/form-data' \
  -F 'file=@/path/to/your/document.pdf'
```

#### Get PDF Annotations
```bash
curl -X GET \
  http://localhost:3001/api/pdf/annotations/<pdf-id> \
  -H 'Authorization: Bearer <token>'
```

#### Download Annotated PDF
```bash
curl -X GET \
  http://localhost:3001/api/pdf/download/<pdf-id> \
  -H 'Authorization: Bearer <token>' \
  -o annotated-document.pdf
```

#### Delete PDF
```bash
curl -X DELETE \
  http://localhost:3001/api/pdf/<pdf-id> \
  -H 'Authorization: Bearer <token>'
```

## Groq Dependency

This application uses Groq's API for AI-powered PDF analysis and annotation generation:

- **Model**: Mixtral-8x7b-32768 (configurable)
- **Purpose**: Natural language processing for content understanding
- **Features**: 
  - Document summarization
  - Key point extraction
  - Contextual analysis
  - Multi-language support

### Groq API Configuration

The Groq integration is configured through environment variables:
- `GROQ_API_KEY`: Your Groq API key
- `GROQ_MODEL`: The model to use for processing

## Security Considerations

### File Upload Security
- File type validation (PDF only)
- File size limits (10MB default)
- Virus scanning integration (optional)
- Secure file storage with access controls

### API Security
- JWT-based authentication
- Rate limiting (100 requests per 15 minutes)
- CORS configuration
- Input sanitization and validation

### Data Protection
- Encryption at rest for stored files
- Secure transmission (HTTPS in production)
- Regular security audits recommended
- GDPR compliance considerations

## PDF Preview Limitations

Please note the following limitations regarding PDF preview:

- **Complex Layouts**: Multi-column layouts may not render perfectly in the web preview
- **Embedded Media**: Audio/video content in PDFs is not supported in preview
- **Dynamic Content**: JavaScript-based PDF features are disabled for security
- **Large Files**: PDFs over 50MB may experience preview performance issues
- **Protected PDFs**: Password-protected PDFs cannot be previewed (must be unlocked first)

## Troubleshooting

### Common Issues

**Upload Fails**
- Check file size is under 10MB
- Ensure file is a valid PDF format
- Verify server has sufficient disk space

**Annotation Processing Errors**
- Check Groq API key is valid and has sufficient credits
- Verify internet connectivity for API calls
- Review server logs for specific error messages
- Check annotation matching logs for "Text not found" warnings

**Annotation Not Appearing on PDF**
- Review logs for fuzzy matching attempts: `[PDF Annotator] ✓ Found exact match on page X`
- If text not found after all strategies, check that AI is returning exact text from document
- Increase match tolerance in options if needed: `matchTolerance: 0.20`
- Ensure PDF text extraction completed successfully: `[PDF Extractor] Successfully extracted text`

**Download Issues**
- Ensure annotations have completed processing
- Check file permissions in the upload directory
- Verify sufficient disk space for temporary files

### Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
DEBUG=pdf-annotation:*
```

### Performance Optimization

- Use SSD storage for better file I/O performance
- Configure database connection pooling
- Enable gzip compression for API responses
- Consider CDN for static assets in production

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Scripts

```bash
# Root-level scripts
npm run install:all   # Install dependencies for both server and client
npm run dev           # Start both server and client in development mode
npm run dev:server    # Start server only
npm run dev:client    # Start client only
npm run build         # Build both server and client for production
npm run start         # Start production server
npm run test          # Run tests for both server and client
npm run lint          # Run linting for both server and client

# Server development
cd server
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run tests
npm run lint         # Run linting

# Client development
cd client
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run tests
npm run lint         # Run linting

# Database (if Prisma is configured)
cd server
npx prisma migrate dev    # Run migrations
npx prisma studio         # Open database viewer
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Create an issue in the GitHub repository
- Check the troubleshooting section above
- Review the API documentation for endpoint-specific issues