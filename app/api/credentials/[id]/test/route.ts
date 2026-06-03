import { NextResponse } from "next/server";
import { getCredentialById, toCredentialView } from "@/lib/credentials/repository";
import { testRobloxCredentialAccess, RobloxUploadError } from "@/lib/roblox/upload";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const existing = await getCredentialById(id);
    if (!existing) return errorResponse("Credential not found.", 404);

    const test = await testRobloxCredentialAccess({ credentialId: id });
    const updated = await getCredentialById(id);

    return NextResponse.json({ credential: updated ? toCredentialView(updated) : toCredentialView(existing), test });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to test credential.";
    const status = error instanceof RobloxUploadError && error.status === 401 ? 401 : error instanceof RobloxUploadError && error.status === 403 ? 403 : 500;
    return errorResponse(message, status);
  }
}
