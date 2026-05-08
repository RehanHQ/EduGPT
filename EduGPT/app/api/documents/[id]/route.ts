import { NextResponse } from "next/server";
import { deleteDocument } from "@/lib/storage";
import { hasRole, requireUser } from "@/lib/auth/session";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);

    if (!hasRole(user, ["TEACHER", "ADMIN"])) {
      return NextResponse.json({ error: "Teacher or admin role required to delete documents." }, { status: 403 });
    }

    const { id } = await context.params;
    await deleteDocument(id, { organizationId: user.organizationId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    const status = message === "Authentication required." ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
