// app/api/upload/signature/route.ts
// POST — returns Transloadit signed Assembly params for direct browser uploads

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { uploadSignatureRequestSchema } from "@/lib/nodes/schema";
import { signTransloaditParams } from "@/lib/translo/sign";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON" } }, { status: 400 });
  }

  const parsed = uploadSignatureRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "UPLOAD_SIGNATURE_DENIED", details: parsed.error.errors } },
      { status: 400 }
    );
  }

  const authKey    = process.env.TRANSLOADIT_AUTH_KEY!;
  const authSecret = process.env.TRANSLOADIT_AUTH_SECRET!;
  const templateId = process.env.TRANSLOADIT_TEMPLATE_ID_UPLOAD!;

  if (!authKey || !authSecret || !templateId) {
    console.error("[NextFlow] Transloadit env vars not configured");
    return NextResponse.json({ error: { code: "NOT_CONFIGURED" } }, { status: 500 });
  }

  const signed = signTransloaditParams(authKey, authSecret, templateId);
  return NextResponse.json(signed);
}
