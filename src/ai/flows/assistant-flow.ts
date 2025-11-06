// AI assistant flow - calls API route
export const assistantFlow = null;

// AI Assistant function that calls the API route
export const runAssistant = async (
  message: string, 
  receiptHistory?: string
): Promise<{
  response: string;
  error: string | null;
  suggestUpload: boolean;
}> => {
  try {
    const response = await fetch('/api/ai-assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        receiptHistory
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('❌ Assistant error:', error);
    return {
      response: "I'm sorry, I encountered an error processing your request. Please try again later, or contact support if the issue persists.",
      error: error instanceof Error ? error.message : 'Unknown error',
      suggestUpload: false
    };
  }
};
