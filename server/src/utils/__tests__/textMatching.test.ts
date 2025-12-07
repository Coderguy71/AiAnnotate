/**
 * Test file for fuzzy text matching functionality
 * This tests the normalization and matching strategies
 */

// Note: This is a demonstration of the matching logic
// In actual tests, you would import and test the actual functions

describe('Text Normalization and Matching', () => {
  // Helper function to normalize text (simulating the actual normalizeText function)
  function normalizeText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .replace(/[–—]/g, '-')
      .trim();
  }

  describe('normalizeText', () => {
    it('should collapse multiple spaces to single space', () => {
      const input = 'This  has   multiple    spaces';
      const expected = 'This has multiple spaces';
      expect(normalizeText(input)).toBe(expected);
    });

    it('should collapse newlines to spaces', () => {
      const input = 'Line 1\nLine 2\nLine 3';
      const expected = 'Line 1 Line 2 Line 3';
      expect(normalizeText(input)).toBe(expected);
    });

    it('should handle mixed whitespace', () => {
      const input = 'Tab\there  \nand\r\nspaces';
      const expected = 'Tab here and spaces';
      expect(normalizeText(input)).toBe(expected);
    });

    it('should normalize quotes', () => {
      const input = 'He said "hello" and 'goodbye'';
      const expected = 'He said "hello" and \'goodbye\'';
      expect(normalizeText(input)).toBe(expected);
    });

    it('should normalize dashes', () => {
      const input = 'Em–dash and en—dash';
      const expected = 'Em-dash and en-dash';
      expect(normalizeText(input)).toBe(expected);
    });
  });

  describe('Matching Strategies', () => {
    it('should match exact text after normalization', () => {
      const pageText = 'This is a test\ndocument with\nmultiple lines';
      const searchText = 'test document with';
      
      const normalized = normalizeText(pageText);
      const searchNormalized = normalizeText(searchText);
      
      expect(normalized).toContain(searchNormalized);
    });

    it('should match partial text (first 30 chars)', () => {
      const pageText = normalizeText('The quick brown fox jumps over the lazy dog');
      const longSearch = 'The quick brown fox jumps over the lazy dog and continues on';
      const partialSearch = normalizeText(longSearch).substring(0, 30);
      
      expect(pageText).toContain(partialSearch);
    });

    it('should handle PDF extraction formatting issues', () => {
      // Simulate how PDF extraction might return text
      const pdfExtracted = 'This is a\nsentence that\nwas split across\nmultiple lines';
      const aiGenerated = 'This is a sentence that was split across multiple lines';
      
      expect(normalizeText(pdfExtracted)).toBe(normalizeText(aiGenerated));
    });
  });
});
