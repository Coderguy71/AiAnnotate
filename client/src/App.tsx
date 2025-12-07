import React, { useState, useCallback, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import './App.css';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface UploadedFile {
  file: File;
  preview: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

function App() {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [annotatedPdfBlob, setAnnotatedPdfBlob] = useState<Blob | null>(null);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setUploadedFile({
      file,
      preview: `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`
    });
    setError(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const renderPdfPages = async (pdfBlob: Blob) => {
    // Clear previous pages and set loading state
    setPdfPages([]);
    setIsRenderingPreview(true);
    
    try {
      // Validate PDF blob
      if (!pdfBlob || pdfBlob.size === 0) {
        throw new Error('Invalid PDF: Empty file');
      }
      
      if (pdfBlob.size > 50 * 1024 * 1024) { // 50MB limit
        throw new Error('PDF too large for preview (max 50MB)');
      }
      
      console.log('[PDF Preview] Starting render, blob size:', (pdfBlob.size / 1024 / 1024).toFixed(2), 'MB');
      
      // Convert blob to array buffer
      const arrayBuffer = await pdfBlob.arrayBuffer();
      
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Invalid PDF: Corrupted or empty file');
      }
      
      // Load PDF document with error handling
      let pdf;
      try {
        pdf = await pdfjsLib.getDocument({ 
          data: arrayBuffer,
          disableAutoFetch: true,
          disableStream: true
        }).promise;
      } catch (pdfError) {
        console.error('[PDF Preview] PDF.js loading error:', pdfError);
        
        // Provide specific error messages based on error type
        if (pdfError.name === 'PasswordException') {
          throw new Error('Password-protected PDFs are not supported');
        } else if (pdfError.name === 'InvalidPDFException') {
          throw new Error('Invalid or corrupted PDF file');
        } else if (pdfError.name === 'MissingPDFException') {
          throw new Error('PDF file not found or corrupted');
        } else if (pdfError.message?.includes('Unexpected end of PDF')) {
          throw new Error('Incomplete or corrupted PDF file');
        } else {
          throw new Error(`Failed to load PDF: ${pdfError.message || 'Unknown error'}`);
        }
      }
      
      if (!pdf || pdf.numPages === 0) {
        throw new Error('PDF has no pages');
      }
      
      console.log('[PDF Preview] PDF loaded successfully, pages:', pdf.numPages);
      
      const pageImages: string[] = [];
      const numPages = Math.min(2, pdf.numPages); // Render first 1-2 pages
      
      // Render each page with error handling
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          console.log(`[PDF Preview] Rendering page ${pageNum}/${numPages}`);
          
          const page = await pdf.getPage(pageNum);
          
          // Calculate responsive scale based on viewport
          const viewport = page.getViewport({ scale: 1.5 });
          
          // Create canvas with error handling
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          
          if (!context) {
            console.error(`[PDF Preview] Failed to get canvas context for page ${pageNum}`);
            continue; // Skip this page but continue with others
          }
          
          // Set canvas dimensions
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          
          // Render page with error handling
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;
          
          // Convert to data URL with error handling
          try {
            const dataUrl = canvas.toDataURL('image/png', 0.8);
            pageImages.push(dataUrl);
            console.log(`[PDF Preview] Successfully rendered page ${pageNum}`);
          } catch (canvasError) {
            console.error(`[PDF Preview] Failed to convert page ${pageNum} to image:`, canvasError);
            // Continue with other pages
          }
          
        } catch (pageError) {
          console.error(`[PDF Preview] Error rendering page ${pageNum}:`, pageError);
          // Continue with other pages
        }
      }
      
      if (pageImages.length === 0) {
        throw new Error('Failed to render any pages from the PDF');
      }
      
      console.log(`[PDF Preview] Successfully rendered ${pageImages.length} pages`);
      setPdfPages(pageImages);
      
    } catch (err) {
      console.error('[PDF Preview] Error rendering PDF:', err);
      
      // Set specific error message
      const errorMessage = err instanceof Error ? err.message : 'Failed to render PDF preview';
      setError(errorMessage);
      
      // Clear pages on error
      setPdfPages([]);
    } finally {
      // Always clear loading state
      setIsRenderingPreview(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!uploadedFile) {
      setError('Please select a PDF file');
      return;
    }

    setIsLoading(true);
    setError(null);
    setPdfPages([]);
    setIsRenderingPreview(false);

    try {
      const formData = new FormData();
      formData.append('pdf', uploadedFile.file);
      formData.append('prompt', prompt);

      const response = await fetch(`${API_BASE_URL}/api/annotate`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      setAnnotatedPdfBlob(blob);
      await renderPdfPages(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to annotate PDF');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!annotatedPdfBlob) return;

    const url = URL.createObjectURL(annotatedPdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'annotated.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-2">
              PDF Annotator
            </h1>
            <p className="text-base sm:text-lg text-gray-600 font-light">
              Upload your PDF and harness AI to add intelligent annotations
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Error Message */}
        {error && (
          <div className="mb-6 animate-in fade-in duration-300">
            <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
              <div className="flex">
                <div className="flex-shrink-0 pt-0.5">
                  <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload and Prompt Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 mb-8">
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            {/* File Upload Area */}
            <div>
              <label htmlFor="file-upload" className="block text-sm font-semibold text-gray-900 mb-3">
                Upload PDF
              </label>
              <div
                className={`relative border-2 border-dashed rounded-lg p-8 sm:p-10 text-center transition-all duration-200 cursor-pointer ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : uploadedFile
                    ? 'border-emerald-400 bg-emerald-50 shadow-sm'
                    : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileInputChange}
                  className="hidden"
                  disabled={isLoading}
                />
                
                {uploadedFile ? (
                  <div className="space-y-3">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-full">
                      <svg className="w-6 h-6 text-emerald-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-emerald-900">
                        {uploadedFile.file.name}
                      </p>
                      <p className="text-sm text-emerald-700 mt-1">
                        {uploadedFile.preview.split('(')[1]}
                      </p>
                    </div>
                    <p className="text-xs text-emerald-600 pt-2">
                      Click or drag to replace file
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full">
                      <svg className="w-6 h-6 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-gray-900">
                        Drag and drop your PDF
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        or click to browse
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 pt-2">
                      PDF files up to 10MB supported
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Prompt Input */}
            <div>
              <label htmlFor="prompt" className="block text-sm font-semibold text-gray-900 mb-3">
                Annotation Instructions
                <span className="font-normal text-gray-500 ml-2">(optional)</span>
              </label>
              <textarea
                id="prompt"
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                placeholder="Tell the AI how you'd like your PDF annotated. Example: 'Highlight key financial figures and add comments explaining their significance.'"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={!uploadedFile || isLoading}
                className="w-full py-3 px-6 rounded-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Annotating your PDF...</span>
                  </div>
                ) : (
                  'Annotate PDF'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* PDF Preview Section */}
        {(pdfPages.length > 0 || isRenderingPreview) && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white px-6 sm:px-8 py-4 sm:py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                    {isRenderingPreview ? 'Generating Preview...' : 'Annotated PDF Preview'}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {isRenderingPreview ? 'Please wait while we render your PDF' : 'Your PDF has been successfully annotated'}
                  </p>
                </div>
                {!isRenderingPreview && pdfPages.length > 0 && (
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 whitespace-nowrap"
                  >
                    <svg className="w-4 h-4 mr-2.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </button>
                )}
              </div>
              
              <div className="p-6 sm:p-8 space-y-6 max-h-96 sm:max-h-[500px] overflow-y-auto">
                {isRenderingPreview ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="text-gray-600 text-sm font-medium">Rendering PDF preview...</p>
                    <p className="text-gray-500 text-xs">This may take a few moments</p>
                  </div>
                ) : (
                  pdfPages.map((pageImage, index) => (
                    <div key={index} className="bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                      <div className="relative w-full">
                        <img
                          src={pageImage}
                          alt={`Annotated Page ${index + 1}`}
                          className="w-full h-auto max-w-full"
                          style={{
                            maxHeight: '600px',
                            objectFit: 'contain'
                          }}
                        />
                      </div>
                      <div className="bg-white px-4 py-3 border-t border-gray-200">
                        <p className="text-xs font-medium text-gray-600">Page {index + 1}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Fallback UI when preview fails but we have the blob */}
        {annotatedPdfBlob && pdfPages.length === 0 && !isRenderingPreview && !error && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-amber-50 border border-amber-200 rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 sm:p-8">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-amber-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-amber-900 mb-2">Preview Unavailable</h3>
                    <p className="text-sm text-amber-800 mb-4">
                      We couldn't generate a preview for your annotated PDF, but your file is ready for download.
                    </p>
                    <button
                      onClick={handleDownload}
                      className="inline-flex items-center px-4 py-2 rounded-lg font-semibold text-amber-900 bg-amber-200 hover:bg-amber-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                    >
                      <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download Annotated PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;