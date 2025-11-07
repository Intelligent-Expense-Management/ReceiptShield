// src/app/api/ai-fraud-analysis/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs"; // ensure Buffer is available (optional but safe)

export async function POST(request: NextRequest) {
  try {
    const { items, imageUrl, receiptData } = await request.json();
    console.log("🤖 AI Fraud Analysis Request received");

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey || apiKey === "your_google_ai_api_key_here") {
      console.warn("⚠️ Google AI API key not configured");
      return NextResponse.json(
        {
          fraudulent: false,
          fraudProbability: 0.1,
          explanation:
            "AI analysis unavailable: Google Gemini API key not configured. Please set GOOGLE_AI_API_KEY environment variable.",
          error: "API_KEY_NOT_CONFIGURED",
          riskFactors: [],
          confidence: 0.7,
        },
        { status: 500 }
      );
    }

    // Prepare receipt data text
    const receiptText =
      Array.isArray(items)
        ? items.map((it: any) => `${it?.label ?? "field"}: ${it?.value ?? ""}`).join("\n")
        : "";

    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash"; // safer generally-available default
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

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
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString("base64");
        parts.push({
          inlineData: {
            mimeType: imageResponse.headers.get("content-type") || "image/jpeg",
            data: imageBase64,
          },
        });
      } catch (e) {
        console.warn("⚠️ Could not include image in analysis:", e);
      }
    }

    const requestBody = {
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
        maxOutputTokens: 1024,
      },
    };

    console.log("🔍 Calling Google Gemini API...");
    const geminiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey, // <-- send key in header
      },
      // Avoid edge caches if any proxy is in front (optional)
      cache: "no-store",
      body: JSON.stringify(requestBody),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      let errorData: any;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText } };
      }

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

    const geminiData = await geminiResponse.json();
    const candidate = geminiData?.candidates?.[0];
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

    let aiResult: any;
    try {
      aiResult = JSON.parse(aiTextResponse);
    } catch (parseError) {
      console.warn("⚠️ Could not parse Gemini response as JSON", aiTextResponse, parseError);
      return NextResponse.json({
        fraudulent: false,
        fraudProbability: 0.1,
        explanation:
          "AI analysis unavailable: Gemini returned unstructured data. The receipt will be processed with ML analysis only.",
        riskFactors: [],
        confidence: 0.4,
        error: "INVALID_JSON",
        rawResponse: aiTextResponse,
      });
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
    return NextResponse.json(
      {
        fraudulent: false,
        fraudProbability: 0.1,
        explanation:
          `AI fraud analysis failed: ${error?.message || "Unknown error"}. The receipt will be processed with ML analysis only.`,
        riskFactors: [],
        confidence: 0.3,
        error: error?.code || "AI_ANALYSIS_FAILED",
      },
      { status: 500 }
    );
  }
}
        
