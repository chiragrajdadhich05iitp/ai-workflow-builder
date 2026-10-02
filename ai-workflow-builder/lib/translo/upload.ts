// lib/translo/upload.ts
// Server-side Transloadit upload (used by the cropImage task)

import { signTransloaditParams } from "./sign";

export interface UploadResult {
  cdnUrl: string;
}

/**
 * Uploads a buffer to Transloadit and returns the CDN URL.
 * Uses the "wait=true" flag so we get the result synchronously.
 */
export async function uploadToTransloadit(
  buffer:   Buffer,
  filename: string,
  mimeType: string
): Promise<UploadResult> {
  const authKey    = process.env.TRANSLOADIT_AUTH_KEY!;
  const authSecret = process.env.TRANSLOADIT_AUTH_SECRET!;
  const templateId = process.env.TRANSLOADIT_TEMPLATE_ID_UPLOAD!;

  const { params, signature, endpoint } = signTransloaditParams(authKey, authSecret, templateId);

  const formData = new FormData();
  formData.append("params",    params);
  formData.append("signature", signature);
  formData.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: mimeType }),
    filename
  );
  // Wait=true makes Transloadit respond synchronously (up to 25s; enough for our uploads)
  formData.append("wait", "true");

  const res  = await fetch(endpoint, { method: "POST", body: formData });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Transloadit upload failed: ${data.message ?? res.status}`);
  }

  // Wait for assembly if not already complete
  let assembly = data;
  const assemblyUrl = assembly.assembly_ssl_url ?? assembly.assembly_url;
  if (assemblyUrl && assembly.ok !== "ASSEMBLY_COMPLETED") {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const pollRes = await fetch(assemblyUrl);
      assembly      = await pollRes.json();
      if (assembly.ok === "ASSEMBLY_COMPLETED" || assembly.ok === "REQUEST_ABORTED") break;
    }
  }

  const uploads = assembly?.uploads?.[0] ?? assembly?.results?.upload?.[0];
  const url     = uploads?.ssl_url ?? uploads?.url;

  if (!url) throw new Error("No CDN URL in Transloadit response");
  return { cdnUrl: url };
}
