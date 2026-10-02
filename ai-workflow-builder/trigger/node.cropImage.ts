// trigger/node.cropImage.ts
// Trigger.dev task: download image → FFmpeg crop (≥30s wait) → Transloadit upload → return CDN URL

import { task, wait } from "@trigger.dev/sdk";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, unlink, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { cropImageOutputSchema } from "@/lib/nodes/schema";
import { uploadToTransloadit }   from "@/lib/translo/upload";
import { CROP_DELAY_SECONDS }    from "@/lib/constants";

const execFileAsync = promisify(execFile);

interface CropImageInput {
  inputImage: string; // CDN URL
  x:          number; // 0–100
  y:          number; // 0–100
  w:          number; // 0–100
  h:          number; // 0–100
  nodeId:     string;
  runId:      string;
}

export const cropImageTask = task({
  id:          "node.cropImage",
  maxDuration: 300, // seconds
  retry: {
    maxAttempts: 2,
  },

  run: async (input: CropImageInput) => {
    const { inputImage, x, y, w, h, nodeId, runId } = input;

    // ── Step 1: Mandatory ≥30s wait (PRD requirement — makes parallel UX visible) ──
    await wait.for({ seconds: CROP_DELAY_SECONDS });

    // ── Step 2: Download the source image ─────────────────────────────────────────
    const imageRes    = await fetch(inputImage);
    if (!imageRes.ok) throw new Error(`Failed to download image: ${imageRes.status}`);
    const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

    const ext      = inputImage.split(".").pop()?.split("?")[0] ?? "jpg";
    const tmpDir   = await mkdtemp(join(tmpdir(), "nextflow-"));
    const srcPath  = join(tmpDir, `input.${ext}`);
    const outPath  = join(tmpDir, "output.jpg");

    await writeFile(srcPath, imageBuffer);

    // ── Step 3: Get image dimensions via ffprobe ──────────────────────────────────
    const { stdout: probeOut } = await execFileAsync("ffprobe", [
      "-v", "quiet",
      "-print_format", "json",
      "-show_streams",
      srcPath,
    ]);
    const probeData = JSON.parse(probeOut);
    const stream    = probeData.streams?.find((s: any) => s.codec_type === "video");
    const imgW      = stream?.width  ?? 800;
    const imgH      = stream?.height ?? 600;

    // ── Step 4: Compute pixel crop values from percentages ────────────────────────
    // Clamp to prevent out-of-bounds
    const cropX = Math.floor((Math.min(x, 100) / 100) * imgW);
    const cropY = Math.floor((Math.min(y, 100) / 100) * imgH);
    const cropW = Math.floor((Math.min(w, 100) / 100) * imgW);
    const cropH = Math.floor((Math.min(h, 100) / 100) * imgH);

    const safeW = Math.max(1, Math.min(cropW, imgW - cropX));
    const safeH = Math.max(1, Math.min(cropH, imgH - cropY));

    // ── Step 5: FFmpeg crop ───────────────────────────────────────────────────────
    await execFileAsync("ffmpeg", [
      "-i", srcPath,
      "-vf", `crop=${safeW}:${safeH}:${cropX}:${cropY}`,
      "-frames:v", "1",
      "-q:v", "2",
      outPath,
      "-y",
    ]);

    // ── Step 6: Read output and upload to Transloadit ─────────────────────────────
    const outputBuffer = await readFile(outPath);
    const { cdnUrl }   = await uploadToTransloadit(outputBuffer, `crop_${nodeId}.jpg`, "image/jpeg");

    // Clean up temp files
    await Promise.allSettled([unlink(srcPath), unlink(outPath)]);

    // ── Step 7: Return validated output ──────────────────────────────────────────
    const output = cropImageOutputSchema.parse({ output_image__out: cdnUrl });
    return output;
  },
});
