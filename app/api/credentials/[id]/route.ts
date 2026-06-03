import { NextResponse } from "next/server";
import { deleteCredential, getCredentialById, toCredentialView, updateCredential } from "@/lib/credentials/repository";
import { credentialUpdateSchema } from "@/lib/credentials/validation";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const credential = await getCredentialById(id);

    if (!credential) return errorResponse("Credential not found.", 404);

    return NextResponse.json({ credential: toCredentialView(credential) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get credential.";
    return errorResponse(message, 500);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = credentialUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "Invalid credential payload.");
    }

    const credential = await updateCredential(id, parsed.data);
    if (!credential) return errorResponse("Credential not found.", 404);

    return NextResponse.json({ credential });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update credential.";
    return errorResponse(message, 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const deleted = await deleteCredential(id);

    if (!deleted) return errorResponse("Credential not found.", 404);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete credential.";
    return errorResponse(message, 500);
  }
}
