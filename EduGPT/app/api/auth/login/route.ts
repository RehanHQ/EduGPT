import { NextResponse } from "next/server";
import { z } from "zod";
import { loginWithEmail } from "@/lib/auth/session";

const requestSchema = z.object({
  email: z.string().email()
});

export async function POST(request: Request) {
  try {
    const { email } = requestSchema.parse(await request.json());
    const user = await loginWithEmail(email);

    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to login.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
