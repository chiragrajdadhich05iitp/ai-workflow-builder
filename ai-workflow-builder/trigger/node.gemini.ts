// trigger/node.gemini.ts
// Trigger.dev task: multimodal Gemini call

import { task } from "@trigger.dev/sdk";
import { callGemini }        from "@/lib/gemini/client";
import { geminiOutputSchema } from "@/lib/nodes/schema";

interface GeminiTaskInput {
  model:         string;
  prompt:        string;
  systemPrompt?: string;
  images?:       string[]; // CDN URLs
  video?:        string | null;
  audio?:        string | null;
  file?:         string | null;
  settings: {
    temperature:     number;
    topP:            number;
    topK:            number;
    maxOutputTokens: number;
  };
  nodeId: string;
  runId:  string;
}

export const geminiTask = task({
  id:          "node.gemini",
  maxDuration: 60,
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
    randomize: true,
  },

  run: async (input: GeminiTaskInput) => {
    const { model, prompt, systemPrompt, images, settings, nodeId, runId } = input;

    const result = await callGemini({
      model,
      prompt,
      systemPrompt: systemPrompt ?? undefined,
      images:       images ?? [],
      settings,
    });

    // Validate and return
    const output = geminiOutputSchema.parse({ response__out: result.text });
    return output;
  },
});
