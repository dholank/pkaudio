import { NextResponse } from "next/server";
import { createCredential, listCredentials } from "@/lib/credentials/repository";
import { credentialCreateSchema } from "@/lib/credentials/validation";

export const runtime = "nodejs";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const credentials = await listCredentials();
    return NextResponse.json({ credentials });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list credentials.";
    return errorResponse(message, 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = credentialCreateSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "Invalid credential payload.");
    }

    const credential = await createCredential(parsed.data);
    return NextResponse.json({ credential }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create credential.";
    return errorResponse(message, 500);
  }
}
