import { NextResponse } from "next/server";
import { run_ingestion_pipeline } from "@/pipelines/ingestion_pipeline";
import { readDocumentIndex } from "@/lib/storage";
import { hasRole, requireUser } from "@/lib/auth/session";

export async function GET(request: Request) {
  const user = await requireUser(request);
  const index = await readDocumentIndex({ organizationId: user.organizationId });
  return NextResponse.json({ documents: index.documents });
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);

    if (!hasRole(user, ["TEACHER", "ADMIN"])) {
      return NextResponse.json({ error: "Teacher or admin role required to upload documents." }, { status: 403 });
    }

    const formData = await request.formData();
    const title = String(formData.get("title") ?? "").trim();
    const subject = String(formData.get("subject") ?? "General").trim();
    const file = formData.get("file");

    if (!title) {
      return NextResponse.json({ error: "Document title is required." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A file upload is required." }, { status: 400 });
    }

    const { document } = await run_ingestion_pipeline({
      title,
      subject,
      file,
      organizationId: user.organizationId,
      uploadedById: user.id
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    const status = message === "Authentication required." ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
