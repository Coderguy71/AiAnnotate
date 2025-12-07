/**
 * Usage Examples for PDF Annotation Utilities
 * 
 * This file demonstrates various ways to use the PDF extraction and annotation utilities.
 */

import * as fs from 'fs';
import { extractTextFromPDF, formatForPrompt, findTextInPages } from '../utils/pdfExtractor';
import { annotatePDF } from '../utils/pdfAnnotator';
import { AnnotationType } from '../types/annotations';

/**
 * Example 1: Basic Text Extraction
 */
async function example1_basicExtraction() {
  console.log('=== Example 1: Basic Text Extraction ===\n');
  
  const pdfBuffer = fs.readFileSync('sample.pdf');
  const extracted = await extractTextFromPDF(pdfBuffer);
  
  console.log(`Document has ${extracted.totalPages} pages`);
  console.log(`Title: ${extracted.metadata?.title || 'N/A'}`);
  console.log(`Author: ${extracted.metadata?.author || 'N/A'}`);
  
  // Print first 100 characters from each page
  extracted.pages.forEach(page => {
    const preview = page.text.substring(0, 100).replace(/\n/g, ' ');
    console.log(`\nPage ${page.pageNumber}: ${preview}...`);
  });
}

/**
 * Example 2: Format Text for AI Prompt
 */
async function example2_formatForAI() {
  console.log('\n=== Example 2: Format Text for AI Prompt ===\n');
  
  const pdfBuffer = fs.readFileSync('sample.pdf');
  const extracted = await extractTextFromPDF(pdfBuffer);
  
  // Format with metadata and page limits
  const promptContext = formatForPrompt(extracted, {
    maxCharsPerPage: 500,
    includeMetadata: true,
    pageDelimiter: '\n\n---PAGE BREAK---\n\n'
  });
  
  console.log('Formatted text for AI prompt:');
  console.log(promptContext);
  
  // This can now be used with Groq or other AI services
  const aiPrompt = `
Analyze the following document and suggest key points to highlight:

${promptContext}

Please identify:
1. Main topics or headings
2. Important findings or conclusions
3. Key statistics or data points
4. Action items or recommendations
`;
  
  console.log('\nReady to send to AI service');
}

/**
 * Example 3: Simple Annotation
 */
