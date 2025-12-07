/**
 * Groq API Service
 * 
 * This module provides integration with Groq API for AI-powered annotation generation.
 * It handles calling the Groq API with extracted PDF text and user prompts,
 * and parsing the AI response into structured annotation instructions.
 */

import { AnnotationInstruction, AnnotationType } from '../types/annotations';

const groqApiKey = process.env.GROQ_API_KEY;
const groqModel = process.env.GROQ_MODEL || 'moonshotai/kimi-k2-instruct-0905';
const groqApiUrl = 'https://api.groq.com/openai/v1/chat/completions';

if (!groqApiKey) {
  console.warn('[Groq Service] GROQ_API_KEY environment variable is not set');
}

interface AIAnnotation {
  page: number;
  text: string;
  action: 'highlight' | 'underline' | 'comment';
  comment?: string;
}

interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Calls Groq API to generate annotations based on extracted PDF text and user prompt
 * 
 * @param extractedText - The extracted text from PDF pages
 * @param userPrompt - User's prompt for annotation guidance
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns Promise<AnnotationInstruction[]> - Array of annotation instructions
 * @throws Error if API call fails or response is invalid
 */
export async function generateAnnotationsWithGroq(
  extractedText: any,
  userPrompt: string,
  timeoutMs: number = 30000
): Promise<AnnotationInstruction[]> {
  if (!groqApiKey) {
    throw new Error('GROQ_API_KEY environment variable is not configured');
  }

  try {
    console.log('[Groq Service] Preparing prompt for Groq API');

    // Format extracted text for the prompt
    const formattedText = formatTextForGroq(extractedText);

    const systemPrompt = `You are a PDF annotation assistant. Your task is to analyze document content and suggest annotations.
You MUST respond with ONLY a valid JSON array (no markdown, no code blocks, just plain JSON).
Each annotation must have: page (number), text (string snippet to annotate), action (one of: 'highlight', 'underline', 'comment').
Optional: comment (string) for the 'comment' action.
Example format: [{"page": 1, "text": "important phrase", "action": "highlight"}]`;

    const userMessage = `${formattedText}

User request: ${userPrompt}

Please identify and suggest annotations. Return only the JSON array.`;

    console.log('[Groq Service] Calling Groq API with model:', groqModel);

    // Set timeout for the request
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(groqApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: groqModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ] as GroqMessage[],
          max_tokens: 4096,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutHandle);

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };

      console.log('[Groq Service] Received response from Groq API');

      // Extract text content from response
      const responseText = data.choices?.[0]?.message?.content || '';

      if (!responseText) {
        throw new Error('Empty response from Groq API');
      }

      console.log('[Groq Service] Response text:', responseText.substring(0, 200));

      // Parse and validate response
      const annotations = parseGroqResponse(responseText, extractedText);

      console.log(`[Groq Service] Successfully parsed ${annotations.length} annotations`);

      return annotations;
    } catch (error) {
      clearTimeout(timeoutHandle);
      throw error;
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`Groq API request timeout after ${timeoutMs}ms`);
      }
      console.error('[Groq Service] Error calling Groq API:', error.message);
      throw new Error(`Failed to generate annotations with Groq: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Formats extracted text for Groq prompt
 */
function formatTextForGroq(extractedText: any): string {
  const pages = extractedText.pages || [];
  
  let formatted = 'DOCUMENT CONTENT:\n\n';

  for (const page of pages) {
    const text = page.text || '';
    const truncated = text.length > 1000 ? text.substring(0, 1000) + '...' : text;
    formatted += `[Page ${page.pageNumber}]\n${truncated}\n\n`;
  }

  return formatted;
}

/**
 * Parses and validates Groq API response
 * Defensive parsing to handle various response formats
 */
function parseGroqResponse(
  responseText: string,
  extractedText: any
): AnnotationInstruction[] {
  const annotations: AnnotationInstruction[] = [];

  try {
    // Clean response text: remove markdown code blocks if present
    let cleanedText = responseText.trim();
    
    // Handle markdown code blocks
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    console.log('[Groq Service] Cleaned response:', cleanedText.substring(0, 100));

    // Find JSON array in response (handles cases where there's extra text)
    const jsonMatch = cleanedText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!jsonMatch) {
      throw new Error('No valid JSON array found in response');
    }

    const jsonStr = jsonMatch[0];
    const parsed = JSON.parse(jsonStr);

    // Validate it's an array
    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }

    console.log(`[Groq Service] Parsed ${parsed.length} annotations from response`);

    // Convert each AI annotation to AnnotationInstruction
    const totalPages = extractedText.totalPages || extractedText.pages.length;

    for (const item of parsed) {
      const aiAnnotation = validateAIAnnotation(item);
      if (!aiAnnotation) {
        console.warn('[Groq Service] Skipping invalid annotation:', item);
        continue;
      }

      // Validate page number
      if (aiAnnotation.page < 1 || aiAnnotation.page > totalPages) {
        console.warn(
          `[Groq Service] Skipping annotation with invalid page number: ${aiAnnotation.page}`
        );
        continue;
      }

      // Validate text is not empty
      if (!aiAnnotation.text || aiAnnotation.text.trim().length === 0) {
        console.warn('[Groq Service] Skipping annotation with empty text');
        continue;
      }

      // Convert action to AnnotationType
      const annotationType = mapActionToAnnotationType(aiAnnotation.action);
      if (!annotationType) {
        console.warn('[Groq Service] Skipping annotation with invalid action:', aiAnnotation.action);
        continue;
      }

      // Create AnnotationInstruction
      const instruction: AnnotationInstruction = {
        type: annotationType,
        text: aiAnnotation.text.trim(),
        pageNumber: aiAnnotation.page,
      };

      // Add comment if provided for comment actions
      if (annotationType === AnnotationType.COMMENT && aiAnnotation.comment) {
        instruction.comment = aiAnnotation.comment.trim();
      }

      annotations.push(instruction);
    }

    console.log(
      `[Groq Service] Successfully converted ${annotations.length} valid annotations`
    );

    return annotations;
  } catch (error) {
    console.error('[Groq Service] Error parsing Groq response:', error);
    
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in Groq response: ${error.message}`);
    }

    throw error;
  }
}

/**
 * Validates AI annotation object structure
 */
function validateAIAnnotation(item: any): AIAnnotation | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const page = item.page;
  const text = item.text;
  const action = item.action;

  // Validate required fields
  if (
    typeof page !== 'number' ||
    typeof text !== 'string' ||
    typeof action !== 'string'
  ) {
    return null;
  }

  return {
    page,
    text,
    action: action.toLowerCase() as AIAnnotation['action'],
    comment: item.comment ? String(item.comment) : undefined,
  };
}

/**
 * Maps AI action string to AnnotationType
 */
function mapActionToAnnotationType(action: string): AnnotationType | null {
  const normalized = action.toLowerCase().trim();

  switch (normalized) {
    case 'highlight':
      return AnnotationType.HIGHLIGHT;
    case 'underline':
      return AnnotationType.UNDERLINE;
    case 'comment':
      return AnnotationType.COMMENT;
    default:
      return null;
  }
}
