/**
 * Summarizes and formats AI analysis explanations for display
 * @param explanation - The raw AI explanation text
 * @returns Formatted and cleaned explanation string
 */
export function summarizeAIAnalysis(explanation: string | undefined | null): string {
  if (!explanation || explanation.trim() === '') {
    return 'No AI explanation provided.';
  }

  // Clean up the explanation text
  let cleaned = explanation.trim();

  // Remove markdown code blocks if present
  cleaned = cleaned.replace(/^```json\s*/i, '');
  cleaned = cleaned.replace(/^```\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');

  // Remove excessive whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.replace(/[ \t]+/g, ' ');

  // If it's a JSON string, try to extract meaningful content
  if (cleaned.startsWith('{') && cleaned.includes('"explanation"')) {
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed.explanation) {
        cleaned = parsed.explanation;
      } else if (parsed.message) {
        cleaned = parsed.message;
      }
    } catch {
      // If parsing fails, use the original text
    }
  }

  // Truncate if too long (keep first 300 characters for concise display)
  // Since AI now generates shorter explanations, this is mainly a safety net
  if (cleaned.length > 300) {
    cleaned = cleaned.substring(0, 300) + '...';
  }

  return cleaned.trim();
}