async function example3_simpleAnnotation() {
  console.log('\n=== Example 3: Simple Annotation ===\n');
  
  const pdfBuffer = fs.readFileSync('sample.pdf');
  
  const response = await annotatePDF(pdfBuffer, {
    instructions: [
      {
        type: AnnotationType.HIGHLIGHT,
        text: 'Important information',
        pageNumber: 1
      }
    ]
  });
  
  if (response.success && response.pdfBuffer) {
    fs.writeFileSync('annotated-simple.pdf', response.pdfBuffer);
    console.log('✓ Annotated PDF saved as annotated-simple.pdf');
  }
  
  // Print results
  response.results.forEach(result => {
    console.log(`${result.success ? '✓' : '✗'} ${result.instruction.type}: "${result.instruction.text}"`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  });
}

/**
 * Example 4: Multiple Annotations
 */
async function example4_multipleAnnotations() {
  console.log('\n=== Example 4: Multiple Annotations ===\n');
  
  const pdfBuffer = fs.readFileSync('sample.pdf');
  
  const response = await annotatePDF(pdfBuffer, {
    instructions: [
      {
        type: AnnotationType.HIGHLIGHT,
        text: 'executive summary',
        color: { r: 1, g: 1, b: 0, a: 0.3 } // Yellow
      },
      {
        type: AnnotationType.UNDERLINE,
        text: 'key findings',
        color: { r: 1, g: 0, b: 0, a: 1 } // Red
      },
      {
        type: AnnotationType.COMMENT,
        text: 'conclusion',
        comment: 'Review this section carefully',
        color: { r: 0, g: 0.5, b: 1, a: 0.8 } // Blue
      }
    ],
    options: {
      firstMatchOnly: true,
      skipNotFound: true,
      logNotFound: true
    }
  });
  
  if (response.success && response.pdfBuffer) {
    fs.writeFileSync('annotated-multiple.pdf', response.pdfBuffer);
    console.log('✓ Annotated PDF saved as annotated-multiple.pdf');
  }
  
  console.log(`\nSuccessful: ${response.results.filter(r => r.success).length}/${response.results.length}`);
}

/**
 * Example 5: Search and Annotate
 */
async function example5_searchAndAnnotate() {
  console.log('\n=== Example 5: Search and Annotate ===\n');
  
  const pdfBuffer = fs.readFileSync('sample.pdf');
  
  // First, extract and search for text
  const extracted = await extractTextFromPDF(pdfBuffer);
  const searchTerm = 'important';
  const foundPages = findTextInPages(extracted, searchTerm, false);
  
  console.log(`Found "${searchTerm}" on pages: ${foundPages.join(', ')}`);
  
  // Annotate all occurrences
  const instructions = foundPages.map(pageNumber => ({
    type: AnnotationType.HIGHLIGHT,
    text: searchTerm,
    pageNumber
  }));
  
  const response = await annotatePDF(pdfBuffer, { instructions });
  
  if (response.success && response.pdfBuffer) {
    fs.writeFileSync('annotated-search.pdf', response.pdfBuffer);
    console.log('✓ Annotated all occurrences');
  }
}

/**
 * Example 6: AI-Powered Annotation (Placeholder for Groq Integration)
 */
async function example6_aiPoweredAnnotation() {
  console.log('\n=== Example 6: AI-Powered Annotation (Groq) ===\n');
  
  const pdfBuffer = fs.readFileSync('sample.pdf');
  
  // Step 1: Extract text
  const extracted = await extractTextFromPDF(pdfBuffer);
  const promptContext = formatForPrompt(extracted, { maxCharsPerPage: 1000 });
  
  // Step 2: Send to Groq (placeholder - implement with actual Groq SDK)
  console.log('Sending to Groq for analysis...');
  
  // const groqResponse = await groqClient.chat.completions.create({
  //   messages: [{
  //     role: 'user',
  //     content: `Analyze this document and return JSON with annotations:
  //     
  //     ${promptContext}
  //     
  //     Return format:
  //     {
  //       "annotations": [
  //         {"type": "highlight", "text": "exact text snippet", "pageNumber": 1},
  //         {"type": "comment", "text": "exact text snippet", "comment": "your comment", "pageNumber": 2}
  //       ]
  //     }`
  //   }],
  //   model: 'mixtral-8x7b-32768',
  //   temperature: 0.3
  // });
  
  // Placeholder: Simulate Groq response
  const aiAnnotations = {
    annotations: [
      { type: AnnotationType.HIGHLIGHT, text: 'key insight', pageNumber: 1 },
      { type: AnnotationType.COMMENT, text: 'conclusion', comment: 'Critical finding', pageNumber: 2 }
    ]
  };
  
  console.log('✓ Received AI annotations');
  
  // Step 3: Apply annotations
  const response = await annotatePDF(pdfBuffer, {
    instructions: aiAnnotations.annotations
  });
  
  if (response.success && response.pdfBuffer) {
    fs.writeFileSync('annotated-ai.pdf', response.pdfBuffer);
    console.log('✓ AI-annotated PDF saved');
  }
}

/**
 * Example 7: Error Handling
 */
async function example7_errorHandling() {
  console.log('\n=== Example 7: Error Handling ===\n');
  
  const pdfBuffer = fs.readFileSync('sample.pdf');
  
  const response = await annotatePDF(pdfBuffer, {
    instructions: [
      {
        type: AnnotationType.HIGHLIGHT,
        text: 'this text exists',
        pageNumber: 1
      },
      {
        type: AnnotationType.HIGHLIGHT,
        text: 'this text does NOT exist',
        pageNumber: 1
      },
      {
        type: AnnotationType.COMMENT,
        text: 'another valid text',
        comment: 'This is fine',
        pageNumber: 1
      }
    ],
    options: {
      skipNotFound: true,
      logNotFound: true
    }
  });
  
  console.log('\nAnnotation Results:');
  response.results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.instruction.type.toUpperCase()}`);
    console.log(`   Text: "${result.instruction.text}"`);
    console.log(`   Status: ${result.success ? '✓ Success' : '✗ Failed'}`);
    
    if (result.success) {
      console.log(`   Page: ${result.position?.pageNumber}`);
      console.log(`   Matched: "${result.matchedText}"`);
    } else {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  if (response.warnings && response.warnings.length > 0) {
    console.log('\nWarnings:');
    response.warnings.forEach(warning => console.log(`  - ${warning}`));
  }
  
  if (response.pdfBuffer) {
    fs.writeFileSync('annotated-with-errors.pdf', response.pdfBuffer);
    console.log('\n✓ Partially annotated PDF saved (successful annotations only)');
  }
}

/**
 * Example 8: Custom Options and Fuzzy Matching
 */
async function example8_fuzzyMatching() {
  console.log('\n=== Example 8: Fuzzy Matching ===\n');
  
  const pdfBuffer = fs.readFileSync('sample.pdf');
  
  // This will match even if there are minor differences (typos, OCR errors, etc.)
  const response = await annotatePDF(pdfBuffer, {
    instructions: [
      {
        type: AnnotationType.HIGHLIGHT,
        text: 'importnt infomation', // Contains typos
        pageNumber: 1
      }
    ],
    options: {
      matchTolerance: 0.2, // Allow 20% character difference
      firstMatchOnly: true,
      logNotFound: true
    }
  });
  
  console.log('Fuzzy matching results:');
  response.results.forEach(result => {
    if (result.success) {
      console.log(`✓ Matched "${result.instruction.text}" to "${result.matchedText}"`);
    } else {
      console.log(`✗ No match found even with tolerance`);
    }
  });
}

/**
 * Run all examples
 */
async function runAllExamples() {
  try {
    // Note: These examples require a sample PDF file
    // Comment out the examples you want to skip
    
    // await example1_basicExtraction();
    // await example2_formatForAI();
    // await example3_simpleAnnotation();
    // await example4_multipleAnnotations();
    // await example5_searchAndAnnotate();
    // await example6_aiPoweredAnnotation();
    // await example7_errorHandling();
    // await example8_fuzzyMatching();
    
    console.log('\n=== All Examples Complete ===\n');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Export examples for individual use
export {
  example1_basicExtraction,
  example2_formatForAI,
  example3_simpleAnnotation,
  example4_multipleAnnotations,
  example5_searchAndAnnotate,
  example6_aiPoweredAnnotation,
  example7_errorHandling,
  example8_fuzzyMatching,
  runAllExamples
};

// Run if executed directly
if (require.main === module) {
  runAllExamples();
}
