// lib/gemini/client.ts
// Wraps @google/generative-ai for use in the Trigger.dev gemini task

import {
  GoogleGenerativeAI,
  type GenerateContentRequest,
  type Part,
} from "@google/generative-ai";

export interface GeminiCallInput {
  model:            string;
  prompt:           string;
  systemPrompt?:    string;
  images?:          string[]; // CDN URLs
  video?:           string | null;
  audio?:           string | null;
  file?:            string | null;
  settings: {
    temperature:     number;
    topP:            number;
    topK:            number;
    maxOutputTokens: number;
  };
}

export interface GeminiCallOutput {
  text: string;
}

/**
 * Fetches image bytes from a URL and returns an inlineData Part.
 */
async function urlToInlineData(url: string): Promise<Part> {
  const res     = await fetch(url);
  const buffer  = await res.arrayBuffer();
  const base64  = Buffer.from(buffer).toString("base64");
  const mime    = res.headers.get("content-type") ?? "image/jpeg";
  return { inlineData: { data: base64, mimeType: mime } };
}

export async function callGemini(input: GeminiCallInput): Promise<GeminiCallOutput> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not set");

  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({
    model: input.model,
    generationConfig: {
      temperature:     input.settings.temperature,
      topP:            input.settings.topP,
      topK:            input.settings.topK,
      maxOutputTokens: input.settings.maxOutputTokens,
    },
    ...(input.systemPrompt ? { systemInstruction: input.systemPrompt } : {}),
  });

  // Build parts
  const parts: Part[] = [];

  // Add images (vision)
  if (input.images && input.images.length > 0) {
    const imageParts = await Promise.all(input.images.map(urlToInlineData));
    parts.push(...imageParts);
  }

  // Text prompt
  parts.push({ text: input.prompt });

  const result = await model.generateContent({ contents: [{ role: "user", parts }] });
  const text   = result.response.text();

  return { text };
}
