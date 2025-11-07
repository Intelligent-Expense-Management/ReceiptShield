import { NextRequest, NextResponse } from 'next/server';

/**
 * AI Fraud Analysis API Route
 * Uses Google Gemini to analyze receipts for fraud indicators
 */
export async function POST(request: NextRequest) {
  try {
    const { items, imageUrl, receiptData } = await request.json();
    console.log('🤖 AI Fraud Analysis Request received');

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    
    if (!apiKey || apiKey === 'your_google_ai_api_key_here') {
      console.warn('⚠️ Google AI API key not configured');
      return NextResponse.json({
        fraudulent: false,
        fraudProbability: 0.1,
        explanation: 'AI analysis unavailable: Google Gemini API key not configured. Please set GOOGLE_AI_API_KEY environment variable.',
        error: 'API_KEY_NOT_CONFIGURED'
      });
    }

    // Prepare receipt data for Gemini analysis
    const receiptText = items
      .map((item: any) => `${item.label}: ${item.value}`)
      .join('\n');

    const analysisPrompt = `You are an expert fraud detection analyst specializing in expense receipt analysis. Analyze the following receipt data and determine if there are any indicators of fraud or suspicious activity.

Receipt Data:
${receiptText}

Additional Context:
- Vendor: ${receiptData?.merchant || 'Unknown'}
- Total Amount: ${receiptData?.amount || 'Unknown'}
- Date: ${receiptData?.date || 'Unknown'}

Please analyze this receipt for fraud indicators including but not limited to:
1. Mathematical inconsistencies (totals, taxes, tips)
2. Suspicious vendor names or patterns
3. Unusual amounts or item counts
4. Temporal anomalies (dates, times)
5. Missing critical information
6. Visual quality issues (if image available)
7. Personal expense items disguised as business expenses
8. Duplicate submission patterns
9. Policy violations (excessive tips, luxury items, etc.)
10. Vendor authenticity concerns

Provide your analysis in the following JSON format:
{
  "fraudulent": boolean,
  "fraudProbability": number (0-1),
  "explanation": "Detailed explanation of your findings, including specific fraud indicators if found, or confirmation that the receipt appears legitimate",
  "riskFactors": ["list of specific risk factors identified"],
  "confidence": number (0-1)
}

Be thorough but fair. Only flag as fraudulent if you identify clear indicators.`;

    // Call Google Gemini API
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const requestBody: any = {
      contents: [{
        parts: [{
          text: analysisPrompt
        }]
      }],
      generationConfig: {
        temperature: 0.3,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    };

    // If image URL is provided, include it in the analysis
    if (imageUrl && !imageUrl.startsWith('data:')) {
      try {
        // Fetch the image and convert to base64
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString('base64');
        
        requestBody.contents[0].parts.push({
          inline_data: {
            mime_type: imageResponse.headers.get('content-type') || 'image/jpeg',
            data: imageBase64
          }
        });
      } catch (imageError) {
        console.warn('⚠️ Could not include image in analysis:', imageError);
        // Continue with text-only analysis
      }
    }

    console.log('🔍 Calling Google Gemini API...');
    const geminiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText } };
      }
      
      // Handle rate limiting (429) gracefully
      if (geminiResponse.status === 429) {
        console.warn('⚠️ Gemini API rate limit exceeded (429)');
        return NextResponse.json({
          fraudulent: false,
          fraudProbability: 0.1,
          explanation: 'AI analysis temporarily unavailable: Google Gemini API rate limit exceeded. Please try again in a few moments. The receipt will be processed with ML analysis only.',
          riskFactors: [],
          confidence: 0.3,
          error: 'RATE_LIMIT_EXCEEDED',
          retryAfter: 'Please wait a few minutes before trying again'
        });
      }
      
      // Handle other API errors
      console.error('❌ Gemini API error:', errorText);
      return NextResponse.json({
        fraudulent: false,
        fraudProbability: 0.1,
        explanation: `AI analysis unavailable: ${errorData?.error?.message || 'Unknown Gemini API error'}. The receipt will be processed with ML analysis only.`,
        riskFactors: [],
        confidence: 0.3,
        error: `GEMINI_API_ERROR_${geminiResponse.status}`
      });
    }

    const geminiData = await geminiResponse.json();
    console.log('✅ Gemini API response received');

    // Extract the response text
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!responseText) {
      throw new Error('No response text from Gemini API');
    }

    // Try to parse JSON from the response
    let aiAnalysis;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                       responseText.match(/```\s*([\s\S]*?)\s*```/) ||
                       [null, responseText];
      
      const jsonText = jsonMatch[1] || responseText;
      aiAnalysis = JSON.parse(jsonText.trim());
    } catch (parseError) {
      console.warn('⚠️ Could not parse JSON from Gemini response, using fallback');
      // Fallback: extract information from text response
      const fraudulent = responseText.toLowerCase().includes('fraudulent') || 
                        responseText.toLowerCase().includes('fraud') ||
                        responseText.toLowerCase().includes('suspicious');
      
      aiAnalysis = {
        fraudulent: fraudulent,
        fraudProbability: fraudulent ? 0.7 : 0.1,
        explanation: responseText,
        riskFactors: [],
        confidence: 0.6
      };
    }

    // Ensure required fields are present
    const result = {
      fraudulent: aiAnalysis.fraudulent || false,
      fraudProbability: Math.min(1, Math.max(0, aiAnalysis.fraudProbability || 0.1)),
      explanation: aiAnalysis.explanation || 'AI analysis completed. No fraud indicators detected.',
      riskFactors: aiAnalysis.riskFactors || [],
      confidence: Math.min(1, Math.max(0, aiAnalysis.confidence || 0.7))
    };

    console.log('✅ AI Fraud Analysis Result:', result);
    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ AI Fraud Analysis Error:', error);
    
    // Return fallback result
    return NextResponse.json({
      fraudulent: false,
      fraudProbability: 0.1,
      explanation: `AI analysis unavailable: ${error instanceof Error ? error.message : 'Unknown error'}. Receipt will be flagged for manual review.`,
      riskFactors: [],
      confidence: 0.3,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
