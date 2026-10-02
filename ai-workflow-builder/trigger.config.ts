import { defineConfig } from "@trigger.dev/sdk";
import { ffmpeg } from "@trigger.dev/build/extensions/core";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "nextflow",
  runtime: "node-22",
  logLevel: "log",
  maxDuration: 300, // 5 minutes max for the orchestrator
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts:   2,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  build: {
    extensions: [
      ffmpeg(), // Installs FFmpeg in the Trigger.dev task container
      prismaExtension({ mode: "legacy", schema: "prisma/schema.prisma" }),
    ],
  },
});
