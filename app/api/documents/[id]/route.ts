import { NextResponse } from "next/server";
import { deleteDocument } from "@/lib/storage";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  await deleteDocument(id);
  return NextResponse.json({ ok: true });
}
