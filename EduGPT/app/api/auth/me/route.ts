import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);

  return NextResponse.json({ user });
}
