# Project Structure

This is a monorepo containing both the client (frontend) and server (backend) applications for the PDF Annotation Service.

## Directory Layout

```
pdf-annotation-service/
├── client/                    # React + Vite + Tailwind client
│   ├── src/                   # Client source code
│   ├── public/                # Static assets
│   ├── vite.config.ts         # Vite configuration
│   ├── tailwind.config.js     # Tailwind CSS configuration
│   ├── postcss.config.js      # PostCSS configuration
│   ├── tsconfig.json          # TypeScript configuration
│   └── package.json           # Client dependencies
│
├── server/                    # Node.js + Express server
│   ├── src/                   # Server source code
│   │   ├── index.ts           # Entry point
│   │   ├── routes/            # API route handlers
│   │   ├── utils/             # Utility functions
│   │   ├── types/             # TypeScript type definitions
│   │   └── examples/          # Usage examples
│   ├── tsconfig.json          # TypeScript configuration
│   ├── .eslintrc.json         # ESLint configuration
│   └── package.json           # Server dependencies
│
├── .vscode/                   # VSCode settings
│   ├── settings.json          # Editor settings
│   ├── extensions.json        # Recommended extensions
│   └── launch.json            # Debug configurations
│
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore patterns
├── package.json               # Root workspace configuration
├── README.md                  # Main project documentation
├── CONTRIBUTING.md            # Contributing guidelines
└── LICENSE                    # MIT License

```

## Key Configuration Files

### Root Level
- **package.json**: Workspace configuration with npm scripts for managing both client and server
- **.env.example**: Template for environment variables (PORT, GROQ_API_KEY, CLIENT_URL, etc.)
- **.gitignore**: Comprehensive git ignore patterns for Node.js projects

### Server
- **server/tsconfig.json**: TypeScript compiler configuration for the backend
- **server/.eslintrc.json**: ESLint configuration for code quality
- **server/.env.example**: Server-specific environment variables

### Client
- **client/tsconfig.json**: TypeScript configuration for React
- **client/tsconfig.app.json**: Application-specific TypeScript settings
- **client/tsconfig.node.json**: Build tool TypeScript settings
- **client/vite.config.ts**: Vite configuration (default port: 5173)
- **client/tailwind.config.js**: Tailwind CSS configuration
- **client/postcss.config.js**: PostCSS configuration

### VSCode
- **.vscode/settings.json**: Recommended editor settings
- **.vscode/extensions.json**: Recommended extensions
- **.vscode/launch.json**: Debug launch configurations

## Scripts

### Root Level Scripts

```bash
npm run install:all    # Install dependencies for both server and client
npm run dev            # Start both server and client in development
npm run dev:server     # Start only the server
npm run dev:client     # Start only the client
npm run build          # Build both for production
npm run build:server   # Build server only
npm run build:client   # Build client only
npm run start          # Start production server
npm run test           # Run all tests
npm run lint           # Run linting on all code
npm run setup          # Full setup with database migrations
```

## Development Workflow

1. **Install Dependencies**
   ```bash
   npm run install:all
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   nano .env  # Edit with your actual configuration
   ```

3. **Start Development**
   ```bash
   npm run dev
   ```
   This starts:
   - Server on http://localhost:3001
   - Client on http://localhost:5173

4. **Build for Production**
   ```bash
   npm run build
   ```

5. **Run Production**
   ```bash
   npm start
   ```

## Environment Variables

See `.env.example` for all required environment variables:
- **NODE_ENV**: Development or production mode
- **PORT**: Server port (default: 3001)
- **CLIENT_URL**: Client application URL (default: http://localhost:5173)
- **GROQ_API_KEY**: API key for Groq AI service
- **DATABASE_URL**: PostgreSQL connection string
- And more...

## Technology Stack

### Server
- Node.js (v18+)
- Express.js
- TypeScript
- pdf-lib (PDF manipulation)
- pdf-parse (PDF text extraction)
- cors (CORS middleware)
- multer (File upload handling)
- dotenv (Environment configuration)

### Client
- React 19
- Vite (Build tool)
- TypeScript
- Tailwind CSS
- pdfjs-dist (PDF viewing)
- axios (HTTP client)

## IDE Setup

VSCode is recommended. The project includes:
- Workspace settings in `.vscode/settings.json`
- Recommended extensions in `.vscode/extensions.json`
- Debug configurations in `.vscode/launch.json`

## Contributing

Please refer to [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
