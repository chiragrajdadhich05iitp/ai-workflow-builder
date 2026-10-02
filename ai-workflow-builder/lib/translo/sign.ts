// lib/translo/sign.ts
// HMAC-SHA1 Transloadit signature generator

import crypto from "crypto";

export interface TransloaditSignedParams {
  params:    string;
  signature: string;
  endpoint:  string;
}

export function signTransloaditParams(
  authKey: string,
  authSecret: string,
  templateId: string,
  expiresInMs = 30 * 60 * 1000
): TransloaditSignedParams {
  const expires = new Date(Date.now() + expiresInMs)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, "+00:00");

  const params = JSON.stringify({
    auth: {
      key:     authKey,
      expires,
    },
    template_id: templateId,
  });

  const signature = crypto
    .createHmac("sha384", authSecret)
    .update(Buffer.from(params, "utf8"))
    .digest("hex");

  return {
    params,
    signature: `sha384:${signature}`,
    endpoint:  "https://api2.transloadit.com/assemblies",
  };
}
