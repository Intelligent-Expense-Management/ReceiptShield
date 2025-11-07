// src/app/api/ai-fraud-analysis/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs"; // ensure Buffer is available (optional but safe)

export async function POST(request: NextRequest) {
  try {
    console.log("🤖 AI Fraud Analysis Request received");
    
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (parseError) {
      console.error("❌ Failed to parse request body:", parseError);
      return NextResponse.json(
        {
          fraudulent: false,
          fraudProbability: 0.1,
          explanation: "Invalid request format. The receipt will be processed with ML analysis only.",
          riskFactors: [],
          confidence: 0.3,
          error: "INVALID_REQUEST",
        },
        { status: 400 }
      );
    }
    
    const { items, imageUrl, receiptData } = requestBody;
    console.log("📋 Request data:", {
      itemsCount: Array.isArray(items) ? items.length : 0,
      hasImageUrl: !!imageUrl,
      hasReceiptData: !!receiptData,
    });

    // Check for API key in both possible environment variable names
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey || apiKey === "your_google_ai_api_key_here") {
      console.warn("⚠️ Google AI API key not configured");
      console.warn("⚠️ Checked GOOGLE_AI_API_KEY:", process.env.GOOGLE_AI_API_KEY ? "exists" : "not set");
      console.warn("⚠️ Checked GOOGLE_API_KEY:", process.env.GOOGLE_API_KEY ? "exists" : "not set");
      return NextResponse.json(
        {
          fraudulent: false,
          fraudProbability: 0.1,
          explanation:
            "AI analysis unavailable: Google Gemini API key not configured. Please set GOOGLE_AI_API_KEY or GOOGLE_API_KEY environment variable.",
          error: "API_KEY_NOT_CONFIGURED",
          riskFactors: [],
          confidence: 0.7,
        },
        { status: 500 }
      );
    }
    
    console.log("✅ API key found, length:", apiKey.length);

    // First, try to list available models to see what we have access to
    let availableModels: string[] = [];
    try {
      console.log("🔍 Checking available models...");
      const listModelsUrl = "https://generativelanguage.googleapis.com/v1beta/models";
      const listResponse = await fetch(listModelsUrl, {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": apiKey,
        },
      });
      
      if (listResponse.ok) {
        const modelsData = await listResponse.json();
        availableModels = (modelsData.models || []).map((m: any) => m.name).filter((name: string) => 
          name && (name.includes("gemini") || name.includes("models/"))
        );
        console.log("✅ Available models:", availableModels.slice(0, 5).join(", "));
      } else {
        console.warn("⚠️ Could not list models, will try defaults");
      }
    } catch (listError) {
      console.warn("⚠️ Error listing models:", listError);
    }

    // Prepare receipt data text
    const receiptText =
      Array.isArray(items)
        ? items.map((it: any) => `${it?.label ?? "field"}: ${it?.value ?? ""}`).join("\n")
        : "";

    // Determine which model to use - check available models first, then fallback to defaults
    let preferredModel = process.env.GEMINI_MODEL;
    let apiVersion = process.env.GEMINI_API_VERSION || "v1beta";
    
    // If we got available models, try to find a suitable one
    // Prefer flash models (higher rate limits) over pro models
    if (availableModels.length > 0) {
      // Look for flash models first (better rate limits)
      const flash25 = availableModels.find(m => m.includes("gemini-2.5-flash") && !m.includes("lite"));
      const flash15 = availableModels.find(m => m.includes("gemini-1.5-flash") && !m.includes("lite"));
      const flashAny = availableModels.find(m => m.includes("flash") && !m.includes("lite"));
      
      // Then look for pro models
      const pro25 = availableModels.find(m => m.includes("gemini-2.5-pro"));
      const pro15 = availableModels.find(m => m.includes("gemini-1.5-pro"));
      const proAny = availableModels.find(m => m.includes("pro"));
      
      // Any gemini model as last resort
      const anyGemini = availableModels.find(m => m.includes("gemini"));
      
      if (flash25) {
        preferredModel = flash25.replace("models/", "").split("/").pop() || flash25;
        console.log(`✅ Using flash model (better rate limits): ${preferredModel}`);
      } else if (flash15) {
        preferredModel = flash15.replace("models/", "").split("/").pop() || flash15;
        console.log(`✅ Using flash model (better rate limits): ${preferredModel}`);
      } else if (flashAny) {
        preferredModel = flashAny.replace("models/", "").split("/").pop() || flashAny;
        console.log(`✅ Using flash model (better rate limits): ${preferredModel}`);
      } else if (pro25) {
        preferredModel = pro25.replace("models/", "").split("/").pop() || pro25;
        console.log(`⚠️ Using pro model (may have lower rate limits): ${preferredModel}`);
      } else if (pro15) {
        preferredModel = pro15.replace("models/", "").split("/").pop() || pro15;
        console.log(`⚠️ Using pro model (may have lower rate limits): ${preferredModel}`);
      } else if (proAny) {
        preferredModel = proAny.replace("models/", "").split("/").pop() || proAny;
        console.log(`⚠️ Using pro model (may have lower rate limits): ${preferredModel}`);
      } else if (anyGemini) {
        preferredModel = anyGemini.replace("models/", "").split("/").pop() || anyGemini;
        console.log(`⚠️ Using available model: ${preferredModel}`);
      }
    }
    
    // Default fallback if no model found
    if (!preferredModel) {
      preferredModel = "gemini-1.5-pro";
    }
    
    // Clean up model name (remove "models/" prefix if present)
    preferredModel = preferredModel.replace(/^models\//, "");
    
    const apiUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${preferredModel}:generateContent`;
    console.log(`🔧 Using Gemini API: ${apiVersion}/models/${preferredModel}`);

    const parts: any[] = [
      { text: `You are an expert fraud detection analyst specializing in expense receipt analysis. Analyze the following receipt data and determine if there are any indicators of fraud or suspicious activity.

Receipt Data:
${receiptText}

Additional Context:
- Vendor: ${receiptData?.merchant ?? "Unknown"}
- Total Amount: ${receiptData?.amount ?? "Unknown"}
- Date: ${receiptData?.date ?? "Unknown"}

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

Be thorough but fair. Only flag as fraudulent if you identify clear indicators.` },
    ];

    // If image URL is provided, include it correctly
    if (imageUrl && !imageUrl.startsWith("data:")) {
      try {
        console.log("📸 Fetching image for analysis:", imageUrl);
        // Add timeout for image fetch
        const imageController = new AbortController();
        const imageTimeout = setTimeout(() => imageController.abort(), 10000); // 10 second timeout
        
        const imageResponse = await fetch(imageUrl, {
          signal: imageController.signal,
        });
        clearTimeout(imageTimeout);
        
        if (!imageResponse.ok) {
          console.warn(`⚠️ Image fetch returned ${imageResponse.status}, skipping image in analysis`);
        } else {
          const imageBuffer = await imageResponse.arrayBuffer();
          const imageBase64 = Buffer.from(imageBuffer).toString("base64");
          const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
          
          // Check image size (Gemini has limits)
          if (imageBuffer.byteLength > 20 * 1024 * 1024) { // 20MB limit
            console.warn("⚠️ Image too large for Gemini API, skipping image in analysis");
          } else {
            parts.push({
              inlineData: {
                mimeType: contentType,
                data: imageBase64,
              },
            });
            console.log("✅ Image included in analysis");
          }
        }
      } catch (e: any) {
        if (e.name === 'AbortError') {
          console.warn("⚠️ Image fetch timed out, continuing without image");
        } else {
          console.warn("⚠️ Could not include image in analysis:", e.message || e);
        }
      }
    }

    const geminiRequestBody = {
      contents: [
        {
          role: "user",        // <-- include role
          parts,               // <-- includes text and optional inlineData
        },
      ],
      generationConfig: {
        temperature: 0.3,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096, // Increased from 1024 to allow complete fraud analysis responses
      },
    };

    console.log("🔍 Calling Google Gemini API...");
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 60000); // 60 second timeout for Gemini API
    
    let geminiResponse: Response;
    try {
      geminiResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey, // <-- send key in header
        },
        // Avoid edge caches if any proxy is in front (optional)
        cache: "no-store",
        body: JSON.stringify(geminiRequestBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error("❌ Gemini API request timed out after 60 seconds");
        return NextResponse.json(
          {
            fraudulent: false,
            fraudProbability: 0.1,
            explanation: "AI analysis timed out. The receipt will be processed with ML analysis only.",
            riskFactors: [],
            confidence: 0.3,
            error: "TIMEOUT",
          },
          { status: 504 } // Gateway Timeout
        );
      }
      console.error("❌ Gemini API network error:", fetchError);
      return NextResponse.json(
        {
          fraudulent: false,
          fraudProbability: 0.1,
          explanation: `AI analysis network error: ${fetchError.message || "Failed to connect to Gemini API"}. The receipt will be processed with ML analysis only.`,
          riskFactors: [],
          confidence: 0.3,
          error: "NETWORK_ERROR",
        },
        { status: 502 }
      );
    }

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      let errorData: any;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText } };
      }

      // If model not found, try fallback models
      if (geminiResponse.status === 404 && errorData?.error?.message?.includes("not found")) {
        const fallbackModels = [
          { version: "v1beta", model: "gemini-1.5-flash" },
          { version: "v1beta", model: "gemini-pro" },
          { version: "v1", model: "gemini-pro" },
        ];
        
        for (const fallback of fallbackModels) {
          if (fallback.version === apiVersion && fallback.model === preferredModel) {
            continue; // Skip if it's the same as what we just tried
          }
          
          console.warn(`⚠️ Trying fallback: ${fallback.version}/models/${fallback.model}`);
          try {
            const fallbackUrl = `https://generativelanguage.googleapis.com/${fallback.version}/models/${fallback.model}:generateContent`;
            const fallbackController = new AbortController();
            const fallbackTimeout = setTimeout(() => fallbackController.abort(), 60000);
            
            const fallbackResponse = await fetch(fallbackUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": apiKey,
              },
              cache: "no-store",
              body: JSON.stringify(geminiRequestBody),
              signal: fallbackController.signal,
            });
            
            clearTimeout(fallbackTimeout);
            
            if (fallbackResponse.ok) {
              console.log(`✅ Fallback model worked: ${fallback.version}/models/${fallback.model}`);
              geminiResponse = fallbackResponse;
              break; // Success, exit fallback loop
            } else {
              const fallbackErrorText = await fallbackResponse.text();
              console.warn(`⚠️ Fallback ${fallback.model} failed:`, fallbackErrorText.substring(0, 200));
            }
          } catch (fallbackError: any) {
            console.warn(`⚠️ Fallback ${fallback.model} error:`, fallbackError.message);
            // Continue to next fallback
          }
        }
      }

      // If still not ok after fallback attempt, return error
      if (!geminiResponse.ok) {
        if (geminiResponse.status === 429) {
          console.warn("⚠️ Gemini API rate limit exceeded (429)");
          return NextResponse.json({
            fraudulent: false,
            fraudProbability: 0.1,
            explanation:
              "AI analysis temporarily unavailable: Google Gemini API rate limit exceeded. Please try again in a few moments.",
            riskFactors: [],
            confidence: 0.3,
            error: "RATE_LIMIT_EXCEEDED",
            retryAfter: "Please wait a few minutes before trying again",
          });
        }

        console.error("❌ Gemini API error:", errorText);
        return NextResponse.json(
          {
            fraudulent: false,
            fraudProbability: 0.1,
            explanation: `AI analysis unavailable: ${errorData?.error?.message || "Unknown Gemini API error"}. The receipt will be processed with ML analysis only.`,
            riskFactors: [],
            confidence: 0.4,
            error: errorData?.error?.status || "GEMINI_API_ERROR",
          },
          { status: 502 }
        );
      }
    }

    const geminiData = await geminiResponse.json();
    const candidate = geminiData?.candidates?.[0];
    const finishReason = candidate?.finishReason;
    
    // Check if response was truncated
    if (finishReason === 'MAX_TOKENS' || finishReason === 'OTHER') {
      console.warn(`⚠️ Gemini response may be incomplete (finishReason: ${finishReason})`);
    }
    
    const aiTextResponse = candidate?.content?.parts
      ?.map((part: any) => part?.text || "")
      .join("")
      .trim();

    if (!aiTextResponse) {
      console.warn("⚠️ Gemini API returned no usable content", geminiData);
      return NextResponse.json({
        fraudulent: false,
        fraudProbability: 0.1,
        explanation:
          "AI analysis unavailable: Gemini returned an empty response. The receipt will be processed with ML analysis only.",
        riskFactors: [],
        confidence: 0.4,
        error: "EMPTY_RESPONSE",
      });
    }

    // Clean up the response - remove markdown code blocks if present
    let cleanedResponse = aiTextResponse.trim();
    
    // Remove markdown code block markers (```json and ```)
    cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '');
    cleanedResponse = cleanedResponse.replace(/^```\s*/i, '');
    cleanedResponse = cleanedResponse.replace(/\s*```$/i, '');
    cleanedResponse = cleanedResponse.trim();
    
    // Try to extract JSON if it's embedded in other text
    // Use a more robust approach: find the largest valid JSON object
    let jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      let potentialJson = jsonMatch[0];
      
      // Try to find complete JSON by balancing braces
      let braceCount = 0;
      let lastValidIndex = -1;
      for (let i = 0; i < potentialJson.length; i++) {
        if (potentialJson[i] === '{') braceCount++;
        if (potentialJson[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            lastValidIndex = i;
            break;
          }
        }
      }
      
      if (lastValidIndex > 0) {
        cleanedResponse = potentialJson.substring(0, lastValidIndex + 1);
      } else {
        cleanedResponse = potentialJson;
      }
    }
    
    let aiResult: any;
    try {
      aiResult = JSON.parse(cleanedResponse);
    } catch (parseError: any) {
      // If JSON is incomplete, try to extract what we can
      if (parseError.message?.includes('end of JSON input') || parseError.message?.includes('Unexpected')) {
        console.warn("⚠️ Incomplete JSON response, attempting to extract partial data");
        
        // Try to extract partial data from incomplete JSON
        try {
          // Find all key-value pairs we can extract
          const fraudulentMatch = cleanedResponse.match(/"fraudulent"\s*:\s*(true|false)/i);
          const probabilityMatch = cleanedResponse.match(/"fraudProbability"\s*:\s*([0-9.]+)/i);
          const explanationMatch = cleanedResponse.match(/"explanation"\s*:\s*"([^"]*)/i);
          
          if (fraudulentMatch || probabilityMatch) {
            aiResult = {
              fraudulent: fraudulentMatch ? fraudulentMatch[1].toLowerCase() === 'true' : false,
              fraudProbability: probabilityMatch ? parseFloat(probabilityMatch[1]) : 0.5,
              explanation: explanationMatch ? explanationMatch[1] + " (Response was truncated, analysis may be incomplete.)" : "AI analysis was truncated but indicates potential fraud concerns.",
              riskFactors: [],
              confidence: 0.6,
            };
            console.log("✅ Extracted partial data from incomplete JSON");
          } else {
            throw parseError; // Re-throw if we can't extract anything
          }
        } catch (extractError) {
          console.warn("⚠️ Could not parse or extract from Gemini response", cleanedResponse.substring(0, 500), parseError);
          return NextResponse.json({
            fraudulent: false,
            fraudProbability: 0.1,
            explanation:
              "AI analysis unavailable: Gemini returned incomplete or unstructured data. The receipt will be processed with ML analysis only.",
            riskFactors: [],
            confidence: 0.4,
            error: "INVALID_JSON",
            rawResponse: aiTextResponse.substring(0, 500), // Only log first 500 chars
          });
        }
      } else {
        console.warn("⚠️ Could not parse Gemini response as JSON", cleanedResponse.substring(0, 500), parseError);
        return NextResponse.json({
          fraudulent: false,
          fraudProbability: 0.1,
          explanation:
            "AI analysis unavailable: Gemini returned unstructured data. The receipt will be processed with ML analysis only.",
          riskFactors: [],
          confidence: 0.4,
          error: "INVALID_JSON",
          rawResponse: aiTextResponse.substring(0, 500), // Only log first 500 chars
        });
      }
    }

    const sanitizedResult = {
      fraudulent: Boolean(aiResult?.fraudulent),
      fraudProbability:
        typeof aiResult?.fraudProbability === "number" && aiResult.fraudProbability >= 0 && aiResult.fraudProbability <= 1
          ? aiResult.fraudProbability
          : 0.1,
      explanation:
        typeof aiResult?.explanation === "string" && aiResult.explanation.trim().length > 0
          ? aiResult.explanation
          : "AI analysis completed, but no detailed explanation was provided.",
      riskFactors: Array.isArray(aiResult?.riskFactors) ? aiResult.riskFactors : [],
      confidence:
        typeof aiResult?.confidence === "number" && aiResult.confidence >= 0 && aiResult.confidence <= 1
          ? aiResult.confidence
          : 0.5,
    };

    return NextResponse.json(sanitizedResult);
  } catch (error: any) {
    console.error("❌ AI Fraud Analysis failed:", error);
    console.error("Error stack:", error?.stack);
    console.error("Error details:", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    
    return NextResponse.json(
      {
        fraudulent: false,
        fraudProbability: 0.1,
        explanation:
          `AI fraud analysis failed: ${error?.message || "Unknown error"}. The receipt will be processed with ML analysis only.`,
        riskFactors: [],
        confidence: 0.3,
        error: error?.code || error?.name || "AI_ANALYSIS_FAILED",
      },
      { status: 500 }
    );
  }
}
        
