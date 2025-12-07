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
    try {
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      const pageImages: string[] = [];
      const numPages = Math.min(2, pdf.numPages); // Render first 1-2 pages
      
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) continue;
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({
          canvasContext: context,
          viewport: viewport,
          canvas: canvas
        }).promise;
        
        pageImages.push(canvas.toDataURL());
      }
      
      setPdfPages(pageImages);
    } catch (err) {
      console.error('Error rendering PDF:', err);
      setError('Failed to render PDF preview');
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
        {pdfPages.length > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white px-6 sm:px-8 py-4 sm:py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">Annotated PDF Preview</h2>
                  <p className="text-sm text-gray-600 mt-1">Your PDF has been successfully annotated</p>
                </div>
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 whitespace-nowrap"
                >
                  <svg className="w-4 h-4 mr-2.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
              </div>
              
              <div className="p-6 sm:p-8 space-y-6 max-h-96 sm:max-h-[500px] overflow-y-auto">
                {pdfPages.map((pageImage, index) => (
                  <div key={index} className="bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                    <img
                      src={pageImage}
                      alt={`Annotated Page ${index + 1}`}
                      className="w-full h-auto"
                    />
                    <div className="bg-white px-4 py-3 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-600">Page {index + 1}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;