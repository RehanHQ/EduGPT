import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export type UserRole = "STUDENT" | "TEACHER" | "ADMIN";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
  organization: {
    id: string;
    name: string;
    domain: string;
  };
}

const sessionCookieName = "edugpt_email";

export function extractEmailDomain(email: string): string {
  const domain = email.trim().toLowerCase().split("@")[1];

  if (!domain) {
    throw new Error("A valid email address is required.");
  }

  return domain;
}

function roleFromEmail(email: string): UserRole {
  const normalized = email.trim().toLowerCase();
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const teacherEmails = (process.env.TEACHER_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.includes(normalized) || normalized.startsWith("admin@")) {
    return "ADMIN";
  }

  if (teacherEmails.includes(normalized) || normalized.startsWith("teacher@")) {
    return "TEACHER";
  }

  return "STUDENT";
}

function asAuthenticatedUser(user: {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  organization: { id: string; name: string; domain: string };
}): AuthenticatedUser {
  const role = user.role === "ADMIN" || user.role === "TEACHER" ? user.role : "STUDENT";

  return {
    ...user,
    role
  };
}

export async function loginWithEmail(email: string): Promise<AuthenticatedUser> {
  const normalizedEmail = email.trim().toLowerCase();
  const domain = extractEmailDomain(normalizedEmail);
  const organization = await prisma.organization.upsert({
    where: { domain },
    update: {},
    create: {
      domain,
      name: domain
    }
  });
  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      organizationId: organization.id
    },
    create: {
      email: normalizedEmail,
      role: roleFromEmail(normalizedEmail),
      organizationId: organization.id
    },
    include: {
      organization: true
    }
  });
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, normalizedEmail, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });

  return asAuthenticatedUser(user);
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
}

export async function getCurrentUser(request?: Request): Promise<AuthenticatedUser | null> {
  const headerEmail = request?.headers.get("x-edugpt-email")?.trim().toLowerCase();
  const cookieStore = await cookies();
  const cookieEmail = cookieStore.get(sessionCookieName)?.value;
  const email = headerEmail || cookieEmail;

  if (!email) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      organization: true
    }
  });

  return user ? asAuthenticatedUser(user) : null;
}

export async function requireUser(request?: Request): Promise<AuthenticatedUser> {
  const user = await getCurrentUser(request);

  if (!user) {
    throw new Error("Authentication required.");
  }

  return user;
}

export function hasRole(user: AuthenticatedUser, roles: UserRole[]): boolean {
  return roles.includes(user.role);
}
